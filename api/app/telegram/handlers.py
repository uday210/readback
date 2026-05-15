import asyncio
import logging
import re
from datetime import datetime, timedelta, timezone

import httpx

from app.config import settings
from app.db import get_supabase

logger = logging.getLogger(__name__)

URL_RE = re.compile(r"https?://\S+")

DOMAIN_SOURCE_MAP = {
    "youtube.com": "youtube",
    "youtu.be": "youtube",
    "substack.com": "substack",
    "linkedin.com": "linkedin",
    "medium.com": "medium",
    "github.com": "github",
}


def detect_source_type(url: str) -> str:
    for domain, stype in DOMAIN_SOURCE_MAP.items():
        if domain in url:
            return stype
    return "article"


async def send_message(chat_id: int, text: str) -> int | None:
    api_url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    async with httpx.AsyncClient() as client:
        r = await client.post(api_url, json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"})
        if r.status_code != 200:
            logger.error(f"Telegram sendMessage failed: {r.text}")
            return None
        return r.json()["result"]["message_id"]


async def handle_update(update: dict) -> None:
    message = update.get("message") or update.get("edited_message")
    if not message:
        return

    user_id = message.get("from", {}).get("id")
    chat_id = message.get("chat", {}).get("id")
    text = message.get("text", "") or ""
    reply_to = message.get("reply_to_message", {}) or {}
    replied_msg_id = reply_to.get("message_id")

    if settings.allowed_user_ids and user_id not in settings.allowed_user_ids:
        logger.warning(f"Rejected update from unauthorized user {user_id}")
        return

    if text.startswith("/start"):
        await send_message(
            chat_id,
            "👋 <b>Welcome to Readback!</b>\n\nShare any link and I'll:\n"
            "• Extract the content\n• Generate structured learning notes\n• Create a podcast episode\n\n"
            "Commands:\n/list — show your last 10 links",
        )
        return

    try:
        db = get_supabase()
    except Exception as e:
        logger.exception("Failed to connect to Supabase")
        await send_message(chat_id, f"❌ Database not configured: <code>{e}</code>")
        return

    # Handle LinkedIn paste reply
    if replied_msg_id:
        from app.extractors.router import handle_paste, pending_pastes
        link_id = pending_pastes.get(replied_msg_id)
        if link_id and text:
            await handle_paste(link_id, text)
            del pending_pastes[replied_msg_id]
            await send_message(chat_id, f"✅ Paste saved for <code>{link_id[:8]}</code> — processing notes next.")
            from app.worker.pipeline import run_pipeline
            asyncio.create_task(run_pipeline(link_id))
            return

    if text.startswith("/list"):
        rows = (
            db.table("links")
            .select("id,title,url,status,created_at")
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )
        if not rows.data:
            await send_message(chat_id, "No links yet. Share something!")
            return
        lines = []
        for r in rows.data:
            short_id = r["id"][:8]
            title = (r.get("title") or r["url"])[:60]
            lines.append(f"[{short_id}] <b>{r['status']}</b> — {title}")
        await send_message(chat_id, "\n".join(lines))
        return

    urls = URL_RE.findall(text)
    if not urls:
        await send_message(chat_id, "No URL found. Share a link to get started!")
        return

    # Napkin.ai diagram URL — save to most recent podcast_ready link
    napkin_urls = [u for u in urls if "napkin.ai" in u]
    if napkin_urls:
        napkin_url = napkin_urls[0]
        recent = (
            db.table("links")
            .select("id, title")
            .eq("status", "podcast_ready")
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        if recent.data:
            link_id = recent.data[0]["id"]
            title = recent.data[0].get("title") or link_id[:8]
            db.table("notes").update({"napkin_url": napkin_url}).eq("link_id", link_id).execute()
            await send_message(chat_id, f"📊 Napkin diagram saved for <b>{title[:60]}</b>")
        else:
            await send_message(chat_id, "No podcast_ready link found to attach the diagram to.")
        return

    replies = []
    link_ids = []
    for url in urls:
        try:
            cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
            existing = (
                db.table("links")
                .select("id")
                .eq("url", url)
                .gte("created_at", cutoff)
                .execute()
            )
            if existing.data:
                link_id = existing.data[0]["id"]
                replies.append(f"Already saved — id: <code>{link_id[:8]}</code>")
                continue

            source_type = detect_source_type(url)
            row = db.table("links").insert({
                "url": url,
                "source_type": source_type,
                "source_platform": "telegram",
                "raw_message": text,
                "status": "received",
            }).execute()

            link_id = row.data[0]["id"]
            link_ids.append(link_id)
            replies.append(f"✅ Saved ({source_type}) — id: <code>{link_id[:8]}</code>\nExtracting content...")
            logger.info(f"Saved link {link_id} ({source_type}) from user {user_id}")
        except Exception as e:
            logger.exception(f"Failed to save {url}")
            replies.append(f"❌ Failed to save: {url[:60]}\n<code>{e}</code>")

    await send_message(chat_id, "\n".join(replies))

    # Kick off pipeline for each new link
    from app.worker.pipeline import run_pipeline
    for link_id in link_ids:
        asyncio.create_task(run_pipeline(link_id))

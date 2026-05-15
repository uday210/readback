import logging
import re

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


async def send_message(chat_id: int, text: str) -> None:
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    async with httpx.AsyncClient() as client:
        r = await client.post(url, json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"})
        if r.status_code != 200:
            logger.error(f"Telegram sendMessage failed: {r.text}")


async def handle_update(update: dict) -> None:
    message = update.get("message") or update.get("edited_message")
    if not message:
        return

    user_id = message.get("from", {}).get("id")
    chat_id = message.get("chat", {}).get("id")
    text = message.get("text", "")

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

    db = get_supabase()

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

    replies = []
    for url in urls:
        # idempotency: skip if same URL saved in last 24 hours
        existing = (
            db.table("links")
            .select("id")
            .eq("url", url)
            .gte("created_at", "now() - interval '24 hours'")
            .execute()
        )
        if existing.data:
            link_id = existing.data[0]["id"]
            replies.append(f"Already saved — id: <code>{link_id[:8]}</code>")
            continue

        source_type = detect_source_type(url)
        row = db.table("links").insert(
            {
                "url": url,
                "source_type": source_type,
                "source_platform": "telegram",
                "raw_message": text,
                "status": "received",
            }
        ).execute()

        link_id = row.data[0]["id"]
        replies.append(f"✅ Saved ({source_type}) — id: <code>{link_id[:8]}</code>")
        logger.info(f"Saved link {link_id} ({source_type}) from user {user_id}")

    await send_message(chat_id, "\n".join(replies))

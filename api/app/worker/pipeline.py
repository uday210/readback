import logging

import httpx

from app.config import settings
from app.db import get_supabase
from app.extractors.router import run_extraction
from app.notes.generate import generate_notes
from app.podcast.generate import generate_podcast

logger = logging.getLogger(__name__)


async def _notify(text: str) -> None:
    if not settings.allowed_user_ids:
        return
    chat_id = settings.allowed_user_ids[0]
    api_url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    async with httpx.AsyncClient() as client:
        await client.post(api_url, json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"})


async def run_pipeline(link_id: str) -> None:
    db = get_supabase()

    # ── Phase 2: extraction ──────────────────────────────────────────────────
    try:
        await run_extraction(link_id)
    except Exception:
        logger.exception(f"Extraction crashed for {link_id}")
        return

    link = db.table("links").select("status,title,url").eq("id", link_id).single().execute()
    if not link.data or link.data["status"] != "extracted":
        return

    title = link.data.get("title") or link.data.get("url", link_id[:8])

    # ── Phase 3: notes ───────────────────────────────────────────────────────
    try:
        await generate_notes(link_id)
    except Exception:
        logger.exception(f"Notes crashed for {link_id}")
        db.table("links").update({"status": "failed", "error": "Notes generation failed"}).eq("id", link_id).execute()
        await _notify(f"❌ Notes failed for <b>{title[:60]}</b>")
        return

    # ── Phase 4: podcast ─────────────────────────────────────────────────────
    try:
        await generate_podcast(link_id)
    except Exception:
        logger.exception(f"Podcast crashed for {link_id}")
        # Podcast failure is non-fatal — notes are still usable
        db.table("links").update({"status": "notes_ready"}).eq("id", link_id).execute()
        await _notify(f"📝 Notes ready (podcast failed): <b>{title[:60]}</b>")
        return

    await _notify(
        f"🎧 Episode ready: <b>{title[:60]}</b>\n"
        f"Open your web app to read notes and listen."
    )
    logger.info(f"Pipeline complete for {link_id}")

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


async def _send_audio(audio_url: str, title: str) -> None:
    if not settings.allowed_user_ids:
        return
    chat_id = settings.allowed_user_ids[0]
    api_url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendAudio"
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(api_url, json={
            "chat_id": chat_id,
            "audio": audio_url,
            "title": title[:64],
            "performer": "Readback",
            "caption": f"🎧 {title[:200]}",
        })
        if r.status_code != 200:
            logger.warning(f"sendAudio failed: {r.text[:200]}")


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

    podcast = db.table("podcasts").select("audio_url").eq("link_id", link_id).execute()
    audio_url = podcast.data[0]["audio_url"] if podcast.data else None

    await _notify(f"🎧 Episode ready: <b>{title[:60]}</b>")
    if audio_url:
        await _send_audio(audio_url, title)
    logger.info(f"Pipeline complete for {link_id}")

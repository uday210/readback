import asyncio
import logging

from app.config import settings
from app.db import get_supabase
from app.podcast.script import generate_script
from app.podcast.stitch import stitch_audio
from app.podcast.tts_elevenlabs import synthesize

logger = logging.getLogger(__name__)


async def generate_podcast(link_id: str) -> None:
    db = get_supabase()

    # ── 1. Generate dialogue script ──────────────────────────────────────────
    lines = await generate_script(link_id)
    script_text = "\n".join(f"{l['speaker']}: {l['text']}" for l in lines)
    logger.info(f"Script ready for {link_id}: {len(lines)} lines")

    # ── 2. TTS each line (concurrently, up to 5 at a time) ──────────────────
    voice_map = {
        "A": settings.elevenlabs_voice_a,
        "B": settings.elevenlabs_voice_b,
    }

    semaphore = asyncio.Semaphore(5)

    async def tts_line(line: dict) -> bytes:
        async with semaphore:
            return await synthesize(line["text"], voice_map[line["speaker"]])

    segments = await asyncio.gather(*[tts_line(l) for l in lines])
    logger.info(f"TTS complete for {link_id}: {len(segments)} segments")

    # ── 3. Stitch into a single mp3 ──────────────────────────────────────────
    mp3_bytes = stitch_audio(list(segments))
    duration_sec = len(mp3_bytes) * 8 // (80 * 1000)  # rough estimate at 80kbps
    logger.info(f"Stitched audio for {link_id}: {len(mp3_bytes)//1024}KB, ~{duration_sec}s")

    # ── 4. Upload to Supabase Storage ────────────────────────────────────────
    storage_path = f"{link_id}.mp3"
    db.storage.from_("podcasts").upload(
        path=storage_path,
        file=mp3_bytes,
        file_options={"content-type": "audio/mpeg", "upsert": "true"},
    )

    signed = db.storage.from_("podcasts").create_signed_url(storage_path, expires_in=60 * 60 * 24 * 365)
    audio_url = signed.get("signedURL") or signed.get("signedUrl", "")

    # ── 5. Save to podcasts table ─────────────────────────────────────────────
    existing = db.table("podcasts").select("id").eq("link_id", link_id).execute()
    podcast_row = {
        "link_id": link_id,
        "script": script_text,
        "audio_path": storage_path,
        "audio_url": audio_url,
        "duration_sec": duration_sec,
        "mode": "two_host",
        "tts_provider": "elevenlabs",
        "voices": {"A": settings.elevenlabs_voice_a, "B": settings.elevenlabs_voice_b},
        "metadata": {"mp3_bytes": len(mp3_bytes), "lines": len(lines)},
    }

    if existing.data:
        db.table("podcasts").update(podcast_row).eq("link_id", link_id).execute()
    else:
        db.table("podcasts").insert(podcast_row).execute()

    db.table("links").update({"status": "podcast_ready"}).eq("id", link_id).execute()
    logger.info(f"Podcast ready for {link_id}: {audio_url[:60]}...")

import asyncio
import logging

import httpx

from app.config import settings
from app.db import get_supabase

logger = logging.getLogger(__name__)

RUNWAY_BASE = "https://api.dev.runwayml.com/v1"
RUNWAY_VERSION = "2024-11-06"
POLL_INTERVAL = 5      # seconds between status checks
MAX_POLLS = 48         # 48 * 5s = 4 minutes max


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.runwayml_api_key}",
        "X-Runway-Version": RUNWAY_VERSION,
        "Content-Type": "application/json",
    }


async def generate_video(link_id: str, og_image_url: str, title: str) -> None:
    db = get_supabase()
    db.table("links").update({"video_status": "generating"}).eq("id", link_id).execute()

    try:
        prompt = (
            f"Cinematic, high-quality visualization of: {title[:180]}. "
            "Smooth camera motion, professional lighting, visually engaging."
        )

        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{RUNWAY_BASE}/image_to_video",
                headers=_headers(),
                json={
                    "model": "gen3a_turbo",
                    "promptImage": og_image_url,
                    "promptText": prompt,
                    "duration": 5,
                    "ratio": "1280:720",
                },
            )
            if r.status_code != 200:
                raise RuntimeError(f"Runway API error {r.status_code}: {r.text[:300]}")
            task_id = r.json()["id"]
            logger.info(f"Runway task started: {task_id} for link {link_id}")

        # Poll until SUCCEEDED or FAILED
        for _ in range(MAX_POLLS):
            await asyncio.sleep(POLL_INTERVAL)
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.get(f"{RUNWAY_BASE}/tasks/{task_id}", headers=_headers())
                data = r.json()

            status = data.get("status", "")
            progress = data.get("progress", 0)
            logger.info(f"Runway task {task_id}: {status} ({int(progress * 100)}%)")

            if status == "SUCCEEDED":
                output_url = data["output"][0]
                video_url = await _store_video(link_id, output_url)
                db.table("links").update({
                    "video_url": video_url,
                    "video_status": "succeeded",
                }).eq("id", link_id).execute()
                logger.info(f"Video stored for {link_id}: {video_url}")
                return

            if status in ("FAILED", "THROTTLED", "CANCELLED"):
                raise RuntimeError(f"Runway task {status}: {data.get('failure', data.get('failureCode', ''))}")

        raise TimeoutError("Runway ML generation timed out after 4 minutes")

    except Exception as e:
        logger.exception(f"Video generation failed for {link_id}: {e}")
        db.table("links").update({"video_status": "failed"}).eq("id", link_id).execute()


async def _store_video(link_id: str, output_url: str) -> str:
    """Download the Runway output video and upload to Supabase Storage."""
    async with httpx.AsyncClient(timeout=120, follow_redirects=True) as client:
        r = await client.get(output_url)
        r.raise_for_status()
        video_bytes = r.content

    db = get_supabase()
    path = f"videos/{link_id}.mp4"
    db.storage.from_("podcasts").upload(
        path,
        video_bytes,
        file_options={"content-type": "video/mp4", "upsert": "true"},
    )

    signed = db.storage.from_("podcasts").create_signed_url(path, 60 * 60 * 24 * 365)
    return signed["signedURL"]

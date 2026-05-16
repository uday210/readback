import asyncio
import logging

import httpx

from app.config import settings
from app.db import get_supabase

logger = logging.getLogger(__name__)

NAPKIN_API = "https://api.napkin.ai/v1"
POLL_INTERVAL = 5
MAX_POLLS = 24  # 2 minutes max


async def generate_napkin_visual(link_id: str, content: str) -> str | None:
    """Generate a Napkin visual, upload to Supabase Storage, return signed URL."""
    if not settings.napkin_api_key:
        logger.info("Napkin API key not set — skipping visual generation")
        return None

    headers = {
        "Authorization": f"Bearer {settings.napkin_api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        # Step 1: create visual request
        r = await client.post(
            f"{NAPKIN_API}/visual",
            headers=headers,
            json={
                "content": content[:2000],
                "format": "svg",
                "number_of_visuals": 1,
                "color_mode": "dark",
            },
        )
        r.raise_for_status()
        request_id = r.json()["id"]
        logger.info(f"Napkin request created: {request_id} for {link_id}")

        # Step 2: poll until completed
        file_url: str | None = None
        for _ in range(MAX_POLLS):
            await asyncio.sleep(POLL_INTERVAL)
            r = await client.get(f"{NAPKIN_API}/visual/{request_id}/status", headers=headers)
            r.raise_for_status()
            data = r.json()
            if data["status"] == "completed" and data.get("generated_files"):
                file_url = data["generated_files"][0]["url"]
                break
            elif data["status"] == "failed":
                logger.warning(f"Napkin visual failed for {link_id}")
                return None

        if not file_url:
            logger.warning(f"Napkin visual timed out for {link_id}")
            return None

        # Step 3: download the SVG
        r = await client.get(file_url, headers=headers, timeout=30)
        r.raise_for_status()
        svg_bytes = r.content
        logger.info(f"Napkin SVG downloaded: {len(svg_bytes)} bytes for {link_id}")

    # Step 4: upload to Supabase Storage (podcasts bucket, visuals/ prefix)
    db = get_supabase()
    storage_path = f"visuals/{link_id}.svg"
    db.storage.from_("podcasts").upload(
        path=storage_path,
        file=svg_bytes,
        file_options={"content-type": "image/svg+xml", "upsert": "true"},
    )

    signed = db.storage.from_("podcasts").create_signed_url(storage_path, expires_in=60 * 60 * 24 * 365)
    url = signed.get("signedURL") or signed.get("signedUrl", "")
    logger.info(f"Napkin visual uploaded for {link_id}: {url[:60]}...")
    return url

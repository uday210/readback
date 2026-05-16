import asyncio
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db import get_supabase

router = APIRouter(prefix="/links")
logger = logging.getLogger(__name__)


class AddLinkRequest(BaseModel):
    url: str


@router.post("")
async def add_link(body: AddLinkRequest):
    url = body.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=422, detail="Please enter a valid URL starting with http:// or https://")

    db = get_supabase()

    # Deduplicate within last 24 hours
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    existing = db.table("links").select("id").eq("url", url).gte("created_at", cutoff).execute()
    if existing.data:
        return {"link_id": existing.data[0]["id"], "duplicate": True}

    from app.telegram.handlers import detect_source_type
    source_type = detect_source_type(url)

    row = db.table("links").insert({
        "url": url,
        "source_type": source_type,
        "source_platform": "web",
        "status": "received",
    }).execute()

    link_id = row.data[0]["id"]
    logger.info(f"Web add: {link_id} ({source_type}) {url}")

    from app.worker.pipeline import run_pipeline
    asyncio.create_task(run_pipeline(link_id))

    return {"link_id": link_id, "source_type": source_type, "duplicate": False}


@router.get("")
async def list_links(limit: int = 20, offset: int = 0):
    rows = (
        get_supabase().table("links")
        .select("*, notes(id,summary,tags), podcasts(id,audio_url,duration_sec)")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return rows.data


@router.get("/{link_id}")
async def get_link(link_id: str):
    row = (
        get_supabase().table("links")
        .select("*, contents(*), notes(*), podcasts(*)")
        .eq("id", link_id)
        .single()
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="Link not found")
    return row.data


@router.delete("/{link_id}")
async def delete_link(link_id: str):
    db = get_supabase()

    # Delete storage files (non-fatal if missing)
    try:
        db.storage.from_("podcasts").remove([f"{link_id}.mp3", f"visuals/{link_id}.svg"])
    except Exception:
        pass

    db.table("notes").delete().eq("link_id", link_id).execute()
    db.table("podcasts").delete().eq("link_id", link_id).execute()
    db.table("contents").delete().eq("link_id", link_id).execute()
    db.table("links").delete().eq("id", link_id).execute()

    logger.info(f"Deleted link {link_id} and all related data")
    return {"deleted": True}


@router.post("/{link_id}/video")
async def start_video(link_id: str):
    db = get_supabase()
    link = db.table("links").select("id, title, og_image, video_status").eq("id", link_id).single().execute()
    if not link.data:
        raise HTTPException(status_code=404, detail="Link not found")

    if link.data.get("video_status") == "generating":
        raise HTTPException(status_code=409, detail="Video already generating")

    og_image = link.data.get("og_image")
    if not og_image:
        raise HTTPException(status_code=422, detail="No image available — share the link again to fetch one")

    title = link.data.get("title") or link_id[:8]

    from app.video.runway import generate_video
    asyncio.create_task(generate_video(link_id, og_image, title))

    logger.info(f"Video generation started for {link_id}")
    return {"generating": True, "link_id": link_id}


@router.get("/{link_id}/video")
async def get_video_status(link_id: str):
    db = get_supabase()
    link = db.table("links").select("video_url, video_status").eq("id", link_id).single().execute()
    if not link.data:
        raise HTTPException(status_code=404, detail="Link not found")
    return {
        "video_url": link.data.get("video_url"),
        "video_status": link.data.get("video_status"),
    }


@router.post("/{link_id}/regenerate")
async def regenerate_link(link_id: str):
    db = get_supabase()

    link = db.table("links").select("id,status").eq("id", link_id).single().execute()
    if not link.data:
        raise HTTPException(status_code=404, detail="Link not found")

    # Clean up existing derived data
    try:
        db.storage.from_("podcasts").remove([f"{link_id}.mp3", f"visuals/{link_id}.svg"])
    except Exception:
        pass

    db.table("notes").delete().eq("link_id", link_id).execute()
    db.table("podcasts").delete().eq("link_id", link_id).execute()
    db.table("links").update({"status": "received", "error": None}).eq("id", link_id).execute()

    from app.worker.pipeline import run_pipeline
    asyncio.create_task(run_pipeline(link_id))

    logger.info(f"Regenerating link {link_id}")
    return {"regenerating": True, "link_id": link_id}

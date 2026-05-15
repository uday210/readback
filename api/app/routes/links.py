from fastapi import APIRouter, HTTPException

from app.db import get_supabase

router = APIRouter(prefix="/links")


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

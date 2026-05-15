from fastapi import APIRouter, HTTPException

from app.db import get_supabase

router = APIRouter(prefix="/podcasts")


@router.get("/{link_id}")
async def get_podcast(link_id: str):
    row = (
        get_supabase().table("podcasts")
        .select("*")
        .eq("link_id", link_id)
        .single()
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="Podcast not found")
    return row.data

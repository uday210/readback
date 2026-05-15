import logging

from app.db import supabase

logger = logging.getLogger(__name__)


async def run_extraction(link_id: str) -> None:
    """Dispatches to the correct extractor based on source_type. Implemented in Phase 2."""
    link = supabase.table("links").select("*").eq("id", link_id).single().execute()
    if not link.data:
        logger.error(f"Link {link_id} not found for extraction")
        return

    source_type = link.data.get("source_type", "unknown")
    logger.info(f"Extraction queued for {link_id} ({source_type}) — Phase 2 pending")
    supabase.table("links").update({"status": "extracting"}).eq("id", link_id).execute()

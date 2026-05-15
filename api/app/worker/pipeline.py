import logging

from app.db import supabase

logger = logging.getLogger(__name__)


async def run_pipeline(link_id: str) -> None:
    """
    Full pipeline: extract → generate notes → generate podcast.
    Phase 2 wires up extraction, Phase 3 adds notes, Phase 4 adds podcast.
    """
    logger.info(f"Pipeline triggered for {link_id} — not yet implemented beyond Phase 1")
    supabase.table("links").update({"status": "failed", "error": "Pipeline phases 2–4 not yet implemented"}).eq(
        "id", link_id
    ).execute()

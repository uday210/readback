import logging

from app.extractors.router import run_extraction

logger = logging.getLogger(__name__)


async def run_pipeline(link_id: str) -> None:
    """Phase 2: extraction. Notes (Phase 3) and podcast (Phase 4) added later."""
    logger.info(f"Pipeline starting for {link_id}")
    await run_extraction(link_id)

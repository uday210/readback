import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.routes.links import router as links_router
from app.routes.notes import router as notes_router
from app.routes.podcasts import router as podcasts_router
from app.telegram.webhook import router as telegram_router

logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","message":"%(message)s"}',
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Readback API starting up")
    yield
    logger.info("Readback API shutting down")


app = FastAPI(title="Readback API", version="0.1.0", lifespan=lifespan)

app.include_router(telegram_router)
app.include_router(links_router)
app.include_router(notes_router)
app.include_router(podcasts_router)


@app.get("/healthz")
async def healthz():
    return {"ok": True}


@app.get("/debug/run/{link_id}")
async def debug_run(link_id: str):
    """Manually re-trigger the full pipeline for a link. Returns errors inline."""
    import traceback
    from app.db import get_supabase
    from app.notes.generate import generate_notes

    results = {}

    # Run extraction only if not already extracted
    db = get_supabase()
    link = db.table("links").select("status,title,error").eq("id", link_id).single().execute()
    results["before"] = link.data

    # Always attempt notes directly so we see the real error
    try:
        await generate_notes(link_id)
        results["notes"] = "ok"
    except Exception as e:
        results["notes_error"] = str(e)
        results["notes_traceback"] = traceback.format_exc()

    link = db.table("links").select("status,title,error").eq("id", link_id).single().execute()
    results["after"] = link.data
    return results


@app.get("/debug/config")
async def debug_config():
    from app.config import settings
    return {
        "telegram_bot_token_set": bool(settings.telegram_bot_token),
        "telegram_allowed_user_ids": settings.telegram_allowed_user_ids,
        "telegram_webhook_secret_set": bool(settings.telegram_webhook_secret),
        "supabase_url_set": bool(settings.supabase_url),
        "supabase_key_set": bool(settings.supabase_service_role_key),
        "anthropic_key_set": bool(settings.anthropic_api_key),
        "elevenlabs_key_set": bool(settings.elevenlabs_api_key),
    }

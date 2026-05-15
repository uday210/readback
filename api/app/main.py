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
    """Fire the full pipeline in the background and return immediately.
    Poll /debug/status/{link_id} to check progress."""
    import asyncio
    from app.worker.pipeline import run_pipeline
    asyncio.create_task(run_pipeline(link_id))
    return {"started": True, "link_id": link_id, "poll": f"/debug/status/{link_id}"}


@app.get("/debug/status/{link_id}")
async def debug_status(link_id: str):
    """Check current pipeline status for a link."""
    from app.db import get_supabase
    db = get_supabase()
    link = db.table("links").select("status,title,error,updated_at").eq("id", link_id).single().execute()
    podcast = db.table("podcasts").select("audio_url,duration_sec,created_at").eq("link_id", link_id).execute()
    notes = db.table("notes").select("id,tags,created_at").eq("link_id", link_id).execute()
    return {
        "link": link.data,
        "has_notes": bool(notes.data),
        "has_podcast": bool(podcast.data),
        "audio_url": podcast.data[0]["audio_url"] if podcast.data else None,
    }


@app.get("/debug/voices")
async def debug_voices():
    """List ElevenLabs voices available in this account."""
    import httpx
    from app.config import settings
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            "https://api.elevenlabs.io/v1/voices",
            headers={"xi-api-key": settings.elevenlabs_api_key},
        )
    return r.json()


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

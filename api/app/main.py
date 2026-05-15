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

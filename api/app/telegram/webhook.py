import logging

from fastapi import APIRouter, Header, HTTPException, Request

from app.config import settings
from app.telegram.handlers import handle_update

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/telegram")


@router.post("/webhook")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
):
    if settings.telegram_webhook_secret and x_telegram_bot_api_secret_token != settings.telegram_webhook_secret:
        raise HTTPException(status_code=403, detail="Invalid secret token")

    update = await request.json()
    try:
        await handle_update(update)
    except Exception:
        logger.exception("Unhandled error in handle_update")
    return {"ok": True}

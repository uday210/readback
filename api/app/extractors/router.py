import logging

from app.config import settings
from app.db import get_supabase
from app.extractors.linkedin import LinkedInLoginWall

logger = logging.getLogger(__name__)

# In-memory map of telegram_message_id -> link_id for LinkedIn paste requests.
# Single-user, single-process — a dict is sufficient.
pending_pastes: dict[int, str] = {}


async def _notify_user(text: str) -> int | None:
    """Send a message to the owner and return the Telegram message_id."""
    if not settings.allowed_user_ids:
        return None
    chat_id = settings.allowed_user_ids[0]
    import httpx
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    async with httpx.AsyncClient() as client:
        r = await client.post(url, json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"})
        if r.status_code == 200:
            return r.json()["result"]["message_id"]
    return None


async def run_extraction(link_id: str) -> None:
    db = get_supabase()

    row = db.table("links").select("*").eq("id", link_id).single().execute()
    if not row.data:
        logger.error(f"Link {link_id} not found")
        return

    link = row.data
    url = link["url"]
    source_type = link.get("source_type", "article")
    short_id = link_id[:8]

    db.table("links").update({"status": "extracting"}).eq("id", link_id).execute()
    logger.info(f"Extracting {link_id} ({source_type}): {url}")

    try:
        result = await _dispatch(source_type, url)

        # Remove stale rows from previous runs before inserting fresh content
        db.table("contents").delete().eq("link_id", link_id).execute()
        db.table("contents").insert({
            "link_id": link_id,
            "text": result["text"],
            "word_count": result.get("word_count", 0),
            "extraction_method": result.get("extraction_method"),
            "metadata": result.get("metadata", {}),
        }).execute()

        update: dict = {"status": "extracted"}
        if result.get("title"):
            update["title"] = result["title"]
        if result.get("author"):
            update["author"] = result["author"]
        db.table("links").update(update).eq("id", link_id).execute()

        logger.info(f"Extracted {link_id} via {result.get('extraction_method')}, {result.get('word_count', 0)} words")

    except LinkedInLoginWall:
        logger.warning(f"LinkedIn login wall for {link_id} — requesting paste")
        db.table("contents").insert({
            "link_id": link_id,
            "text": "",
            "word_count": 0,
            "extraction_method": "linkedin-fallback",
        }).execute()
        db.table("links").update({"status": "extracted"}).eq("id", link_id).execute()

        msg_id = await _notify_user(
            f"⚠️ Couldn't read LinkedIn post <code>{short_id}</code>.\n\n"
            f"Reply to <b>this message</b> with the post text and I'll save it."
        )
        if msg_id:
            pending_pastes[msg_id] = link_id

    except Exception as e:
        logger.exception(f"Extraction failed for {link_id}")
        db.table("links").update({"status": "failed", "error": str(e)[:500]}).eq("id", link_id).execute()
        await _notify_user(f"❌ Extraction failed for <code>{short_id}</code>: {e}")


async def handle_paste(link_id: str, text: str) -> None:
    """Called when the user replies with LinkedIn paste text."""
    db = get_supabase()
    db.table("contents").update({
        "text": text,
        "word_count": len(text.split()),
        "extraction_method": "linkedin-paste",
    }).eq("link_id", link_id).execute()
    db.table("links").update({"status": "extracted"}).eq("id", link_id).execute()
    logger.info(f"Paste saved for {link_id}, {len(text.split())} words")


async def _dispatch(source_type: str, url: str) -> dict:
    if source_type == "youtube":
        from app.extractors.youtube import extract
    elif source_type == "linkedin":
        from app.extractors.linkedin import extract
    elif source_type == "github":
        from app.extractors.github import extract
    else:
        from app.extractors.article import extract
    return await extract(url)

import logging
import re
from pathlib import Path

import anthropic

from app.config import settings
from app.db import get_supabase

logger = logging.getLogger(__name__)

PROMPT_PATH = Path(__file__).resolve().parent.parent.parent / "prompts" / "podcast_script_system.md"
LINE_RE = re.compile(r"^([AB]):\s+(.+)$")

MAX_WORDS = 2000
MIN_WORDS = 400


async def generate_script(link_id: str) -> list[dict]:
    """
    Returns a list of {"speaker": "A"|"B", "text": "..."} dicts.
    Raises ValueError if content is too short to warrant a podcast.
    """
    db = get_supabase()

    content_row = (
        db.table("contents")
        .select("text,word_count")
        .eq("link_id", link_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not content_row.data:
        raise ValueError("No content found for podcast script generation")

    word_count = content_row.data[0].get("word_count") or 0
    if word_count < MIN_WORDS:
        raise ValueError(f"Content too short ({word_count} words) — skipping podcast")

    notes_row = (
        db.table("notes")
        .select("markdown,summary")
        .eq("link_id", link_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    link_row = db.table("links").select("title,url").eq("id", link_id).single().execute()
    link = link_row.data or {}

    # Feed notes (more concise) to the script generator instead of raw text
    source = notes_row.data[0]["markdown"] if notes_row.data else content_row.data[0]["text"]
    source = source[:15000]  # cap to keep tokens reasonable

    system_prompt = PROMPT_PATH.read_text()
    user_content = (
        f"Title: {link.get('title') or 'Unknown'}\n"
        f"URL: {link.get('url', '')}\n\n"
        f"---\n\n{source}"
    )

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    response = await client.messages.create(
        model=settings.anthropic_model,
        max_tokens=4096,
        system=system_prompt,
        messages=[{"role": "user", "content": user_content}],
    )

    raw = response.content[0].text
    logger.info(f"Script generated for {link_id}: {response.usage.input_tokens}in/{response.usage.output_tokens}out tokens")

    lines = []
    for line in raw.splitlines():
        m = LINE_RE.match(line.strip())
        if m:
            lines.append({"speaker": m.group(1), "text": m.group(2).strip()})

    if not lines:
        raise ValueError("Script parser found no valid A:/B: lines in Claude output")

    # Enforce word cap
    total_words = 0
    capped = []
    for line in lines:
        total_words += len(line["text"].split())
        if total_words > MAX_WORDS:
            break
        capped.append(line)

    return capped

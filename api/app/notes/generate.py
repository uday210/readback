import json
import logging
import re
from pathlib import Path

import anthropic

from app.config import settings
from app.db import get_supabase

logger = logging.getLogger(__name__)

PROMPT_PATH = Path(__file__).resolve().parent.parent.parent / "prompts" / "notes_system.md"

TAGS_RE = re.compile(r'\{[^{}]*"tags"\s*:\s*\[.*?\][^{}]*\}', re.DOTALL)
TLDR_RE = re.compile(r"## TL;DR\s*\n(.*?)(?=\n##|\Z)", re.DOTALL)
TAKEAWAYS_RE = re.compile(r"## Key Takeaways\s*\n(.*?)(?=\n##|\Z)", re.DOTALL)


def _parse_response(raw: str) -> tuple[str, list[str], str | None, list[str]]:
    tags: list[str] = []
    markdown = raw

    tags_match = TAGS_RE.search(raw)
    if tags_match:
        try:
            tags = json.loads(tags_match.group()).get("tags", [])
        except json.JSONDecodeError:
            pass
        markdown = raw[: tags_match.start()].strip()

    summary: str | None = None
    tldr_match = TLDR_RE.search(markdown)
    if tldr_match:
        summary = tldr_match.group(1).strip()

    key_takeaways: list[str] = []
    ta_match = TAKEAWAYS_RE.search(markdown)
    if ta_match:
        key_takeaways = [
            line.lstrip("-•* ").strip()
            for line in ta_match.group(1).splitlines()
            if line.strip()
        ]

    return markdown, tags, summary, key_takeaways


async def generate_notes(link_id: str) -> None:
    db = get_supabase()

    content_row = db.table("contents").select("*").eq("link_id", link_id).single().execute()
    if not content_row.data or not content_row.data.get("text"):
        logger.warning(f"No content for {link_id} — skipping notes")
        return

    text: str = content_row.data["text"]
    word_count: int = content_row.data.get("word_count") or len(text.split())

    if word_count < 100:
        logger.warning(f"Content too short ({word_count} words) for {link_id}")
        return

    link_row = db.table("links").select("url,title,source_type").eq("id", link_id).single().execute()
    link = link_row.data or {}

    system_prompt = PROMPT_PATH.read_text()
    user_content = (
        f"Title: {link.get('title') or 'Unknown'}\n"
        f"URL: {link.get('url', '')}\n"
        f"Source type: {link.get('source_type', 'article')}\n\n"
        f"---\n\n{text[:50000]}"
    )

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    response = await client.messages.create(
        model=settings.anthropic_model,
        max_tokens=4096,
        system=system_prompt,
        messages=[{"role": "user", "content": user_content}],
    )

    raw = response.content[0].text
    tokens_in = response.usage.input_tokens
    tokens_out = response.usage.output_tokens

    markdown, tags, summary, key_takeaways = _parse_response(raw)

    db.table("notes").insert({
        "link_id": link_id,
        "markdown": markdown,
        "summary": summary,
        "key_takeaways": key_takeaways,
        "tags": tags,
        "model": settings.anthropic_model,
        "tokens_in": tokens_in,
        "tokens_out": tokens_out,
    }).execute()

    db.table("links").update({"status": "notes_ready"}).eq("id", link_id).execute()

    cost_est = round(tokens_in * 0.000003 + tokens_out * 0.000015, 4)
    logger.info(
        f"Notes done for {link_id}: {tokens_in}in/{tokens_out}out tokens, "
        f"~${cost_est}, tags={tags}"
    )

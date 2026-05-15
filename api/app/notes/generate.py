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
MERMAID_RE = re.compile(r"## Mermaid Diagram\s*\n```mermaid\s*\n(.*?)```", re.DOTALL)
FLASHCARDS_RE = re.compile(r"## Flashcards\s*\n(\[.*?\])", re.DOTALL)
QUIZ_RE = re.compile(r"## Quiz\s*\n(\[.*?\])", re.DOTALL)

# Sections to strip from the main markdown
STRIP_SECTIONS_RE = re.compile(
    r"\n*## (Mermaid Diagram|Flashcards|Quiz)\s*\n.*?(?=\n## |\Z)",
    re.DOTALL,
)


def _parse_response(raw: str) -> dict:
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

    mermaid_diagram: str | None = None
    mermaid_match = MERMAID_RE.search(markdown)
    if mermaid_match:
        mermaid_diagram = mermaid_match.group(1).strip()

    flashcards: list | None = None
    fc_match = FLASHCARDS_RE.search(markdown)
    if fc_match:
        try:
            flashcards = json.loads(fc_match.group(1))
        except json.JSONDecodeError:
            logger.warning("Failed to parse flashcards JSON")

    quiz: list | None = None
    quiz_match = QUIZ_RE.search(markdown)
    if quiz_match:
        try:
            quiz = json.loads(quiz_match.group(1))
        except json.JSONDecodeError:
            logger.warning("Failed to parse quiz JSON")

    # Strip generated learning sections from the main notes markdown
    clean_markdown = STRIP_SECTIONS_RE.sub("", markdown).strip()

    return {
        "markdown": clean_markdown,
        "tags": tags,
        "summary": summary,
        "key_takeaways": key_takeaways,
        "mermaid_diagram": mermaid_diagram,
        "flashcards": flashcards,
        "quiz": quiz,
    }


async def generate_notes(link_id: str) -> None:
    db = get_supabase()

    content_row = (
        db.table("contents")
        .select("*")
        .eq("link_id", link_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not content_row.data or not content_row.data[0].get("text"):
        logger.warning(f"No content for {link_id} — skipping notes")
        return

    text: str = content_row.data[0]["text"]
    word_count: int = content_row.data[0].get("word_count") or len(text.split())

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
        max_tokens=6000,
        system=system_prompt,
        messages=[{"role": "user", "content": user_content}],
    )

    raw = response.content[0].text
    tokens_in = response.usage.input_tokens
    tokens_out = response.usage.output_tokens

    parsed = _parse_response(raw)

    db.table("notes").insert({
        "link_id": link_id,
        "markdown": parsed["markdown"],
        "summary": parsed["summary"],
        "key_takeaways": parsed["key_takeaways"],
        "tags": parsed["tags"],
        "mermaid_diagram": parsed["mermaid_diagram"],
        "flashcards": json.dumps(parsed["flashcards"]) if parsed["flashcards"] else None,
        "quiz": json.dumps(parsed["quiz"]) if parsed["quiz"] else None,
        "model": settings.anthropic_model,
        "tokens_in": tokens_in,
        "tokens_out": tokens_out,
    }).execute()

    db.table("links").update({"status": "notes_ready"}).eq("id", link_id).execute()

    cost_est = round(tokens_in * 0.000003 + tokens_out * 0.000015, 4)
    logger.info(
        f"Notes done for {link_id}: {tokens_in}in/{tokens_out}out tokens, "
        f"~${cost_est}, tags={parsed['tags']}, "
        f"mermaid={'yes' if parsed['mermaid_diagram'] else 'no'}, "
        f"flashcards={len(parsed['flashcards']) if parsed['flashcards'] else 0}, "
        f"quiz={len(parsed['quiz']) if parsed['quiz'] else 0}"
    )

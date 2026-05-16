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
ANALOGY_RE = re.compile(r"## Analogy\s*\n(.+?)(?=\n##|\Z)", re.DOTALL)
ACTION_PLAN_RE = re.compile(r"## Action Plan\s*\n(\[.*?\])", re.DOTALL)
COMPARISON_TABLE_RE = re.compile(r"## Comparison Table\s*\n(.*?)(?=\n##|\Z)", re.DOTALL)
TWEET_THREAD_RE = re.compile(r"## Tweet Thread\s*\n(\[.*?\])", re.DOTALL)

STRIP_SECTIONS_RE = re.compile(
    r"\n*## (Mermaid Diagram|Flashcards|Quiz|Analogy|Action Plan|Comparison Table|Tweet Thread)\s*\n.*?(?=\n## |\Z)",
    re.DOTALL,
)


def _parse_json(text: str, label: str):
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.warning(f"Failed to parse {label} JSON")
        return None


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
    m = MERMAID_RE.search(markdown)
    if m:
        mermaid_diagram = m.group(1).strip()

    flashcards = None
    m = FLASHCARDS_RE.search(markdown)
    if m:
        flashcards = _parse_json(m.group(1), "flashcards")

    quiz = None
    m = QUIZ_RE.search(markdown)
    if m:
        quiz = _parse_json(m.group(1), "quiz")

    analogy: str | None = None
    m = ANALOGY_RE.search(markdown)
    if m:
        analogy = m.group(1).strip()
        if analogy.lower() == "null":
            analogy = None

    action_plan = None
    m = ACTION_PLAN_RE.search(markdown)
    if m:
        action_plan = _parse_json(m.group(1), "action_plan")

    comparison_table: str | None = None
    m = COMPARISON_TABLE_RE.search(markdown)
    if m:
        ct = m.group(1).strip()
        if ct.lower() != "null" and "|" in ct:
            comparison_table = ct

    tweet_thread = None
    m = TWEET_THREAD_RE.search(markdown)
    if m:
        tweet_thread = _parse_json(m.group(1), "tweet_thread")

    clean_markdown = STRIP_SECTIONS_RE.sub("", markdown).strip()

    return {
        "markdown": clean_markdown,
        "tags": tags,
        "summary": summary,
        "key_takeaways": key_takeaways,
        "mermaid_diagram": mermaid_diagram,
        "flashcards": flashcards,
        "quiz": quiz,
        "analogy": analogy,
        "action_plan": action_plan,
        "comparison_table": comparison_table,
        "tweet_thread": tweet_thread,
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
        max_tokens=8000,
        system=system_prompt,
        messages=[{"role": "user", "content": user_content}],
    )

    raw = response.content[0].text
    tokens_in = response.usage.input_tokens
    tokens_out = response.usage.output_tokens

    parsed = _parse_response(raw)

    note_row = db.table("notes").insert({
        "link_id": link_id,
        "markdown": parsed["markdown"],
        "summary": parsed["summary"],
        "key_takeaways": parsed["key_takeaways"],
        "tags": parsed["tags"],
        "mermaid_diagram": parsed["mermaid_diagram"],
        "flashcards": json.dumps(parsed["flashcards"]) if parsed["flashcards"] else None,
        "quiz": json.dumps(parsed["quiz"]) if parsed["quiz"] else None,
        "analogy": parsed["analogy"],
        "action_plan": json.dumps(parsed["action_plan"]) if parsed["action_plan"] else None,
        "comparison_table": parsed["comparison_table"],
        "tweet_thread": json.dumps(parsed["tweet_thread"]) if parsed["tweet_thread"] else None,
        "model": settings.anthropic_model,
        "tokens_in": tokens_in,
        "tokens_out": tokens_out,
    }).execute()

    db.table("links").update({"status": "notes_ready"}).eq("id", link_id).execute()

    napkin_content = parsed["summary"] or ""
    if parsed["key_takeaways"]:
        napkin_content += "\n" + "\n".join(f"• {t}" for t in parsed["key_takeaways"])
    try:
        from app.notes.napkin import generate_napkin_visual
        napkin_url = await generate_napkin_visual(link_id, napkin_content)
        if napkin_url and note_row.data:
            db.table("notes").update({"napkin_url": napkin_url}).eq("id", note_row.data[0]["id"]).execute()
    except Exception:
        logger.exception(f"Napkin visual generation failed for {link_id} — non-fatal")

    cost_est = round(tokens_in * 0.000003 + tokens_out * 0.000015, 4)
    logger.info(
        f"Notes done for {link_id}: {tokens_in}in/{tokens_out}out tokens, ~${cost_est}, tags={parsed['tags']}"
    )

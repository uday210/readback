import json
import logging

import httpx
import trafilatura

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


async def extract(url: str) -> dict:
    # Try trafilatura's own downloader first
    downloaded = trafilatura.fetch_url(url)

    if not downloaded:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30, headers=HEADERS) as client:
            r = await client.get(url)
            r.raise_for_status()
            downloaded = r.text

    result_json = trafilatura.extract(
        downloaded,
        include_comments=False,
        include_tables=True,
        output_format="json",
        with_metadata=True,
        favor_precision=True,
    )

    if result_json:
        data = json.loads(result_json)
        text = data.get("text", "")
        title = data.get("title") or data.get("sitename")
        author = data.get("author")
        method = "trafilatura"
    else:
        # Fallback: readability-lxml
        from readability import Document
        doc = Document(downloaded)
        title = doc.title()
        # readability returns HTML — strip tags
        import re
        raw = doc.summary()
        text = re.sub(r"<[^>]+>", " ", raw)
        text = re.sub(r"\s+", " ", text).strip()
        author = None
        method = "readability"

    if not text or len(text) < 100:
        raise ValueError(f"Could not extract meaningful text from {url}")

    return {
        "text": text,
        "title": title,
        "author": author,
        "word_count": len(text.split()),
        "extraction_method": method,
        "metadata": {},
    }

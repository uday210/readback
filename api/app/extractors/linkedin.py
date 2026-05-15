import logging
import re

import httpx

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


class LinkedInLoginWall(Exception):
    pass


async def extract(url: str) -> dict:
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=20, headers=HEADERS) as client:
            r = await client.get(url)
            html = r.text

        # Strip HTML tags
        text = re.sub(r"<[^>]+>", " ", html)
        text = re.sub(r"\s+", " ", text).strip()

        if len(text) < 200 or "authwall" in r.url.path or "login" in str(r.url):
            raise LinkedInLoginWall("LinkedIn login wall detected")

        return {
            "text": text[:15000],
            "title": None,
            "author": None,
            "word_count": len(text.split()),
            "extraction_method": "linkedin-fetch",
            "metadata": {},
        }
    except LinkedInLoginWall:
        raise
    except Exception as e:
        raise LinkedInLoginWall(f"LinkedIn fetch failed: {e}") from e

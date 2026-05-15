import logging
import re

import httpx

logger = logging.getLogger(__name__)

REPO_RE = re.compile(r"https://github\.com/([^/]+)/([^/?#]+)")
FILE_RE = re.compile(r"https://github\.com/[^/]+/[^/]+/blob/[^/]+/(.+)")


async def extract(url: str) -> dict:
    m = REPO_RE.match(url)
    if not m:
        raise ValueError(f"Cannot parse GitHub URL: {url}")

    owner, repo = m.group(1), m.group(2).rstrip(".git")
    file_m = FILE_RE.match(url)

    async with httpx.AsyncClient(timeout=20) as client:
        if file_m:
            file_path = file_m.group(1)
            raw_url = f"https://raw.githubusercontent.com/{owner}/{repo}/HEAD/{file_path}"
            r = await client.get(raw_url)
            r.raise_for_status()
            text = r.text
            title = f"{owner}/{repo}: {file_path}"
        else:
            r = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/readme",
                headers={"Accept": "application/vnd.github.v3.raw"},
            )
            if r.status_code == 404:
                raise ValueError(f"No README found for {owner}/{repo}")
            r.raise_for_status()
            text = r.text
            title = f"{owner}/{repo}"

    return {
        "text": text,
        "title": title,
        "author": owner,
        "word_count": len(text.split()),
        "extraction_method": "github-api",
        "metadata": {"owner": owner, "repo": repo},
    }

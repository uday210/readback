import logging
import re

import httpx
from youtube_transcript_api import (
    NoTranscriptFound,
    TranscriptsDisabled,
    YouTubeTranscriptApi,
)

logger = logging.getLogger(__name__)

VIDEO_ID_RE = re.compile(r"(?:v=|youtu\.be/|embed/)([A-Za-z0-9_-]{11})")
FILLER_RE = re.compile(r"\b(uh+|um+|you know)\b,?\s*", re.IGNORECASE)


def _get_video_id(url: str) -> str:
    m = VIDEO_ID_RE.search(url)
    if not m:
        raise ValueError(f"Could not extract video ID from {url}")
    return m.group(1)


def _clean_transcript(segments: list[dict]) -> str:
    text = " ".join(s["text"] for s in segments)
    text = FILLER_RE.sub(" ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


async def _get_video_metadata(video_id: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"https://www.youtube.com/watch?v={video_id}",
                headers={"Accept-Language": "en-US,en;q=0.9"},
            )
            title_m = re.search(r'"title":"([^"]+)"', r.text)
            channel_m = re.search(r'"ownerChannelName":"([^"]+)"', r.text)
            return {
                "title": title_m.group(1).replace("\\u0026", "&") if title_m else "",
                "channel": channel_m.group(1) if channel_m else "",
            }
    except Exception:
        return {"title": "", "channel": ""}


async def extract(url: str) -> dict:
    video_id = _get_video_id(url)
    segments: list[dict] = []

    try:
        segments = YouTubeTranscriptApi.get_transcript(video_id, languages=["en", "en-US"])
    except (NoTranscriptFound, TranscriptsDisabled):
        try:
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
            transcript = transcript_list.find_generated_transcript(["en", "en-US"])
            segments = transcript.fetch()
        except Exception:
            pass

    if not segments:
        raise ValueError(f"No English transcript available for video {video_id}")

    text = _clean_transcript(segments)
    meta = await _get_video_metadata(video_id)

    return {
        "text": text,
        "title": meta["title"],
        "author": meta["channel"] or None,
        "word_count": len(text.split()),
        "extraction_method": "youtube-transcript-api",
        "metadata": {"video_id": video_id, "channel": meta["channel"]},
        "og_image": f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
    }

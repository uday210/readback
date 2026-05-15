import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

ELEVENLABS_API = "https://api.elevenlabs.io/v1"

# Map voice name → ElevenLabs voice_id (names are resolved at runtime)
_VOICE_ID_CACHE: dict[str, str] = {}


async def _resolve_voice_id(name: str) -> str:
    if name in _VOICE_ID_CACHE:
        return _VOICE_ID_CACHE[name]

    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{ELEVENLABS_API}/voices",
            headers={"xi-api-key": settings.elevenlabs_api_key},
        )
        r.raise_for_status()
        voices = r.json().get("voices", [])

    for v in voices:
        if v["name"].lower() == name.lower():
            _VOICE_ID_CACHE[name] = v["voice_id"]
            return v["voice_id"]

    # Fallback: use the name as a raw voice_id
    logger.warning(f"Voice '{name}' not found by name — using as raw ID")
    _VOICE_ID_CACHE[name] = name
    return name


async def synthesize(text: str, voice_name: str) -> bytes:
    """Synthesize text with ElevenLabs and return raw mp3 bytes."""
    voice_id = await _resolve_voice_id(voice_name)

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{ELEVENLABS_API}/text-to-speech/{voice_id}",
            headers={
                "xi-api-key": settings.elevenlabs_api_key,
                "Content-Type": "application/json",
            },
            json={
                "text": text,
                "model_id": "eleven_turbo_v2",
                "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
            },
        )
        r.raise_for_status()
        return r.content

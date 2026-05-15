import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

ELEVENLABS_API = "https://api.elevenlabs.io/v1"

# Stable premade voice IDs — fallback when name lookup fails
KNOWN_VOICE_IDS: dict[str, str] = {
    "rachel": "21m00Tcm4TlvDq8ikWAM",
    "adam": "pNInz6obpgDQGcFmaJgB",
    "sarah": "EXAVITQu4vr4xnSDxMaL",
    "brian": "nPczCjzI2devNBz1zQrb",
    "alice": "Xb7hH8MSUJpSbSDYk0k2",
    "daniel": "onwK4e9ZLuTAKqWW03F9",
    "bella": "hpp4J3VqNfWAUOO0d1Us",
    "charlie": "IKne3meq5aSn9XLyUdCD",
    "george": "JBFqnCBsd6RMkjVDRZzb",
    "jessica": "cgSgspJ2msm6clMCkdW9",
    "lily": "pFZP5JQG7iQjIQuC4Bku",
    "bill": "pqHfZKP75CvOlQylNhV4",
    "eric": "cjVigY5qzO86Huf0OWal",
}

_voice_id_cache: dict[str, str] = {}


async def _list_account_voices() -> list[dict]:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{ELEVENLABS_API}/voices",
            headers={"xi-api-key": settings.elevenlabs_api_key},
        )
        r.raise_for_status()
        return r.json().get("voices", [])


async def _resolve_voice_id(name: str) -> str:
    """Resolve a voice name or ID to a valid ElevenLabs voice_id."""
    if name in _voice_id_cache:
        return _voice_id_cache[name]

    # Already looks like an ID (long alphanumeric string)
    if len(name) >= 15 and name.isalnum():
        _voice_id_cache[name] = name
        return name

    # Check known stable IDs first (no API call needed)
    known = KNOWN_VOICE_IDS.get(name.lower())
    if known:
        _voice_id_cache[name] = known
        return known

    # Fall back to searching the account's voice list
    try:
        voices = await _list_account_voices()
        for v in voices:
            if v["name"].lower() == name.lower():
                _voice_id_cache[name] = v["voice_id"]
                return v["voice_id"]

        # Last resort: use the first available voice and log a warning
        if voices:
            fallback_id = voices[0]["voice_id"]
            fallback_name = voices[0]["name"]
            logger.warning(f"Voice '{name}' not found — using '{fallback_name}' ({fallback_id})")
            _voice_id_cache[name] = fallback_id
            return fallback_id
    except Exception:
        logger.exception("Failed to list ElevenLabs voices")

    raise ValueError(f"Could not resolve ElevenLabs voice: '{name}'")


async def synthesize(text: str, voice_name: str) -> bytes:
    """Synthesize text and return raw mp3 bytes."""
    voice_id = await _resolve_voice_id(voice_name)
    logger.debug(f"TTS: voice={voice_name} → {voice_id}, chars={len(text)}")

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

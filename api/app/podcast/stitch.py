import io
import logging

logger = logging.getLogger(__name__)


def stitch_audio(segments: list[bytes], silence_ms: int = 250) -> bytes:
    """Concatenate mp3 segments with silence gaps. Returns mp3 bytes."""
    from pydub import AudioSegment

    silence = AudioSegment.silent(duration=silence_ms)
    combined = AudioSegment.empty()

    for i, seg_bytes in enumerate(segments):
        audio = AudioSegment.from_file(io.BytesIO(seg_bytes), format="mp3")
        if i > 0:
            combined += silence
        combined += audio

    buf = io.BytesIO()
    combined.export(buf, format="mp3", bitrate="80k", parameters=["-ac", "1"])
    return buf.getvalue()

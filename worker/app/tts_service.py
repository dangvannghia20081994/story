"""
TTS Service using edge-tts for text-to-speech conversion.
"""

import asyncio
import logging
from pathlib import Path
from typing import Optional

import edge_tts
from pydub import AudioSegment

from app.config import settings

logger = logging.getLogger(__name__)

# Default voice for narrator
DEFAULT_VOICE = "vi-VN-HoaiMyNeural"


class TTSService:
    """Service for converting text to speech using edge-tts."""

    def __init__(self):
        self.temp_dir = Path("/tmp/tts")
        self.temp_dir.mkdir(parents=True, exist_ok=True)

    async def synthesize(
        self,
        text: str,
        voice: str = DEFAULT_VOICE,
        output_file: Optional[Path] = None,
    ) -> Path:
        """
        Synthesize text to speech and save to file.

        Args:
            text: Text to convert to speech
            voice: Voice ID to use (e.g., vi-VN-HoaiMyNeural)
            output_file: Optional output file path

        Returns:
            Path to the generated audio file
        """
        if output_file is None:
            output_file = self.temp_dir / f"{id(text)}.mp3"

        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(str(output_file))

        logger.info(f"Synthesized audio to {output_file}")
        return output_file

    def synthesize_sync(
        self,
        text: str,
        voice: str = DEFAULT_VOICE,
        output_file: Optional[Path] = None,
    ) -> Path:
        """
        Synchronous wrapper for synthesize.

        Args:
            text: Text to convert to speech
            voice: Voice ID to use
            output_file: Optional output file path

        Returns:
            Path to the generated audio file
        """
        return asyncio.run(self.synthesize(text, voice, output_file))

    async def synthesize_segments(
        self,
        segments: list[dict],
        output_dir: Path,
    ) -> list[Path]:
        """
        Synthesize multiple text segments with different voices.

        Args:
            segments: List of dicts with 'text' and 'voice' keys
            output_dir: Directory to save output files

        Returns:
            List of paths to generated audio files
        """
        output_dir.mkdir(parents=True, exist_ok=True)
        output_files = []

        for i, segment in enumerate(segments):
            text = segment.get("text", "")
            voice = segment.get("voice", DEFAULT_VOICE)

            if not text.strip():
                continue

            output_file = output_dir / f"segment_{i:04d}.mp3"
            await self.synthesize(text, voice, output_file)
            output_files.append(output_file)

        return output_files

    def list_available_voices(self) -> list[str]:
        """
        Get list of available Vietnamese voices from edge-tts.

        Returns:
            List of voice IDs
        """
        # Common Vietnamese voices
        return [
            "vi-VN-HoaiMyNeural",
            "vi-VN-NguyenNeural",
            "vi-VN-LinhNeural",
        ]


tts_service = TTSService()
"""
Audio stitching module using pydub to combine multiple audio segments.
"""

import logging
from pathlib import Path
from typing import Optional

from pydub import AudioSegment
from pydub.generators import Sine

logger = logging.getLogger(__name__)

# Default audio settings
DEFAULT_SAMPLE_RATE = 44100
DEFAULT_CHANNELS = 1
DEFAULT_BIT_DEPTH = 16


class AudioStitcher:
    """Handles stitching multiple audio segments into one file."""

    def __init__(
        self,
        sample_rate: int = DEFAULT_SAMPLE_RATE,
        channels: int = DEFAULT_CHANNELS,
    ):
        """
        Initialize audio stitcher.

        Args:
            sample_rate: Sample rate for output audio
            channels: Number of audio channels (1=mono, 2=stereo)
        """
        self.sample_rate = sample_rate
        self.channels = channels

    def load_audio(self, file_path: Path) -> AudioSegment:
        """
        Load an audio file.

        Args:
            file_path: Path to audio file

        Returns:
            AudioSegment object
        """
        return AudioSegment.from_file(str(file_path))

    def create_silence(self, duration_ms: int) -> AudioSegment:
        """
        Create a silent audio segment.

        Args:
            duration_ms: Duration in milliseconds

        Returns:
            Silent AudioSegment
        """
        return AudioSegment.silent(duration=duration_ms)

    def concatenate(
        self,
        audio_files: list[Path],
        silence_between_ms: int = 500,
    ) -> AudioSegment:
        """
        Concatenate multiple audio files with silence between.

        Args:
            audio_files: List of paths to audio files
            silence_between_ms: Silence duration between segments (ms)

        Returns:
            Combined AudioSegment
        """
        if not audio_files:
            raise ValueError("No audio files provided")

        # Load first file
        combined = self.load_audio(audio_files[0])

        # Convert to match settings if needed
        combined = combined.set_frame_rate(self.sample_rate)
        combined = combined.set_channels(self.channels)

        # Add remaining files
        for audio_file in audio_files[1:]:
            segment = self.load_audio(audio_file)
            segment = segment.set_frame_rate(self.sample_rate)
            segment = segment.set_channels(self.channels)

            # Add silence between segments
            if silence_between_ms > 0:
                silence = self.create_silence(silence_between_ms)
                combined += silence

            combined += segment

        return combined

    def concatenate_segments(
        self,
        segments: list[AudioSegment],
        silence_between_ms: int = 500,
    ) -> AudioSegment:
        """
        Concatenate already loaded AudioSegment objects.

        Args:
            segments: List of AudioSegment objects
            silence_between_ms: Silence duration between segments (ms)

        Returns:
            Combined AudioSegment
        """
        if not segments:
            raise ValueError("No segments provided")

        combined = segments[0]
        combined = combined.set_frame_rate(self.sample_rate)
        combined = combined.set_channels(self.channels)

        for segment in segments[1:]:
            segment = segment.set_frame_rate(self.sample_rate)
            segment = segment.set_channels(self.channels)

            if silence_between_ms > 0:
                silence = self.create_silence(silence_between_ms)
                combined += silence

            combined += segment

        return combined

    def save(
        self,
        audio: AudioSegment,
        output_path: Path,
        format: str = "mp3",
    ) -> None:
        """
        Save audio segment to file.

        Args:
            audio: AudioSegment to save
            output_path: Output file path
            format: Audio format (mp3, wav, etc.)
        """
        output_path.parent.mkdir(parents=True, exist_ok=True)
        audio.export(str(output_path), format=format)
        logger.info(f"Saved audio to {output_path}")

    def get_duration(self, audio: AudioSegment) -> float:
        """
        Get duration of audio in seconds.

        Args:
            audio: AudioSegment

        Returns:
            Duration in seconds
        """
        return len(audio) / 1000.0


# Default stitcher instance
stitcher = AudioStitcher()
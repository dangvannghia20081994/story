"""
Voice mapping module for character-based TTS processing.
"""

import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

# Default narrator voice
DEFAULT_VOICE = "vi-VN-HoaiMyNeural"


class VoiceMapper:
    """Maps characters to voices for TTS processing."""

    def __init__(self, characters: Optional[dict] = None):
        """
        Initialize voice mapper with character mappings.

        Args:
            characters: Dict of character_name -> voice_config
        """
        self.characters = characters or {}
        # Build regex patterns for character detection
        self._build_patterns()

    def _build_patterns(self) -> None:
        """Build regex patterns for character name detection."""
        self.character_patterns = []
        for name in self.characters.keys():
            # Escape special regex chars and create pattern
            escaped = re.escape(name)
            # Allow for common variations (with quotes, etc)
            pattern = re.compile(f'["「」]({escaped})["」]?')
            self.character_patterns.append((name, pattern))

    def get_voice(self, character_name: str) -> str:
        """
        Get voice ID for a character.

        Args:
            character_name: Name of the character

        Returns:
            Voice ID to use
        """
        if character_name in self.characters:
            return self.characters[character_name].get("voice", DEFAULT_VOICE)
        return DEFAULT_VOICE

    def detect_character(self, text: str) -> Optional[str]:
        """
        Detect if text contains a known character name.

        Args:
            text: Text to check

        Returns:
            Character name if found, None otherwise
        """
        for name, pattern in self.character_patterns:
            if pattern.search(text):
                return name
        return None

    def parse_dialogue(self, text: str) -> list[dict]:
        """
        Parse text into dialogue segments with voice assignments.

        Args:
            text: Full text to parse

        Returns:
            List of segments with 'text', 'voice', 'character' keys
        """
        segments = []
        lines = text.split('\n')

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Try to detect character dialogue pattern
            # Pattern: "Character Name" or 「Character Name」: dialogue
            dialogue_match = re.match(r'["「]([^"」]+)["」][:：]\s*(.+)', line)

            if dialogue_match:
                character_name = dialogue_match.group(1)
                dialogue_text = dialogue_match.group(2)
                voice = self.get_voice(character_name)

                segments.append({
                    "text": dialogue_text,
                    "voice": voice,
                    "character": character_name,
                    "type": "dialogue"
                })
            else:
                # Regular narration
                segments.append({
                    "text": line,
                    "voice": DEFAULT_VOICE,
                    "character": None,
                    "type": "narration"
                })

        return segments


# Default mapper instance
voice_mapper = VoiceMapper()
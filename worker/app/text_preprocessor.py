"""
Text preprocessing module for cleaning and preparing text for TTS.
"""

import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class TextPreprocessor:
    """Handles text cleaning and preprocessing for TTS."""

    # Common noise patterns when copying from websites
    NOISE_PATTERNS = [
        (r'\s+', ' '),  # Multiple spaces to single space
        (r'\n+', '\n'),  # Multiple newlines to single
        (r'[\t\r]+', ''),  # Remove tabs and carriage returns
        (r'http[s]?://\S+', ''),  # Remove URLs
        (r'www\.\S+', ''),  # Remove www links
        (r'\[.*?\]', ''),  # Remove square bracket content (ads, etc)
        (r'\{.*?\}', ''),  # Remove curly bracket content
        (r'<[^>]+>', ''),  # Remove HTML tags
        (r'&[a-z]+;', ' '),  # Remove HTML entities
        (r'_\+', ''),  # Remove underscore plus
        (r'\.{3,}', '...'),  # Normalize multiple dots
    ]

    # Patterns to clean but preserve some structure
    CLEAN_PATTERNS = [
        (r'([。！？])\1+', r'\1'),  # Remove duplicate punctuation
        (r'^\s*[\d\-\*•]+\s*', ''),  # Remove list numbering at start
        (r'\s*[\(\[]\s*\d+\s*[\)\]]\s*', ' '),  # Remove chapter numbers in parens
    ]

    def __init__(self, lexicon: Optional[dict] = None):
        """
        Initialize preprocessor with optional lexicon.

        Args:
            lexicon: Dict of word -> replacement mappings
        """
        self.lexicon = lexicon or {}

    def clean_text(self, text: str) -> str:
        """
        Clean text by removing noise patterns.

        Args:
            text: Raw text to clean

        Returns:
            Cleaned text
        """
        cleaned = text

        # Apply noise patterns
        for pattern, replacement in self.NOISE_PATTERNS:
            cleaned = re.sub(pattern, replacement, cleaned)

        # Apply clean patterns
        for pattern, replacement in self.CLEAN_PATTERNS:
            cleaned = re.sub(pattern, replacement, cleaned)

        # Strip whitespace
        cleaned = cleaned.strip()

        return cleaned

    def apply_lexicon(self, text: str) -> str:
        """
        Apply lexicon replacements to text.

        Args:
            text: Text to process

        Returns:
            Text with lexicon applied
        """
        if not self.lexicon:
            return text

        result = text
        # Sort by length (longer first) to avoid partial replacements
        sorted_words = sorted(
            self.lexicon.items(),
            key=lambda x: len(x[0]),
            reverse=True
        )

        for original, replacement in sorted_words:
            # Use word boundary matching
            pattern = re.compile(re.escape(original), re.IGNORECASE)
            result = pattern.sub(replacement, result)

        return result

    def preprocess(self, text: str, lexicon: Optional[dict] = None) -> str:
        """
        Full preprocessing pipeline: clean + apply lexicon.

        Args:
            text: Raw text to process
            lexicon: Optional lexicon to use (overrides instance lexicon)

        Returns:
            Fully preprocessed text
        """
        # Update lexicon if provided
        if lexicon:
            self.lexicon = lexicon

        # Clean first, then apply lexicon
        text = self.clean_text(text)
        text = self.apply_lexicon(text)

        return text

    def split_into_sentences(self, text: str) -> list[str]:
        """
        Split text into sentences for processing.

        Args:
            text: Text to split

        Returns:
            List of sentences
        """
        # Split on common sentence endings
        sentences = re.split(r'([。！？.!?])', text)

        # Reconstruct with punctuation
        result = []
        for i in range(0, len(sentences) - 1, 2):
            sent = sentences[i].strip()
            punct = sentences[i + 1] if i + 1 < len(sentences) else ""
            if sent:
                result.append(sent + punct)

        return result


# Default preprocessor instance
preprocessor = TextPreprocessor()
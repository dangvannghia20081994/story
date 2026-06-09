import { normalizeWhitespace } from './utils.js';

const blockedSelector = [
  'script',
  'style',
  'noscript',
  'iframe',
  'form',
  'button',
  'input',
  'select',
  'textarea',
  '.ads',
  '.advertisement',
  '.google-auto-placed',
  '.signature',
  '[class*="ads"]',
  '[id*="ads"]'
].join(',');

export function cleanChapterContent($, element) {
  const $content = $(element).clone();
  $content.find(blockedSelector).remove();
  $content.find('br').replaceWith('\n');
  $content.find('p, div, section, article, h1, h2, h3').append('\n\n');

  return cleanExtractedText($content.text());
}

export function cleanExtractedText(value) {
  return normalizeContentLines(
    stripLeadingEditorArtifacts(
      stripMarkdownEmphasis(
        normalizeStraightQuotes(
          normalizeWhitespace(value)
        )
      )
    )
  );
}

function normalizeContentLines(value) {
  const lines = value
    .split('\n')
    .map((line) => normalizeChapterTitle(line).replace(/[ \t]+/g, ' ').trim())
    .map((line) => line.replace(promoBanner, '').trim())
    .filter((line) => line && !/^(?:\.{3,}|…+|\?{3,})$/.test(line))
    .filter((line) => !isAdLine(line));

  return normalizeWhitespace(reflowBrokenLines(stripShopeePrompt(lines)).join('\n'));
}

// Strip injected ads from already-extracted chapter text (the line-level junk
// filters, without re-running the full extraction/reflow pipeline). Used to
// re-clean previously downloaded chapters in place. Operating per line keeps
// existing paragraph breaks intact.
export function stripAds(content) {
  const lines = String(content || '')
    .split('\n')
    .map((line) => line.replace(promoBanner, '').trim())
    .filter((line) => line && !isAdLine(line));

  return stripShopeePrompt(lines).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Per-line junk injected by the source/translator that isn't real chapter
// text: site watermarks, translator promos, and "open the app" prompts. These
// arrive as standalone lines (the source splits content into one line per
// word/fragment), so we drop them before reflow re-joins paragraphs.
// NOTE: avoid `\b` next to Vietnamese letters — JS `\b` only sees ASCII word
// chars, so a boundary after e.g. "tải" never matches. Use whitespace/anchors.
const adLinePatterns = [
  // Site watermark, e.g. "[Truyện được đăng tải duy nhất tại MonkeyDD.com - https://...]"
  /^\[?\s*truyện\s+được\s+đăng\s+tải(?:\s|$)/iu,
  // Any URL, including bare domains with no scheme, e.g. "monkeydd.com/...chuong-6.html.]"
  /https?:\/\/\S+/iu,
  /\b(?:monkeydd|tvtruyen|truyentv)\.\S+/iu,
  // SEO footer auto-appended after a chapter, e.g. "Chương 9 vừa kết thúc với
  // nhiều diễn biến hấp dẫn trong Truyện … trên TruyenTV." or "Bạn vừa đọc xong
  // chương 10 của Truyện … (Dịch) trên TruyenTV …". Anchor on the site name
  // next to "Truyện/chương" so it can't match real prose.
  /vừa\s+kết\s+thúc\s+với\s+nhiều\s+diễn\s+biến\s+hấp\s+dẫn/iu,
  /(?:trên|tại)\s+TruyenTV\b/iu,
  // Translator promo lines (emoji-led shout-outs, page follows, thank-yous).
  // Match a curated set of decorative food/heart emoji that only appear in
  // promo lines — NOT a blanket emoji match, since real text uses pictographic
  // symbols too (e.g. Pokémon "Nidoran♀/♂").
  /[🍒🍑🥰😍💋🫶💖🌸✨]/u,
  /\bfollow\s+(?:page|fanpage)\b/iu,
  /^cảm ơn các bác(?:\s|$)/iu
];

// Some translators prepend a promo banner ("🍊 Quéo còm các bác ghé nhà Xoăn …
// Follow Fanpage … nhé ạ ^^") onto the FIRST real sentence of the chapter, so
// the whole thing arrives as one line. Dropping the line would lose that
// sentence, so excise only the banner (from its start through the "^^" / "nhé
// ạ" sign-off) and keep the trailing story text.
const promoBanner = /^.*?\bquéo\s+còm\b[\s\S]*?(?:\^\^|nhé\s+ạ\s*\^*)\s*/iu;

function isAdLine(line) {
  return adLinePatterns.some((pattern) => pattern.test(line));
}

// The "open Shopee to keep reading" prompt has no link/emoji to anchor on, so
// match the whole run from the opening "Mời Quý độc giả" through the phrase
// that ends it ("...tiếp tục đọc ... chương truyện!"). It can arrive either as
// several plain lines (live crawl, one fragment per line) or already merged
// onto a single line, so handle both: strip whole lines that fall inside the
// run, and excise the run from any single line that contains both ends.
const shopeeStart = /mời\s+quý\s+độc\s+giả/iu;
const shopeeEnd = /tiếp tục đọc (?:toàn bộ )?chương truyện\s*!?/iu;
const shopeeInline = /mời\s+quý\s+độc\s+giả[\s\S]*?tiếp tục đọc (?:toàn bộ )?chương truyện\s*!?/iu;

function stripShopeePrompt(lines) {
  const start = lines.findIndex((line) => shopeeStart.test(line));

  if (start === -1) {
    return lines;
  }

  // Prompt fully contained in one line: excise it in place, keep the line.
  if (shopeeInline.test(lines[start])) {
    const cleaned = lines[start].replace(shopeeInline, '').trim();
    const rest = stripShopeePrompt(lines.slice(start + 1));
    return cleaned
      ? [...lines.slice(0, start), cleaned, ...rest]
      : [...lines.slice(0, start), ...rest];
  }

  // Prompt spans multiple lines: drop the whole run through its end line.
  const endOffset = lines.slice(start).findIndex((line) => shopeeEnd.test(line));

  if (endOffset === -1) {
    return [...lines.slice(0, start), ...lines.slice(start + 1)];
  }

  return [...lines.slice(0, start), ...lines.slice(start + endOffset + 1)];
}

// A real paragraph break in the source always falls after sentence-ending
// punctuation or a closing quote.
const sentenceBoundary = /[.!?…:;"'”’»)\]}]$/u;

// Some sources wrap individual words in their own block element (or split them
// with <br>) as an anti-copy measure, so a single paragraph arrives split
// across many one-word lines. Re-join a line onto the previous one unless the
// previous line already ended at a sentence/paragraph boundary — that keeps
// genuine paragraph breaks while healing the artificial mid-sentence ones.
// Standalone numeric lines (section markers) stay on their own line.
function reflowBrokenLines(lines) {
  const paragraphs = [];

  for (const line of lines) {
    const previous = paragraphs[paragraphs.length - 1];
    const startsNewParagraph =
      previous === undefined ||
      /^\d+$/.test(line) ||
      /^\d+$/.test(previous) ||
      sentenceBoundary.test(previous);

    if (startsNewParagraph) {
      paragraphs.push(line);
    } else {
      // Punctuation that was isolated on its own line attaches to the previous
      // word with no separating space (e.g. "trước" + "." -> "trước.").
      const separator = /^[.,!?…:;)\]}»"']/u.test(line) ? '' : ' ';
      paragraphs[paragraphs.length - 1] = `${previous}${separator}${line}`;
    }
  }

  return paragraphs;
}

export function normalizeChapterTitle(value) {
  const line = String(value || '').replace(/\s+/g, ' ').trim().split(/\s+\/\s+/u).at(-1);
  const numberedHeading = line.match(/^#\s*(\d+)\s*\.\s*(.+)$/u);

  if (numberedHeading) {
    const [, chapterNumber, title] = numberedHeading;
    const existingChapterPrefix = /^chương\s*\d+/iu;

    if (existingChapterPrefix.test(title)) {
      return title.trim();
    }

    return `Chương ${Number(chapterNumber)}: ${title.trim()}`;
  }

  return line.replace(/^#\s*\d+\s*[\.\):：]\s*/u, '').trim();
}

function stripMarkdownEmphasis(value) {
  return value
    .replace(/\*\*([^*\n][\s\S]*?[^*\n])\*\*/g, '$1')
    .replace(/(^|[^\w*])\*([^*\n][^*\n]*?[^*\n])\*(?=[^\w*]|$)/g, '$1$2');
}

function normalizeStraightQuotes(value) {
  return value
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
}

function stripLeadingEditorArtifacts(value) {
  const artifactPattern = /^(?:biên tập lại|văn bản đã biên tập|dưới đây là văn bản đã được biên tập lại)\s*[:：.]?\s*$/iu;
  const lines = value.split('\n');

  while (lines.length && !lines[0].trim()) {
    lines.shift();
  }

  while (lines.length && artifactPattern.test(lines[0].trim())) {
    lines.shift();

    while (lines.length && !lines[0].trim()) {
      lines.shift();
    }
  }

  return lines.join('\n');
}

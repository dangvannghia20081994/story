import * as cheerio from 'cheerio';
import { normalizeWhitespace, resolveUrl } from './utils.js';

// Path segments that are site navigation / category pages, never an individual
// novel. A novel on tvtruyen.ink lives at a single top-level `.html` segment
// (e.g. /tien-vo-de-ton-dich.html), so anything under these prefixes is skipped.
const NON_NOVEL_PREFIXES = [
  'the-loai',
  'tac-gia',
  'tim-kiem',
  'dang-nhap',
  'dang-ky',
  'lien-he',
  'gioi-thieu',
  'dieu-khoan',
  'chinh-sach',
  'bang-xep-hang',
  'user',
  'account',
  'page'
];

// Listing/filter pages without a `.html` suffix (e.g. /duoi-100-chuong).
const NON_NOVEL_EXACT = new Set([
  'duoi-100-chuong',
  '100-500-chuong',
  '500-1000-chuong',
  'tren-1000-chuong'
]);

// Parse a listing/home page and return the distinct novel links found on it.
// Each entry is { title, url } pointing at a novel detail page that
// `crawlNovel` can consume directly.
export function parseStoryList(html, pageUrl) {
  const $ = cheerio.load(html);
  const base = new URL(pageUrl);
  const seen = new Set();
  const stories = [];

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');

    if (!href) {
      return;
    }

    let url;

    try {
      url = resolveUrl(href, pageUrl);
    } catch {
      return;
    }

    const parsed = new URL(url);

    if (parsed.host !== base.host) {
      return;
    }

    if (!isNovelPath(parsed.pathname)) {
      return;
    }

    // Normalize away query/hash so the same novel linked from several widgets
    // (hot list, sidebar, etc.) collapses to one entry.
    const canonical = `${parsed.origin}${parsed.pathname}`;

    if (seen.has(canonical)) {
      return;
    }

    seen.add(canonical);
    stories.push({
      title: extractTitle($, element) || titleFromPath(parsed.pathname),
      url: canonical
    });
  });

  return stories;
}

// Pick a human-readable title for a novel link. Hot-list cards wrap a cover
// image whose only text is a "VIP"/"Full" badge and a view count, so the
// anchor's own text is useless there. Fall back through: the anchor `title`
// attr, then a cover `img[alt]` (cleaned of the "Hình ảnh truyện " prefix)
// found in the link or its surrounding card, then the anchor text if it looks
// like a real title rather than a badge/number.
function extractTitle($, element) {
  const $el = $(element);
  const attrTitle = normalizeWhitespace($el.attr('title'));

  if (isMeaningfulTitle(attrTitle)) {
    return attrTitle;
  }

  const card = $el.closest('[itemscope], .comic-card, li, .item').first();
  const scope = card.length ? card : $el;
  const imgAlt = normalizeWhitespace(scope.find('img[alt]').first().attr('alt'))
    .replace(/^Hình ảnh truyện\s*/iu, '')
    .trim();

  if (isMeaningfulTitle(imgAlt)) {
    return imgAlt;
  }

  const text = normalizeWhitespace($el.text());
  return isMeaningfulTitle(text) ? text : '';
}

// Reject badge/count-only text like "VIP", "Full\n\nVIP\n\n475,306".
function isMeaningfulTitle(value) {
  if (!value) {
    return false;
  }

  const collapsed = value.replace(/\s+/g, ' ').trim();
  const stripped = collapsed.replace(/\b(VIP|Full)\b/giu, '').replace(/[\d.,]+/g, '').trim();
  return stripped.length >= 2;
}

function isNovelPath(pathname) {
  const segments = pathname.split('/').filter(Boolean);

  // Novels are a single top-level segment ending in .html.
  if (segments.length !== 1) {
    return false;
  }

  const segment = segments[0];

  if (NON_NOVEL_EXACT.has(segment)) {
    return false;
  }

  const slug = segment.replace(/\.html?$/i, '');

  if (NON_NOVEL_PREFIXES.includes(slug)) {
    return false;
  }

  // Require the .html suffix that novel detail pages use, so chapter links
  // (which sit under /<novel>/<chapter> and have 2+ segments) and bare
  // listing slugs are excluded.
  return /\.html?$/i.test(segment);
}

function titleFromPath(pathname) {
  const segment = pathname.split('/').filter(Boolean).at(-1) || 'novel';
  return segment.replace(/\.html?$/i, '').replace(/[-_]+/g, ' ');
}

import * as cheerio from 'cheerio';
import { cleanChapterContent, normalizeChapterTitle } from './cleaner.js';
import { normalizeWhitespace, resolveUrl } from './utils.js';

export function parseNovelPage(html, pageUrl, config) {
  const $ = cheerio.load(html);
  const selectors = config.selectors;
  const title = normalizeWhitespace($(selectors.title).first().text()) || fallbackTitleFromUrl(pageUrl);
  const author = cleanAuthor(normalizeWhitespace($(selectors.author).first().text()));
  const novelPathPrefix = novelChapterPathPrefix(pageUrl);
  const seen = new Set();
  const chapters = [];

  $(selectors.chapterList).each((_, element) => {
    const href = $(element).attr('href');
    const label = normalizeWhitespace($(element).text());

    if (!href || !label) {
      return;
    }

    const url = resolveUrl(href, pageUrl);
    const chapterNumber = chapterNumberFromLabel(label);

    if (seen.has(url) || url === pageUrl || !isSameNovelChapterUrl(url, novelPathPrefix) || !chapterNumber) {
      return;
    }

    seen.add(url);
    chapters.push({
      index: chapters.length + 1,
      title: normalizeChapterTitle(label),
      url,
      order: chapterNumber
    });
  });

  chapters.sort((a, b) => a.order - b.order);
  chapters.forEach((chapter, index) => {
    chapter.index = index + 1;
  });

  return {
    metadata: {
      title,
      author,
      sourceUrl: pageUrl,
      site: config.name,
      crawledAt: new Date().toISOString()
    },
    chapters,
    paginationUrls: parsePaginationUrls($, pageUrl)
  };
}

export function mergeChapterLists(chapterLists) {
  const seen = new Set();
  const chapters = [];

  for (const chapterList of chapterLists) {
    for (const chapter of chapterList) {
      if (seen.has(chapter.url)) {
        continue;
      }

      seen.add(chapter.url);
      chapters.push({
        ...chapter,
        order: chapter.order ?? chapterNumberFromLabel(chapter.title) ?? chapters.length + 1
      });
    }
  }

  chapters.sort((a, b) => a.order - b.order);
  chapters.forEach((chapter, index) => {
    chapter.index = index + 1;
    delete chapter.order;
  });

  return chapters;
}

export function parseChapterPage(html, chapterInfo, config) {
  const $ = cheerio.load(html);
  const title = normalizeChapterTitle($(config.selectors.chapterTitle).first().text()) || chapterInfo.title;
  const contentElement = findChapterContentElement($, config.selectors.chapterContent);

  if (!contentElement.length) {
    throw new Error(`Chapter content selector did not match: ${config.selectors.chapterContent}`);
  }

  const content = cleanChapterContent($, contentElement);

  if (!content) {
    throw new Error('Chapter content is empty after cleaning');
  }

  return {
    index: chapterInfo.index,
    title,
    url: chapterInfo.url,
    content,
    downloadedAt: new Date().toISOString()
  };
}

function fallbackTitleFromUrl(pageUrl) {
  const pathname = new URL(pageUrl).pathname;
  const lastSegment = pathname.split('/').filter(Boolean).at(-1) || 'novel';
  return lastSegment.replace(/\.html?$/i, '').replace(/[-_]+/g, ' ');
}

function cleanAuthor(value) {
  return normalizeWhitespace(value.replace(/^Tác giả:\s*/iu, ''));
}

function novelChapterPathPrefix(pageUrl) {
  const pathname = new URL(pageUrl).pathname;
  const firstSegment = pathname.split('/').filter(Boolean)[0] || '';
  return `/${firstSegment.replace(/\.html?$/i, '')}/`;
}

function isSameNovelChapterUrl(url, novelPathPrefix) {
  return new URL(url).pathname.startsWith(novelPathPrefix);
}

function chapterNumberFromLabel(label) {
  const match = normalizeWhitespace(label).match(/^(?:#\s*)?(\d+)\s*[\.\):：]|^Chương\s+(\d+)/iu);
  const value = match?.[1] || match?.[2];
  return value ? Number.parseInt(value, 10) : null;
}

function findChapterContentElement($, selector) {
  const configured = $(selector).first();

  if (configured.length) {
    return configured;
  }

  let best = null;
  let bestLength = 0;

  $('article, main, [class*="chapter"], [id*="chapter"], [class*="content"], [id*="content"]').each((_, element) => {
    const textLength = normalizeWhitespace($(element).text()).length;

    if (textLength > bestLength) {
      best = element;
      bestLength = textLength;
    }
  });

  return best ? $(best) : configured;
}

function parsePaginationUrls($, pageUrl) {
  const pageNumbers = new Set();

  $('a[href*="page="]').each((_, element) => {
    const href = $(element).attr('href');

    if (!href) {
      return;
    }

    const resolved = new URL(resolveUrl(href, pageUrl));
    const pageNumber = Number.parseInt(resolved.searchParams.get('page') || '', 10);

    if (Number.isFinite(pageNumber) && pageNumber > 1) {
      pageNumbers.add(pageNumber);
    }
  });

  const maxPage = Math.max(1, ...pageNumbers);
  const urls = [];

  for (let pageNumber = 2; pageNumber <= maxPage; pageNumber += 1) {
    const url = new URL(pageUrl);
    url.searchParams.set('page', String(pageNumber));
    url.hash = '';
    urls.push(url.toString());
  }

  return urls;
}

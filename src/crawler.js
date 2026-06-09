import axios from 'axios';
import { buildEpub, buildMarkdown, buildText } from './exporter.js';
import { mergeChapterLists, parseChapterPage, parseNovelPage } from './parser.js';
import {
  getNovelPaths,
  prepareNovelDirs,
  readCachedCatalog,
  readCachedChapter,
  readCachedMetadata,
  saveCatalogOutput,
  saveChapter,
  saveNovelMeta,
  saveFailedResults,
  saveOutput
} from './storage.js';
import { mapWithConcurrency, resolveUrl, sleep, toSlug } from './utils.js';

export async function crawlNovel(novelUrl, config, options = {}) {
  const requestConfig = config.request || {};
  const client = createClient(requestConfig);
  const urlSlug = toSlug((new URL(novelUrl).pathname.split('/').filter(Boolean)[0] || new URL(novelUrl).pathname).replace(/\.html?$/i, ''));
  const cachedPaths = getNovelPaths(urlSlug);

  // Re-fetch the chapter list (instead of trusting the cached catalog) so a
  // re-crawl picks up newly published chapters and grows chapterCount. This is
  // automatic for a full re-crawl; skipped for range/limit crawls (where the
  // cache is enough) and when the caller opts out with --no-refresh-catalog.
  const isFullCrawl = !options.fromIndex && !options.toIndex && !options.maxChapters;
  const refreshCatalog = options.refreshCatalog || (isFullCrawl && !options.noRefreshCatalog);

  const cachedMetadata = !refreshCatalog ? await readCachedMetadata(cachedPaths) : null;
  const cachedCatalog = !refreshCatalog ? await readCachedCatalog(cachedPaths) : null;

  let metadata = cachedMetadata;
  let parsedChapters = cachedCatalog;
  let hasCompleteCatalog = Boolean(cachedCatalog);

  if (metadata && Array.isArray(parsedChapters) && parsedChapters.length) {
    console.log(`Using cached chapter catalog with ${parsedChapters.length} chapters.`);
  } else {
    await assertRobotsAllowed(client, novelUrl, requestConfig.userAgent);

    console.log(`Fetching novel page: ${novelUrl}`);
    const novelHtml = await fetchWithRetry(client, novelUrl, requestConfig);
    const firstPage = parseNovelPage(novelHtml, novelUrl, config);
    metadata = firstPage.metadata;
    const catalog = await collectAllChapters(client, firstPage, config, requestConfig, options);
    parsedChapters = catalog.chapters;
    hasCompleteCatalog = catalog.complete;
  }

  const rangedChapters = selectChapterRange(parsedChapters, options);
  const chapters = options.maxChapters ? rangedChapters.slice(0, options.maxChapters) : rangedChapters;
  const slug = toSlug(metadata.title || new URL(novelUrl).pathname);
  const paths = getNovelPaths(slug);

  await prepareNovelDirs(paths);

  if (!chapters.length) {
    throw new Error('No chapters found. Check config.selectors.chapterList.');
  }

  console.log(`Found ${parsedChapters.length} chapters for "${metadata.title}".`);
  await saveCatalogOutput(paths, metadata, parsedChapters, { cacheCatalog: hasCompleteCatalog });

  if (options.maxChapters && parsedChapters.length > chapters.length) {
    console.log(`Limiting crawl to first ${chapters.length} chapters.`);
  }

  if (options.fromIndex || options.toIndex) {
    const from = options.fromIndex || 1;
    const to = options.toIndex || parsedChapters.length;
    console.log(`Using catalog index range ${from}-${to}, selected ${rangedChapters.length} chapters.`);
  }

  if (options.listOnly) {
    const cacheNote = hasCompleteCatalog ? '' : ' (partial range catalog, not cached as complete)';
    console.log(`Saved chapter catalog with ${parsedChapters.length} chapters to ${paths.chaptersPath}${cacheNote}`);
    return;
  }

  const downloaded = [];
  const failed = [];
  const delayMs = requestConfig.delayMs ?? 1200;
  const concurrency = Math.max(1, options.concurrency ?? requestConfig.concurrency ?? 1);
  let processed = 0;

  if (concurrency > 1) {
    console.log(`Downloading with concurrency ${concurrency} and ${delayMs}ms delay per worker.`);
  }

  // Process each chapter through a bounded pool. Each worker sleeps `delayMs`
  // before its own fetch, so the per-host request rate is roughly
  // concurrency / delayMs — keep concurrency modest to stay polite.
  await mapWithConcurrency(chapters, concurrency, async (chapterInfo, selectedIndex) => {
    const cached = await readCachedChapter(paths, chapterInfo.index);

    if (!options.force && isUsableCachedChapter(cached, requestConfig)) {
      downloaded.push(cached);
      processed += 1;
      console.log(`Skip cached catalog index ${chapterInfo.index} (${processed}/${chapters.length}): ${cached.title}`);
      return;
    }

    // Stagger workers so they don't all hit the server at the same instant,
    // then hold the configured delay before each fetch.
    if (selectedIndex > 0) {
      await sleep(delayMs);
    }

    try {
      const chapter = await downloadChapter(client, chapterInfo, config, requestConfig, paths);
      downloaded.push(chapter);
      processed += 1;
      console.log(`Downloaded catalog index ${chapterInfo.index} (${processed}/${chapters.length}): ${chapter.title}`);
    } catch (error) {
      failed.push({
        ...chapterInfo,
        error: error?.message || String(error),
        failedAt: new Date().toISOString()
      });
      processed += 1;
      console.error(`Failed ${chapterInfo.index} (${processed}/${chapters.length}): ${error?.message || String(error)}`);
    }
  });

  // Automatically retry chapters that failed in the main pass. High concurrency
  // is the usual cause of timeouts/trickle hangs, so retry at a gentler rate to
  // recover them without a manual second run. Each round only retries what is
  // still failing; we stop once a round recovers nothing.
  if (failed.length && options.retryFailed !== false) {
    await retryFailedChapters({
      client,
      config,
      requestConfig,
      paths,
      downloaded,
      failed,
      delayMs,
      mainConcurrency: concurrency,
      maxRounds: options.retryRounds ?? 2
    });
  }

  const sortedChapters = downloaded.sort((a, b) => a.index - b.index);
  const remainingFailed = await saveFailedResults(paths, failed, sortedChapters.map((chapter) => chapter.url));
  await saveOutput(paths, metadata, sortedChapters, buildMarkdown(metadata, sortedChapters), buildText(metadata, sortedChapters));
  await buildEpub(paths.fullEpubPath, metadata, sortedChapters);

  console.log(`Saved ${sortedChapters.length} chapters to ${paths.outputDir}`);

  if (remainingFailed.length) {
    console.log(`Failed chapters written to ${paths.failedPath}`);
  }
}

// Fetch, parse, validate, and persist a single chapter. Wrapped in an absolute
// deadline so a hung request can never stall the pool worker that runs it.
async function downloadChapter(client, chapterInfo, config, requestConfig, paths) {
  return withTimeout(
    (async () => {
      await assertRobotsAllowed(client, chapterInfo.url, requestConfig.userAgent);
      const chapterHtml = await fetchWithRetry(client, chapterInfo.url, requestConfig);
      const parsed = parseChapterPage(chapterHtml, chapterInfo, config);
      validateChapter(parsed, requestConfig);
      await saveChapter(paths, parsed);
      return parsed;
    })(),
    chapterDeadlineMs(requestConfig),
    `Chapter ${chapterInfo.index} timed out`
  );
}

// Retry the chapters still in `failed` over a few gentler rounds, mutating
// `downloaded`/`failed` in place as chapters recover. Stops early once a round
// recovers nothing (the remaining failures are likely persistent, e.g. a dead
// page), so we never loop forever. `downloadFn` is injectable for testing.
export async function retryFailedChapters({
  client,
  config,
  requestConfig,
  paths,
  downloaded,
  failed,
  delayMs,
  mainConcurrency,
  maxRounds,
  downloadFn = downloadChapter,
  retryDelayMs: retryDelayOverride
}) {
  // Gentler than the main pass: high concurrency is what triggers the
  // timeouts/trickle hangs in the first place.
  const retryConcurrency = Math.max(1, Math.min(mainConcurrency, 5));
  const retryDelayMs = retryDelayOverride ?? Math.max(delayMs, 800);

  for (let round = 1; round <= maxRounds && failed.length; round += 1) {
    const pending = failed.splice(0, failed.length);
    console.log(`Retry round ${round}/${maxRounds}: ${pending.length} failed chapter(s) at concurrency ${retryConcurrency}.`);

    let recovered = 0;

    await mapWithConcurrency(pending, retryConcurrency, async (chapterInfo, selectedIndex) => {
      if (selectedIndex > 0) {
        await sleep(retryDelayMs);
      }

      try {
        const chapter = await downloadFn(client, chapterInfo, config, requestConfig, paths);
        downloaded.push(chapter);
        recovered += 1;
        console.log(`Recovered index ${chapterInfo.index}: ${chapter.title}`);
      } catch (error) {
        failed.push({
          ...chapterInfo,
          error: error?.message || String(error),
          failedAt: new Date().toISOString()
        });
        console.error(`Still failed ${chapterInfo.index}: ${error?.message || String(error)}`);
      }
    });

    console.log(`Retry round ${round} recovered ${recovered}, ${failed.length} still failing.`);

    if (recovered === 0) {
      break;
    }
  }
}

function selectChapterRange(chapters, options) {
  const from = options.fromIndex || 1;
  const to = options.toIndex || chapters.length;

  if (from > to) {
    throw new Error(`Invalid chapter range: from-index ${from} is greater than to-index ${to}`);
  }

  return chapters.filter((chapter) => chapter.index >= from && chapter.index <= to);
}

function isUsableCachedChapter(chapter, requestConfig) {
  if (!chapter?.content) {
    return false;
  }

  return chapter.content.trim().length >= minimumContentChars(requestConfig);
}

function validateChapter(chapter, requestConfig) {
  const minContentChars = minimumContentChars(requestConfig);

  if (chapter.content.trim().length < minContentChars) {
    throw new Error(`Chapter content is too short after cleaning (${chapter.content.trim().length} chars, minimum ${minContentChars})`);
  }
}

function minimumContentChars(requestConfig) {
  return requestConfig.minContentChars ?? 20;
}

// Fetch `pageUrls` in sequential batches of `batchSize`, each batch fetched in
// parallel via `fetchPage(url, indexInBatch)` (returns that page's chapter
// array). After every batch, if any page in it had zero chapters we've reached
// the end of the catalog, so we stop fetching the NEXT batch. Pages WITH
// chapters in the same batch are still kept, so one transient empty page can't
// drop real chapters. Returns the kept per-page chapter arrays in order.
export async function collectPagedLists(pageUrls, batchSize, fetchPage) {
  const size = Math.max(1, batchSize);
  const lists = [];

  for (let start = 0; start < pageUrls.length; start += size) {
    const batch = pageUrls.slice(start, start + size);
    const fetched = await mapWithConcurrency(batch, size, (url, index) => fetchPage(url, index));
    let hitEmptyPage = false;

    for (const chapters of fetched) {
      if (!chapters || !chapters.length) {
        hitEmptyPage = true;
      } else {
        lists.push(chapters);
      }
    }

    if (hitEmptyPage) {
      console.log('Empty chapter list page reached; stopping catalog scan.');
      break;
    }
  }

  return lists;
}

async function collectAllChapters(client, firstPage, config, requestConfig, options) {
  const chapterLists = [firstPage.chapters];
  const catalogFetchLimit = requiredCatalogFetchLimit(options);

  if (catalogFetchLimit && firstPage.chapters.length >= catalogFetchLimit) {
    return {
      chapters: mergeChapterLists(chapterLists),
      complete: firstPage.paginationUrls.length === 0
    };
  }

  if (firstPage.paginationUrls.length) {
    console.log(`Found ${firstPage.paginationUrls.length + 1} chapter list pages.`);
  }

  // When a chapter limit is set we only need enough list pages to cover it.
  // Estimate pages-per-fetch from the first page's chapter count so we don't
  // fetch the whole (possibly huge) catalog just to crawl the first N chapters.
  const perPage = Math.max(1, firstPage.chapters.length || 15);
  let pagesToFetch = firstPage.paginationUrls;
  let complete = true;

  if (catalogFetchLimit) {
    const remaining = Math.max(0, catalogFetchLimit - firstPage.chapters.length);
    const neededPages = Math.ceil(remaining / perPage);

    if (neededPages < firstPage.paginationUrls.length) {
      pagesToFetch = firstPage.paginationUrls.slice(0, neededPages);
      complete = false;
    }
  }

  const concurrency = Math.max(1, options.concurrency ?? requestConfig.concurrency ?? 1);
  const pagedLists = await collectPagedLists(pagesToFetch, concurrency, async (pageUrl, index) => {
    if (index > 0) {
      await sleep(requestConfig.delayMs ?? 1200);
    }

    await assertRobotsAllowed(client, pageUrl, requestConfig.userAgent);
    console.log(`Fetching chapter list page: ${pageUrl}`);
    const html = await fetchWithRetry(client, pageUrl, requestConfig);
    return parseNovelPage(html, pageUrl, config).chapters;
  });

  chapterLists.push(...pagedLists);

  return {
    chapters: mergeChapterLists(chapterLists),
    // An empty page means we found the true end, so the catalog is still
    // complete (we stopped because there was nothing more, not because we
    // truncated for a limit).
    complete
  };
}

export function requiredCatalogFetchLimit(options) {
  if (options.toIndex) {
    return options.toIndex;
  }

  if (options.maxChapters) {
    return (options.fromIndex || 1) + options.maxChapters - 1;
  }

  return null;
}

function createClient(requestConfig) {
  return axios.create({
    timeout: requestConfig.timeoutMs ?? 20000,
    headers: {
      'User-Agent': requestConfig.userAgent ?? 'Mozilla/5.0 NovelCrawler/1.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    },
    responseType: 'text',
    transformResponse: [(data) => data]
  });
}

async function fetchWithRetry(client, url, requestConfig) {
  const maxRetries = requestConfig.maxRetries ?? 3;
  const timeoutMs = requestConfig.timeoutMs ?? 20000;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    // Axios's own `timeout` only fires when the socket goes idle. Under high
    // concurrency a server can trickle bytes (or hold a half-open response)
    // forever, which leaves one pool worker hung on the last chapter. An
    // AbortController with a hard deadline cuts the request regardless of
    // whether data is dribbling in.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await client.get(url, { signal: controller.signal });

      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.data;
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        await sleep((requestConfig.delayMs ?? 1200) * attempt);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError;
}

// Total time a single chapter may take across all its retries, plus a buffer
// for the inter-retry backoff sleeps. Beyond this the worker is force-failed.
function chapterDeadlineMs(requestConfig) {
  const timeoutMs = requestConfig.timeoutMs ?? 20000;
  const maxRetries = requestConfig.maxRetries ?? 3;
  const delayMs = requestConfig.delayMs ?? 1200;
  // retries * per-request timeout + cumulative backoff between attempts.
  return timeoutMs * maxRetries + delayMs * maxRetries * maxRetries + 5000;
}

function withTimeout(promise, ms, message) {
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}

const robotsCache = new Map();

async function assertRobotsAllowed(client, targetUrl, userAgent = '*') {
  const url = new URL(targetUrl);
  const robotsUrl = `${url.origin}/robots.txt`;

  if (!robotsCache.has(robotsUrl)) {
    try {
      const response = await client.get(robotsUrl);
      robotsCache.set(robotsUrl, parseRobots(response.data));
    } catch {
      robotsCache.set(robotsUrl, []);
    }
  }

  const rules = robotsCache.get(robotsUrl);
  const pathname = `${url.pathname}${url.search}`;
  const applicable = rules.filter((rule) => rule.agent === '*' || userAgent.toLowerCase().includes(rule.agent));
  const disallowed = applicable
    .filter((rule) => rule.type === 'disallow' && rule.path && pathname.startsWith(rule.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
  const allowed = applicable
    .filter((rule) => rule.type === 'allow' && pathname.startsWith(rule.path))
    .sort((a, b) => b.path.length - a.path.length)[0];

  if (disallowed && (!allowed || disallowed.path.length > allowed.path.length)) {
    throw new Error(`Blocked by robots.txt: ${targetUrl}`);
  }
}

function parseRobots(raw) {
  const rules = [];
  let agents = [];

  for (const line of String(raw).split('\n')) {
    const clean = line.replace(/#.*/, '').trim();

    if (!clean) {
      continue;
    }

    const separator = clean.indexOf(':');

    if (separator === -1) {
      continue;
    }

    const key = clean.slice(0, separator).trim().toLowerCase();
    const value = clean.slice(separator + 1).trim();

    if (key === 'user-agent') {
      agents = [value.toLowerCase()];
    } else if (key === 'allow' || key === 'disallow') {
      for (const agent of agents) {
        const path = value
          ? resolveUrl(value, 'https://placeholder.local').replace('https://placeholder.local', '')
          : '';

        rules.push({
          agent,
          type: key,
          path
        });
      }
    }
  }

  return rules;
}

#!/usr/bin/env node

import 'dotenv/config';
import axios from 'axios';
import { crawlNovel } from './crawler.js';
import { parseStoryList } from './listing.js';
import { loadConfig } from './utils.js';

// Default concurrency for chapter downloads within each novel. The user asked
// for 40 chapters in parallel per story ("mỗi tab 1 truyện với concurrent = 40").
const DEFAULT_CHAPTER_CONCURRENCY = 40;

function parseSiteArgs(argv) {
  const args = {
    url: null,
    configPath: 'config/site.tvtruyen.json',
    concurrency: DEFAULT_CHAPTER_CONCURRENCY,
    delayMs: null,
    maxStories: null,
    maxChapters: null,
    listOnly: false,
    force: false,
    noRefreshCatalog: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === '--config') {
      args.configPath = argv[index + 1];
      index += 1;
    } else if (value === '--concurrency') {
      const parsed = Number.parseInt(argv[index + 1], 10);
      args.concurrency = Number.isFinite(parsed) && parsed > 0 ? parsed : args.concurrency;
      index += 1;
    } else if (value === '--delay-ms') {
      const parsed = Number.parseInt(argv[index + 1], 10);
      args.delayMs = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
      index += 1;
    } else if (value === '--max-stories') {
      const parsed = Number.parseInt(argv[index + 1], 10);
      args.maxStories = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      index += 1;
    } else if (value === '--max-chapters') {
      const parsed = Number.parseInt(argv[index + 1], 10);
      args.maxChapters = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      index += 1;
    } else if (value === '--list-only') {
      args.listOnly = true;
    } else if (value === '--force') {
      args.force = true;
    } else if (value === '--no-refresh-catalog') {
      args.noRefreshCatalog = true;
    } else if (!args.url) {
      args.url = value;
    }
  }

  return args;
}

async function fetchListingHtml(url, requestConfig) {
  const client = axios.create({
    timeout: requestConfig.timeoutMs ?? 20000,
    headers: {
      'User-Agent': requestConfig.userAgent ?? 'Mozilla/5.0 NovelCrawler/1.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    },
    responseType: 'text',
    transformResponse: [(data) => data]
  });

  const response = await client.get(url);

  if (response.status >= 400) {
    throw new Error(`HTTP ${response.status} fetching listing page ${url}`);
  }

  return response.data;
}

async function main() {
  const args = parseSiteArgs(process.argv.slice(2));

  if (!args.url) {
    console.error('Usage: node src/crawl-site.js <site-or-listing-url> [--config config/site.tvtruyen.json] [--concurrency 40] [--delay-ms 500] [--max-stories N] [--max-chapters N] [--list-only] [--force] [--no-refresh-catalog]');
    process.exitCode = 1;
    return;
  }

  const config = await loadConfig(args.configPath);

  if (args.delayMs != null) {
    config.request = { ...config.request, delayMs: args.delayMs };
  }

  console.log(`Fetching story list from: ${args.url}`);
  const listingHtml = await fetchListingHtml(args.url, config.request || {});
  let stories = parseStoryList(listingHtml, args.url);

  if (!stories.length) {
    console.error('No stories found on the page. Is this a listing/home page?');
    process.exitCode = 1;
    return;
  }

  if (args.maxStories) {
    stories = stories.slice(0, args.maxStories);
  }

  console.log(`Found ${stories.length} stories:`);
  stories.forEach((story, index) => {
    console.log(`  ${index + 1}. ${story.title} — ${story.url}`);
  });

  if (args.listOnly) {
    return;
  }

  // Crawl one story at a time (each "tab"), and within each story download
  // chapters with the requested concurrency. Sequential across stories keeps
  // the per-host burst bounded to one story's worth of parallel requests.
  const summary = [];

  for (let index = 0; index < stories.length; index += 1) {
    const story = stories[index];
    console.log(`\n=== [${index + 1}/${stories.length}] ${story.title} ===`);

    try {
      await crawlNovel(story.url, config, {
        concurrency: args.concurrency,
        force: args.force,
        maxChapters: args.maxChapters,
        noRefreshCatalog: args.noRefreshCatalog
      });
      summary.push({ story: story.title, status: 'ok' });
    } catch (error) {
      const message = error?.message || String(error);
      console.error(`Failed to crawl "${story.title}": ${message}`);
      summary.push({ story: story.title, status: 'failed', error: message });
    }
  }

  const ok = summary.filter((entry) => entry.status === 'ok').length;
  const failed = summary.length - ok;
  console.log(`\nDone. ${ok} stories crawled, ${failed} failed.`);

  if (failed) {
    summary
      .filter((entry) => entry.status === 'failed')
      .forEach((entry) => console.log(`  - ${entry.story}: ${entry.error}`));
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});

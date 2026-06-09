#!/usr/bin/env node

import 'dotenv/config';
import { loadConfig, parseArgs } from './utils.js';
import { crawlNovel } from './crawler.js';

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.url) {
    console.error('Usage: npm run crawl -- <novel-url> [--config config/site.tvtruyen.json] [--from-index 3] [--to-index 50] [--max-chapters 3] [--concurrency 4] [--delay-ms 500] [--list-only] [--refresh-catalog] [--no-refresh-catalog] [--force] [--retry-rounds 2] [--no-retry]');
    process.exitCode = 1;
    return;
  }

  const config = await loadConfig(args.configPath);

  // CLI flags override the config's request defaults when provided.
  if (args.delayMs != null) {
    config.request = { ...config.request, delayMs: args.delayMs };
  }

  await crawlNovel(args.url, config, {
    concurrency: args.concurrency,
    force: args.force,
    fromIndex: args.fromIndex,
    listOnly: args.listOnly,
    maxChapters: args.maxChapters,
    refreshCatalog: args.refreshCatalog,
    noRefreshCatalog: args.noRefreshCatalog,
    retryFailed: !args.noRetry,
    retryRounds: args.retryRounds,
    toIndex: args.toIndex
  });
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});

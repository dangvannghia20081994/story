import assert from 'node:assert/strict';
import test from 'node:test';
import { collectPagedLists, requiredCatalogFetchLimit, retryFailedChapters } from '../src/crawler.js';
import { mapWithConcurrency, parseArgs } from '../src/utils.js';

test('parses chapter index range arguments', () => {
  const args = parseArgs([
    'https://example.test/demo.html',
    '--from-index',
    '3',
    '--to-index',
    '50',
    '--max-chapters',
    '5',
    '--concurrency',
    '4',
    '--delay-ms',
    '300'
  ]);

  assert.equal(args.url, 'https://example.test/demo.html');
  assert.equal(args.fromIndex, 3);
  assert.equal(args.toIndex, 50);
  assert.equal(args.maxChapters, 5);
  assert.equal(args.concurrency, 4);
  assert.equal(args.delayMs, 300);
});

test('mapWithConcurrency preserves order and bounds parallelism', async () => {
  const items = [10, 20, 30, 40, 50];
  let active = 0;
  let maxActive = 0;

  const results = await mapWithConcurrency(items, 2, async (value) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return value * 2;
  });

  assert.deepEqual(results, [20, 40, 60, 80, 100]);
  assert.ok(maxActive <= 2, `expected at most 2 concurrent, saw ${maxActive}`);
});

test('parses retry flags', () => {
  const withRounds = parseArgs(['https://example.test/x.html', '--retry-rounds', '3']);
  assert.equal(withRounds.retryRounds, 3);
  assert.equal(withRounds.noRetry, false);

  const noRetry = parseArgs(['https://example.test/x.html', '--no-retry']);
  assert.equal(noRetry.noRetry, true);
});

test('retryFailedChapters recovers transient failures and gives up on persistent ones', async () => {
  const failed = [
    { index: 1, title: 'A', url: 'u1' }, // recovers on retry
    { index: 2, title: 'B', url: 'u2' } // always fails
  ];
  const downloaded = [];
  const attempts = new Map();

  await retryFailedChapters({
    client: null,
    config: null,
    requestConfig: {},
    paths: null,
    downloaded,
    failed,
    delayMs: 0,
    retryDelayMs: 0,
    mainConcurrency: 40,
    maxRounds: 3,
    downloadFn: async (_client, chapterInfo) => {
      const seen = (attempts.get(chapterInfo.index) || 0) + 1;
      attempts.set(chapterInfo.index, seen);

      if (chapterInfo.index === 1) {
        return { index: 1, title: 'A', url: 'u1', content: 'ok' };
      }

      throw new Error('still down');
    }
  });

  assert.deepEqual(downloaded.map((c) => c.index), [1], 'chapter 1 recovered');
  assert.deepEqual(failed.map((c) => c.index), [2], 'chapter 2 still failing');
  // Round 1 recovers ch1 and fails ch2; round 2 retries only ch2, fails again,
  // recovers nothing, so it stops before round 3. ch2 is attempted twice.
  assert.equal(attempts.get(2), 2, 'persistent failure retried until a round recovers nothing');
});

test('collectPagedLists stops the next batch after an empty page but keeps same-batch pages', async () => {
  // 6 pages, batch size 2. Batch 1 = [p1, p2] both have chapters.
  // Batch 2 = [p3(empty), p4(has chapters)] -> p4 kept, then stop. p5/p6 never fetched.
  const pages = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
  const fetched = [];
  const byPage = {
    p1: [{ index: 1 }],
    p2: [{ index: 2 }],
    p3: [],
    p4: [{ index: 4 }],
    p5: [{ index: 5 }],
    p6: [{ index: 6 }]
  };

  const lists = await collectPagedLists(pages, 2, async (url) => {
    fetched.push(url);
    return byPage[url];
  });

  assert.deepEqual(fetched.sort(), ['p1', 'p2', 'p3', 'p4'], 'p5/p6 batch never fetched');
  assert.deepEqual(lists, [[{ index: 1 }], [{ index: 2 }], [{ index: 4 }]], 'kept pages with chapters, dropped the empty one');
});

test('collectPagedLists fetches all pages when none are empty', async () => {
  const pages = ['p1', 'p2', 'p3'];
  const lists = await collectPagedLists(pages, 2, async (url) => [{ url }]);
  assert.equal(lists.length, 3);
});

test('computes catalog fetch limit from range options', () => {
  assert.equal(requiredCatalogFetchLimit({ toIndex: 10 }), 10);
  assert.equal(requiredCatalogFetchLimit({ fromIndex: 100, maxChapters: 10 }), 109);
  assert.equal(requiredCatalogFetchLimit({ maxChapters: 10 }), 10);
  assert.equal(requiredCatalogFetchLimit({}), null);
});

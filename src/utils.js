import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import slugify from 'slugify';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(__dirname, '..');

export function parseArgs(argv) {
  const args = {
    concurrency: null,
    configPath: 'config/site.tvtruyen.json',
    delayMs: null,
    force: false,
    fromIndex: null,
    listOnly: false,
    maxChapters: null,
    noRetry: false,
    refreshCatalog: false,
    noRefreshCatalog: false,
    retryRounds: null,
    toIndex: null,
    url: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === '--config') {
      args.configPath = argv[index + 1];
      index += 1;
    } else if (value === '--concurrency') {
      const parsed = Number.parseInt(argv[index + 1], 10);
      args.concurrency = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      index += 1;
    } else if (value === '--delay-ms') {
      const parsed = Number.parseInt(argv[index + 1], 10);
      args.delayMs = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
      index += 1;
    } else if (value === '--from-index') {
      const parsed = Number.parseInt(argv[index + 1], 10);
      args.fromIndex = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      index += 1;
    } else if (value === '--to-index') {
      const parsed = Number.parseInt(argv[index + 1], 10);
      args.toIndex = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      index += 1;
    } else if (value === '--max-chapters') {
      const parsed = Number.parseInt(argv[index + 1], 10);
      args.maxChapters = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      index += 1;
    } else if (value === '--retry-rounds') {
      const parsed = Number.parseInt(argv[index + 1], 10);
      args.retryRounds = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
      index += 1;
    } else if (value === '--no-retry') {
      args.noRetry = true;
    } else if (value === '--force') {
      args.force = true;
    } else if (value === '--list-only') {
      args.listOnly = true;
    } else if (value === '--refresh-catalog') {
      args.refreshCatalog = true;
    } else if (value === '--no-refresh-catalog') {
      args.noRefreshCatalog = true;
    } else if (!args.url) {
      args.url = value;
    }
  }

  return args;
}

export async function loadConfig(configPath) {
  const absolutePath = path.resolve(projectRoot, configPath);
  const raw = await fs.readFile(absolutePath, 'utf8');
  return JSON.parse(raw);
}

export function toSlug(value, fallback = 'novel') {
  const slug = slugify(value || fallback, {
    lower: true,
    strict: true,
    locale: 'vi',
    trim: true
  });

  return slug || fallback;
}

export function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/^[ \t]+/gm, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function resolveUrl(href, baseUrl) {
  return new URL(href, baseUrl).toString();
}

export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function padIndex(index) {
  return String(index).padStart(4, '0');
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonIfExists(filePath) {
  if (!(await pathExists(filePath))) {
    return null;
  }

  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

export async function writeJson(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

// Run `worker(item, index)` over all items with at most `limit` running at once.
// Results are returned in the original item order. A worker that throws does not
// abort the others; its slot in the result array holds the rejected promise's
// reason via the caller's own try/catch inside the worker (workers should not
// throw — wrap their own errors). This keeps a bounded pool without extra deps.
export async function mapWithConcurrency(items, limit, worker) {
  const size = Math.max(1, limit || 1);
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runner() {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;

      if (current >= items.length) {
        return;
      }

      results[current] = await worker(items[current], current);
    }
  }

  const runnerCount = Math.min(size, items.length);
  await Promise.all(Array.from({ length: runnerCount }, () => runner()));

  return results;
}

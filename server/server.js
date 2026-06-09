#!/usr/bin/env node

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import axios from 'axios';
import { parseStoryList } from '../src/listing.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(__dirname, 'public');
const outputDir = path.join(projectRoot, 'output');
const jobs = new Map();

const port = Number.parseInt(process.env.PORT || '3000', 10);

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'POST' && request.url === '/api/stories') {
      await handleListStories(request, response);
      return;
    }

    if (request.method === 'POST' && request.url === '/api/crawl') {
      await handleStartJob(request, response);
      return;
    }

    if (request.method === 'POST' && /^\/api\/jobs\/[^/]+\/stop$/.test(request.url || '')) {
      handleStopJob(request, response);
      return;
    }

    if (request.method === 'GET' && request.url?.startsWith('/api/jobs/')) {
      handleGetJob(request, response);
      return;
    }

    if (request.method === 'GET' && request.url?.startsWith('/output/')) {
      await handleOutputFile(request, response);
      return;
    }

    await serveStatic(request, response);
  } catch (error) {
    sendJson(response, 500, { error: error?.message || String(error) });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Novel crawler UI: http://127.0.0.1:${port}`);
});

// Fetch a listing/home page and return the novel links found on it, so the UI
// can show a pick-list before crawling. Parsing is done in-process (no spawn).
async function handleListStories(request, response) {
  const body = await readJsonBody(request);
  const url = String(body.url || '').trim();

  if (!url || !/^https?:\/\//i.test(url)) {
    sendJson(response, 400, { error: 'URL không hợp lệ.' });
    return;
  }

  try {
    const client = axios.create({
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 NovelCrawler/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      responseType: 'text',
      transformResponse: [(data) => data]
    });
    const page = await client.get(url);

    if (page.status >= 400) {
      sendJson(response, 502, { error: `HTTP ${page.status} khi tải trang.` });
      return;
    }

    const stories = parseStoryList(page.data, url);
    sendJson(response, 200, { stories });
  } catch (error) {
    sendJson(response, 502, { error: error?.message || String(error) });
  }
}

async function handleStartJob(request, response) {
  const body = await readJsonBody(request);
  const url = String(body.url || '').trim();

  if (!url || !/^https?:\/\//i.test(url)) {
    sendJson(response, 400, { error: 'URL không hợp lệ.' });
    return;
  }

  const args = ['run', 'crawl', '--', url];

  if (body.force) {
    args.push('--force');
  }

  if (body.listOnly) {
    args.push('--list-only');
  }

  if (body.refreshCatalog) {
    args.push('--refresh-catalog');
  }

  const maxChapters = Number.parseInt(body.maxChapters, 10);
  const fromIndex = Number.parseInt(body.fromIndex, 10);
  const toIndex = Number.parseInt(body.toIndex, 10);
  const concurrency = Number.parseInt(body.concurrency, 10);
  const delayMs = Number.parseInt(body.delayMs, 10);

  if (Number.isFinite(fromIndex) && fromIndex > 0) {
    args.push('--from-index', String(fromIndex));
  }

  if (Number.isFinite(toIndex) && toIndex > 0) {
    args.push('--to-index', String(toIndex));
  }

  if (Number.isFinite(maxChapters) && maxChapters > 0) {
    args.push('--max-chapters', String(maxChapters));
  }

  if (Number.isFinite(concurrency) && concurrency > 0) {
    args.push('--concurrency', String(concurrency));
  }

  if (Number.isFinite(delayMs) && delayMs >= 0) {
    args.push('--delay-ms', String(delayMs));
  }

  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const job = {
    id,
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    logs: [],
    outputSlug: null,
    stopped: false,
    child: null
  };
  jobs.set(id, job);

  const child = spawn('npm', args, {
    cwd: projectRoot,
    env: process.env,
    // Own process group so stopping can signal npm AND its node child together;
    // killing just the npm wrapper would leave the crawler running.
    detached: true
  });
  job.child = child;

  child.stdout.on('data', (chunk) => appendLog(job, chunk));
  child.stderr.on('data', (chunk) => appendLog(job, chunk));
  child.on('error', (error) => {
    appendLog(job, `${error.message}\n`);
    job.status = 'failed';
    job.finishedAt = new Date().toISOString();
    job.child = null;
  });
  child.on('close', (code) => {
    job.exitCode = code;
    // A job killed via the stop endpoint reports as "stopped", not "failed",
    // so the UI can distinguish a user cancel from a crawl error.
    job.status = job.stopped ? 'stopped' : code === 0 ? 'completed' : 'failed';
    job.finishedAt = new Date().toISOString();
    job.outputSlug = inferOutputSlug(job.logs.join('\n'));
    job.child = null;
  });

  sendJson(response, 202, { id });
}

function handleStopJob(request, response) {
  const id = decodeURIComponent(request.url.split('/').at(-2) || '');
  const job = jobs.get(id);

  if (!job) {
    sendJson(response, 404, { error: 'Không tìm thấy job.' });
    return;
  }

  if (job.status !== 'running' || !job.child) {
    sendJson(response, 200, { id, status: job.status });
    return;
  }

  job.stopped = true;
  appendLog(job, '\n[Đã yêu cầu dừng]\n');
  // Signal the whole process group (npm + node crawler). The child was spawned
  // detached, so its pid is the group leader; -pid targets the group.
  try {
    process.kill(-job.child.pid, 'SIGTERM');
  } catch {
    job.child.kill('SIGTERM');
  }
  sendJson(response, 200, { id, status: 'stopping' });
}

function handleGetJob(request, response) {
  const id = decodeURIComponent(request.url.split('/').at(-1) || '');
  const job = jobs.get(id);

  if (!job) {
    sendJson(response, 404, { error: 'Không tìm thấy job.' });
    return;
  }

  sendJson(response, 200, {
    id: job.id,
    status: job.status,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    exitCode: job.exitCode,
    logs: job.logs,
    outputSlug: job.outputSlug,
    outputLinks: job.outputSlug ? outputLinks(job.outputSlug) : []
  });
}

async function handleOutputFile(request, response) {
  const relativePath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname.replace(/^\/output\//, ''));
  const absolutePath = path.resolve(outputDir, relativePath);

  if (!absolutePath.startsWith(`${outputDir}${path.sep}`)) {
    sendJson(response, 403, { error: 'Đường dẫn output không hợp lệ.' });
    return;
  }

  const stat = await fs.stat(absolutePath);

  if (!stat.isFile()) {
    sendJson(response, 404, { error: 'Không tìm thấy file.' });
    return;
  }

  response.writeHead(200, { 'Content-Type': contentType(absolutePath) });
  createReadStream(absolutePath).pipe(response);
}

async function serveStatic(request, response) {
  const requestPath = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
  const filePath = path.resolve(publicDir, requestPath === '/' ? 'index.html' : requestPath.slice(1));

  if (!filePath.startsWith(`${publicDir}${path.sep}`)) {
    sendJson(response, 403, { error: 'Forbidden' });
    return;
  }

  try {
    const stat = await fs.stat(filePath);

    if (!stat.isFile()) {
      throw new Error('Not found');
    }

    response.writeHead(200, { 'Content-Type': contentType(filePath) });
    createReadStream(filePath).pipe(response);
  } catch {
    sendJson(response, 404, { error: 'Not found' });
  }
}

function appendLog(job, chunk) {
  const lines = String(chunk)
    .split(/\r?\n/)
    .filter(Boolean);
  job.logs.push(...lines);

  if (job.logs.length > 1000) {
    job.logs.splice(0, job.logs.length - 1000);
  }
}

function inferOutputSlug(text) {
  const match = text.match(/Saved \d+ chapters to .+\/output\/([^\s]+)/)
    || text.match(/Saved chapter catalog with \d+ chapters to .+\/output\/([^/\s]+)\/chapters\.json/);
  return match?.[1] || null;
}

function outputLinks(slug) {
  return [
    ['metadata.json', `/output/${slug}/metadata.json`],
    ['chapters.json', `/output/${slug}/chapters.json`],
    ['downloaded-chapters.json', `/output/${slug}/downloaded-chapters.json`],
    ['full.md', `/output/${slug}/full.md`],
    ['full.txt', `/output/${slug}/full.txt`],
    ['full.epub', `/output/${slug}/full.epub`]
  ];
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = '';
    request.on('data', (chunk) => {
      raw += chunk;
    });
    request.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  return {
    '.css': 'text/css; charset=utf-8',
    '.epub': 'application/epub+zip',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8'
  }[ext] || 'application/octet-stream';
}

// One-off maintenance: re-strip injected ads from already-downloaded chapters
// in data/<slug>/chapters/*.json, in place. Only rewrites files whose content
// actually changes. Pass --write to apply; default is a dry run that only
// reports what would change.
import fs from 'node:fs/promises';
import path from 'node:path';
import { cleanExtractedText, stripAds } from '../src/cleaner.js';
import { projectRoot, writeJson } from '../src/utils.js';

// Chapters crawled before the reflow fix are stored one word/fragment per
// line, so they read as a wall of short lines. Detect that shape and run the
// full extraction pipeline (which reflows broken lines into paragraphs) on
// those, instead of the ads-only pass. Already-reflowed prose is left to the
// safe ads-only pass — reflowing it again would re-merge legitimately short
// lines.
function isFragmented(content) {
  const lines = content.split('\n').filter(Boolean);

  if (lines.length < 3) {
    return false;
  }

  const wordsPerLine = lines.map((line) => line.trim().split(/\s+/).length);
  const avg = wordsPerLine.reduce((sum, n) => sum + n, 0) / lines.length;
  const shortFraction = wordsPerLine.filter((n) => n <= 2).length / lines.length;

  return avg < 3 && shortFraction > 0.5;
}

const write = process.argv.includes('--write');
const dataDir = path.join(projectRoot, 'data');

const novels = (await fs.readdir(dataDir, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

let totalFiles = 0;
let changedFiles = 0;
let reflowedFiles = 0;
const perNovel = [];

for (const novel of novels) {
  const chaptersDir = path.join(dataDir, novel, 'chapters');
  let files;

  try {
    files = await fs.readdir(chaptersDir);
  } catch {
    continue;
  }

  let novelChanged = 0;

  for (const file of files) {
    if (!file.endsWith('.json')) {
      continue;
    }

    const filePath = path.join(chaptersDir, file);
    totalFiles += 1;

    let chapter;
    try {
      chapter = JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch (error) {
      console.error(`Skip unreadable ${filePath}: ${error.message}`);
      continue;
    }

    if (typeof chapter.content !== 'string') {
      continue;
    }

    const fragmented = isFragmented(chapter.content);
    const cleaned = fragmented ? cleanExtractedText(chapter.content) : stripAds(chapter.content);

    if (cleaned === chapter.content) {
      continue;
    }

    changedFiles += 1;
    novelChanged += 1;

    if (fragmented) {
      reflowedFiles += 1;
    }

    if (write) {
      chapter.content = cleaned;
      await writeJson(filePath, chapter);
    }
  }

  if (novelChanged) {
    perNovel.push(`${novel}: ${novelChanged}`);
  }
}

console.log(perNovel.join('\n'));
console.log(`\n${write ? 'Rewrote' : 'Would rewrite'} ${changedFiles} of ${totalFiles} chapter files across ${perNovel.length} novel(s) (${reflowedFiles} reflowed, ${changedFiles - reflowedFiles} ads-only).`);

import fs from 'node:fs/promises';
import path from 'node:path';
import { buildChapterMarkdown, buildChapterText } from './exporter.js';
import { ensureDir, padIndex, projectRoot, readJsonIfExists, writeJson } from './utils.js';

export function getNovelPaths(slug) {
  const dataDir = path.join(projectRoot, 'data', slug);
  const outputDir = path.join(projectRoot, 'output', slug);

  return {
    dataDir,
    outputDir,
    catalogPath: path.join(dataDir, 'catalog.json'),
    metaPath: path.join(dataDir, 'meta.json'),
    chapterDir: path.join(dataDir, 'chapters'),
    failedPath: path.join(dataDir, 'failed.json'),
    outputChapterDir: path.join(outputDir, 'chapters'),
    downloadedChaptersPath: path.join(outputDir, 'downloaded-chapters.json'),
    metadataPath: path.join(outputDir, 'metadata.json'),
    chaptersPath: path.join(outputDir, 'chapters.json'),
    fullEpubPath: path.join(outputDir, 'full.epub'),
    fullMarkdownPath: path.join(outputDir, 'full.md'),
    fullTextPath: path.join(outputDir, 'full.txt')
  };
}

export async function prepareNovelDirs(paths) {
  await Promise.all([
    ensureDir(paths.chapterDir),
    ensureDir(paths.outputChapterDir),
    ensureDir(paths.outputDir)
  ]);
}

export function chapterPath(paths, index) {
  return path.join(paths.chapterDir, `${padIndex(index)}.json`);
}

export async function readCachedChapter(paths, index) {
  return readJsonIfExists(chapterPath(paths, index));
}

export async function readCachedCatalog(paths) {
  return readJsonIfExists(paths.catalogPath);
}

// data/<slug>/meta.json is the source of truth for novel metadata; the copy
// under output/ is regenerated from it. Fall back to the output copy for
// novels crawled before meta.json existed.
export async function readCachedMetadata(paths) {
  return (await readJsonIfExists(paths.metaPath)) ?? (await readJsonIfExists(paths.metadataPath));
}

// Shape of the persisted metadata file, identical for data/meta.json and the
// output/metadata.json copy. Carries chapterCount so the file is useful to
// inspect on its own.
export function buildMeta(metadata, chapters) {
  return {
    ...metadata,
    chapterCount: Array.isArray(chapters) ? chapters.length : 0
  };
}

export async function saveChapter(paths, chapter) {
  await writeJson(chapterPath(paths, chapter.index), chapter);
}

export async function saveFailed(paths, failed) {
  await writeJson(paths.failedPath, failed);
}

export async function saveFailedResults(paths, failures, successfulUrls = []) {
  const previous = await readJsonIfExists(paths.failedPath);
  const byUrl = new Map();

  for (const failure of Array.isArray(previous) ? previous : []) {
    if (failure?.url) {
      byUrl.set(failure.url, failure);
    }
  }

  for (const url of successfulUrls) {
    byUrl.delete(url);
  }

  for (const failure of failures) {
    const previousFailure = byUrl.get(failure.url);
    byUrl.set(failure.url, {
      ...previousFailure,
      ...failure,
      attempts: (previousFailure?.attempts || 0) + 1,
      firstFailedAt: previousFailure?.firstFailedAt || failure.failedAt
    });
  }

  const merged = [...byUrl.values()].sort((a, b) => a.index - b.index);
  await writeJson(paths.failedPath, merged);
  return merged;
}

export async function saveOutput(paths, metadata, chapters, markdown, text) {
  // chapterCount tracks how many chapters we've actually downloaded. Refresh
  // the source-of-truth data/meta.json now that the count is known (only
  // growing it, never shrinking from a partial-range re-crawl), then copy that
  // exact meta into output/metadata.json.
  const outputMeta = await saveNovelMeta(paths, metadata, chapters);

  await Promise.all([
    writeJson(paths.metadataPath, outputMeta),
    writeJson(paths.downloadedChaptersPath, chapters),
    fs.writeFile(paths.fullMarkdownPath, markdown, 'utf8'),
    fs.writeFile(paths.fullTextPath, text, 'utf8'),
    ...chapters.flatMap((chapter) => [
      writeJson(path.join(paths.outputChapterDir, `${padIndex(chapter.index)}.json`), chapter),
      fs.writeFile(path.join(paths.outputChapterDir, `${padIndex(chapter.index)}.md`), buildChapterMarkdown(chapter), 'utf8'),
      fs.writeFile(path.join(paths.outputChapterDir, `${padIndex(chapter.index)}.txt`), buildChapterText(chapter), 'utf8')
    ])
  ]);
}

// Write the source-of-truth meta file into the data dir describing the novel.
// Unlike catalog.json (the chapter list) this holds only the story-level info,
// so it stays small and is handy to inspect without loading the full catalog.
// When the novel is re-crawled and the chapter count only grows, this keeps the
// larger count rather than shrinking it from a partial range crawl.
export async function saveNovelMeta(paths, metadata, chapters) {
  const meta = buildMeta(metadata, chapters);
  const previous = await readJsonIfExists(paths.metaPath);

  if (previous && Number.isFinite(previous.chapterCount) && previous.chapterCount > meta.chapterCount) {
    meta.chapterCount = previous.chapterCount;
  }

  await writeJson(paths.metaPath, meta);
  return meta;
}

export async function saveCatalogOutput(paths, metadata, chapters, options = {}) {
  // chapterCount means "downloaded", which isn't known yet at catalog time, so
  // seed meta from the existing data/meta.json (preserving its count) and only
  // refresh the story-level fields. saveOutput rewrites it with the real count
  // once chapters are downloaded.
  const previous = await readJsonIfExists(paths.metaPath);
  const meta = { ...metadata, chapterCount: Number.isFinite(previous?.chapterCount) ? previous.chapterCount : 0 };

  const writes = [
    writeJson(paths.metaPath, meta),
    writeJson(paths.metadataPath, meta),
    writeJson(paths.chaptersPath, chapters)
  ];

  if (options.cacheCatalog !== false) {
    writes.push(writeJson(paths.catalogPath, chapters));
  }

  await Promise.all(writes);
}

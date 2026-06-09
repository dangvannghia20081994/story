// Rebuild output/<slug>/* from the already-cleaned data/<slug>/chapters/*.json.
// Regenerates per-chapter json/md/txt, full.md, full.txt, downloaded-chapters.json,
// metadata.json and full.epub via the same exporter/storage code the crawler uses,
// so the outputs stay byte-for-byte consistent with a fresh crawl — just without
// re-fetching. Pass one or more slugs to limit the run; default is all novels.
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildEpub, buildMarkdown, buildText } from '../src/exporter.js';
import { getNovelPaths, prepareNovelDirs, readCachedMetadata, saveOutput } from '../src/storage.js';
import { projectRoot, readJsonIfExists } from '../src/utils.js';

const onlySlugs = new Set(process.argv.slice(2).filter((arg) => !arg.startsWith('-')));
const dataDir = path.join(projectRoot, 'data');

const slugs = (await fs.readdir(dataDir, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((slug) => onlySlugs.size === 0 || onlySlugs.has(slug));

let rebuilt = 0;
let skipped = 0;

for (const slug of slugs) {
  const paths = getNovelPaths(slug);

  // Metadata is only persisted under output/ (and, post-fix, data/meta.json);
  // readCachedMetadata reads output/<slug>/metadata.json. Fall back to a stub
  // so a missing metadata file doesn't abort the whole run.
  let metadata = await readCachedMetadata(paths);

  if (!metadata) {
    metadata = { title: slug, author: '', sourceUrl: '', site: '', crawledAt: new Date().toISOString() };
    console.warn(`No metadata for ${slug}; using a stub title.`);
  }

  const chapterFiles = (await fs.readdir(paths.chapterDir).catch(() => []))
    .filter((file) => file.endsWith('.json'))
    .sort();

  if (!chapterFiles.length) {
    console.warn(`No chapters in data/${slug}; skipping.`);
    skipped += 1;
    continue;
  }

  const chapters = [];
  for (const file of chapterFiles) {
    const chapter = await readJsonIfExists(path.join(paths.chapterDir, file));
    if (chapter && typeof chapter.content === 'string' && chapter.content.trim()) {
      chapters.push(chapter);
    }
  }

  chapters.sort((a, b) => a.index - b.index);

  await prepareNovelDirs(paths);
  // saveOutput refreshes data/meta.json (chapterCount = downloaded) and copies
  // it into output/metadata.json, so no separate saveNovelMeta call is needed.
  await saveOutput(paths, metadata, chapters, buildMarkdown(metadata, chapters), buildText(metadata, chapters));
  await buildEpub(paths.fullEpubPath, metadata, chapters);

  rebuilt += 1;
  console.log(`Rebuilt ${slug}: ${chapters.length} chapters -> ${paths.outputDir}`);
}

console.log(`\nRebuilt ${rebuilt} novel(s), skipped ${skipped}.`);

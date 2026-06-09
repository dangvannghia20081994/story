import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import JSZip from 'jszip';
import { normalizeWhitespace } from './utils.js';

export function buildMarkdown(metadata, chapters) {
  const lines = [`# ${metadata.title}`, ''];

  if (metadata.author) {
    lines.push(`**Author:** ${metadata.author}`, '');
  }

  lines.push(`**Source:** ${metadata.sourceUrl}`, '');

  for (const chapter of chapters) {
    lines.push(`## ${chapter.title}`, '', normalizeWhitespace(chapter.content), '');
  }

  return `${lines.join('\n').trim()}\n`;
}

export function buildChapterMarkdown(chapter) {
  return `# ${chapter.title}\n\n${normalizeWhitespace(chapter.content)}\n`;
}

export function buildText(metadata, chapters) {
  const lines = [metadata.title, ''.padEnd(metadata.title.length, '=')];

  if (metadata.author) {
    lines.push('', `Author: ${metadata.author}`);
  }

  lines.push('', `Source: ${metadata.sourceUrl}`, '');

  for (const chapter of chapters) {
    lines.push(chapter.title, ''.padEnd(chapter.title.length, '-'), '', normalizeWhitespace(chapter.content), '');
  }

  return `${lines.join('\n').trim()}\n`;
}

export function buildChapterText(chapter) {
  return `${chapter.title}\n${''.padEnd(chapter.title.length, '-')}\n\n${normalizeWhitespace(chapter.content)}\n`;
}

export async function buildEpub(filePath, metadata, chapters) {
  const zip = new JSZip();
  const bookId = `urn:uuid:${randomUUID()}`;
  const modified = new Date(metadata.crawledAt || Date.now()).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const chapterFiles = chapters.map((chapter) => `chapters/chapter-${String(chapter.index).padStart(4, '0')}.xhtml`);

  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`);

  zip.file('OEBPS/nav.xhtml', buildNavXhtml(metadata, chapters, chapterFiles));
  zip.file('OEBPS/content.opf', buildPackageOpf(metadata, chapters, chapterFiles, bookId, modified));
  zip.file('OEBPS/styles.css', `body { font-family: serif; line-height: 1.6; margin: 5%; } h1 { line-height: 1.25; } p { margin: 0 0 0.9em; }`);

  for (const [index, chapter] of chapters.entries()) {
    zip.file(`OEBPS/${chapterFiles[index]}`, buildChapterXhtml(metadata, chapter));
  }

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    mimeType: 'application/epub+zip'
  });
  await fs.writeFile(filePath, buffer);
}

function buildPackageOpf(metadata, chapters, chapterFiles, bookId, modified) {
  const manifestItems = chapterFiles
    .map((file, index) => `    <item id="chapter-${chapters[index].index}" href="${file}" media-type="application/xhtml+xml"/>`)
    .join('\n');
  const spineItems = chapters
    .map((chapter) => `    <itemref idref="chapter-${chapter.index}"/>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${escapeXml(bookId)}</dc:identifier>
    <dc:title>${escapeXml(metadata.title)}</dc:title>
    <dc:language>vi</dc:language>
    ${metadata.author ? `<dc:creator>${escapeXml(metadata.author)}</dc:creator>` : ''}
    <meta property="dcterms:modified">${escapeXml(modified)}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="styles" href="styles.css" media-type="text/css"/>
${manifestItems}
  </manifest>
  <spine>
${spineItems}
  </spine>
</package>
`;
}

function buildNavXhtml(metadata, chapters, chapterFiles) {
  const items = chapters
    .map((chapter, index) => `      <li><a href="${chapterFiles[index]}">${escapeXml(chapter.title)}</a></li>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="vi" xml:lang="vi">
<head>
  <title>${escapeXml(metadata.title)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>${escapeXml(metadata.title)}</h1>
    <ol>
${items}
    </ol>
  </nav>
</body>
</html>
`;
}

function buildChapterXhtml(metadata, chapter) {
  const paragraphs = normalizeWhitespace(chapter.content)
    .split('\n')
    .map((line) => `    <p>${escapeXml(line)}</p>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="vi" xml:lang="vi">
<head>
  <title>${escapeXml(chapter.title)}</title>
  <link rel="stylesheet" type="text/css" href="../styles.css"/>
</head>
<body>
  <section>
    <h1>${escapeXml(chapter.title)}</h1>
${paragraphs}
  </section>
</body>
</html>
`;
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

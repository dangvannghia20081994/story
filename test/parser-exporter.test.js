import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanExtractedText, normalizeChapterTitle } from '../src/cleaner.js';
import { buildMarkdown, buildText } from '../src/exporter.js';
import { mergeChapterLists, parseChapterPage, parseNovelPage } from '../src/parser.js';

const config = {
  name: 'fixture',
  selectors: {
    title: 'h1',
    author: '.author',
    chapterList: '.chapters a',
    chapterTitle: 'h1',
    chapterContent: '.chapter-content'
  }
};

test('parses novel metadata and chapter links', () => {
  const html = `
    <h1>Demo Novel</h1>
    <span class="author">Demo Author</span>
    <nav class="chapters">
      <a href="/demo-full.html">Truyện Full</a>
      <a href="/demo/chapter-2">#2. Chapter 2</a>
      <a href="/demo/chapter-1">#1. Chapter 1</a>
      <a href="/demo/chapter-2">#2. Chapter 2 duplicate</a>
    </nav>
  `;

  const result = parseNovelPage(html, 'https://example.test/demo.html', config);

  assert.equal(result.metadata.title, 'Demo Novel');
  assert.equal(result.metadata.author, 'Demo Author');
  assert.equal(result.chapters.length, 2);
  assert.deepEqual(result.chapters.map((chapter) => chapter.url), [
    'https://example.test/demo/chapter-1',
    'https://example.test/demo/chapter-2'
  ]);
  assert.deepEqual(result.chapters.map((chapter) => chapter.title), [
    'Chương 1: Chapter 1',
    'Chương 2: Chapter 2'
  ]);
});

test('parses pagination urls and merges chapter lists', () => {
  const html = `
    <h1>Demo Novel</h1>
    <nav class="chapters">
      <a href="/demo/chapter-1">#1. Chapter 1</a>
      <a href="/demo/chapter-2">#2. Chapter 2</a>
    </nav>
    <nav class="pagination">
      <a href="https://example.test/demo.html?page=2#list-chapter">2</a>
      <a href="https://example.test/demo.html?page=5#list-chapter">5</a>
    </nav>
  `;
  const page2Html = `
    <h1>Demo Novel</h1>
    <nav class="chapters">
      <a href="/demo/chapter-2">#2. Chapter 2 duplicate</a>
      <a href="/demo/chapter-3">#3. Chapter 3</a>
    </nav>
  `;

  const page1 = parseNovelPage(html, 'https://example.test/demo.html', config);
  const page2 = parseNovelPage(page2Html, 'https://example.test/demo.html?page=2', config);
  const merged = mergeChapterLists([page1.chapters, page2.chapters]);

  assert.deepEqual(page1.paginationUrls, [
    'https://example.test/demo.html?page=2',
    'https://example.test/demo.html?page=3',
    'https://example.test/demo.html?page=4',
    'https://example.test/demo.html?page=5'
  ]);
  assert.deepEqual(merged.map((chapter) => chapter.url), [
    'https://example.test/demo/chapter-1',
    'https://example.test/demo/chapter-2',
    'https://example.test/demo/chapter-3'
  ]);
  assert.deepEqual(merged.map((chapter) => chapter.title), [
    'Chương 1: Chapter 1',
    'Chương 2: Chapter 2',
    'Chương 3: Chapter 3'
  ]);
});


test('cleans chapter content and builds exports', () => {
  const html = `
    <h1>Chapter 1</h1>
    <article class="chapter-content">
      <p>First line.</p>
      <script>ignore()</script>
      <div class="ads">ad text</div>
      <div class="signature">signature ad text</div>
      <p>Second&nbsp;line.<br>Third line.</p>
    </article>
  `;

  const chapter = parseChapterPage(html, {
    index: 1,
    title: 'Fallback',
    url: 'https://example.test/demo/chapter-1.html'
  }, config);
  const metadata = {
    title: 'Demo Novel',
    author: 'Demo Author',
    sourceUrl: 'https://example.test/demo.html'
  };

  assert.equal(chapter.title, 'Chapter 1');
  assert.equal(chapter.content, 'First line.\nSecond line.\nThird line.');
  assert.match(buildMarkdown(metadata, [chapter]), /## Chapter 1/);
  assert.match(buildText(metadata, [chapter]), /Demo Author/);
});

test('removes extracted text noise', () => {
  const input = `
    Dưới đây là văn bản đã được biên tập lại:

    **Tên nhân vật** nói: “Xin chào.”
    *Nàng* đáp: ‘Ừ.’
    — Không đụng dialogue dash.
  `;

  assert.equal(cleanExtractedText(input), [
    'Tên nhân vật nói: "Xin chào."',
    "Nàng đáp: 'Ừ.'",
    '— Không đụng dialogue dash.'
  ].join('\n'));
});

test('removes repeated leading editor artifact lines only', () => {
  const input = `
    Biên tập lại:

    Văn bản đã biên tập:

    Nội dung thật.
    Biên tập lại: câu này nằm trong nội dung.
  `;

  assert.equal(cleanExtractedText(input), [
    'Nội dung thật.',
    'Biên tập lại: câu này nằm trong nội dung.'
  ].join('\n'));
});

test('removes blank lines and standalone repeated punctuation noise', () => {
  const input = `
    Dòng một.

    ...
    ???
    Dòng hai?
    ? Không bỏ dòng có chữ.
    ......

    Dòng ba.
  `;

  assert.equal(cleanExtractedText(input), [
    'Dòng một.',
    'Dòng hai?',
    '? Không bỏ dòng có chữ.',
    'Dòng ba.'
  ].join('\n'));
});

test('normalizes crawler chapter titles', () => {
  assert.equal(normalizeChapterTitle('#1. Giới thiệu'), 'Chương 1: Giới thiệu');
  assert.equal(normalizeChapterTitle('#50. Chương 50: Thu phục...'), 'Chương 50: Thu phục...');
  assert.equal(normalizeChapterTitle('# 12) Tên chương'), 'Tên chương');
  assert.equal(normalizeChapterTitle('  Chương   3:   Gặp lại  '), 'Chương 3: Gặp lại');
  assert.equal(normalizeChapterTitle('Tên truyện / Chương 1: Ban tên'), 'Chương 1: Ban tên');
});

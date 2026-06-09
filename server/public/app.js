const startButton = document.querySelector('#start');
const stopButton = document.querySelector('#stop');
const statusEl = document.querySelector('#status');
const jobIdEl = document.querySelector('#jobId');
const logsEl = document.querySelector('#logs');
const linksEl = document.querySelector('#links');
const progressEl = document.querySelector('#progress');
const progressBarEl = document.querySelector('#progressBar');
const progressTextEl = document.querySelector('#progressText');

let pollTimer = null;
// The job currently running (single or part of a site batch) and whether the
// user asked to abort the whole batch.
let currentJobId = null;
let aborted = false;

stopButton.addEventListener('click', async () => {
  aborted = true;
  stopButton.disabled = true;

  if (currentJobId) {
    try {
      await fetch(`/api/jobs/${encodeURIComponent(currentJobId)}/stop`, { method: 'POST' });
    } catch {
      // The job may have already finished; ignore.
    }
  }
});

// Pull chapter progress out of the crawler log lines and render it as a bar.
// Distinguishes chapters served from cache ("Skip cached") from freshly
// downloaded ones, so a re-crawl of an already-cached novel reads as "from
// cache" instead of looking like it's re-fetching everything.
function renderProgress(logs, prefix = '') {
  let match = null;
  let cached = 0;
  let downloaded = 0;

  for (const line of logs) {
    const found = line.match(/\((\d+)\/(\d+)\)/);

    if (found) {
      match = found;
    }

    if (/^Skip cached/.test(line)) {
      cached += 1;
    } else if (/^Downloaded/.test(line)) {
      downloaded += 1;
    }
  }

  if (!match) {
    progressEl.hidden = true;
    return false;
  }

  const done = Number(match[1]);
  const total = Number(match[2]);
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const breakdown = downloaded || cached
    ? ` — tải mới ${downloaded}, cache ${cached}`
    : '';

  progressEl.hidden = false;
  progressBarEl.style.width = `${percent}%`;
  progressTextEl.textContent = `${prefix}chương ${done}/${total} (${percent}%)${breakdown}`;
  return true;
}

startButton.addEventListener('click', async () => {
  startButton.disabled = true;
  aborted = false;
  linksEl.innerHTML = '';
  logsEl.textContent = '';
  progressEl.hidden = true;
  setStatus('starting');

  const response = await fetch('/api/crawl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: document.querySelector('#url').value,
      fromIndex: document.querySelector('#fromIndex').value,
      toIndex: document.querySelector('#toIndex').value,
      maxChapters: document.querySelector('#maxChapters').value,
      concurrency: document.querySelector('#concurrency').value,
      delayMs: document.querySelector('#delayMs').value,
      listOnly: document.querySelector('#listOnly').checked,
      refreshCatalog: document.querySelector('#refreshCatalog').checked,
      force: document.querySelector('#force').checked
    })
  });
  const result = await response.json();

  if (!response.ok) {
    setStatus('failed');
    logsEl.textContent = result.error || 'Không start được job.';
    startButton.disabled = false;
    return;
  }

  jobIdEl.textContent = result.id;
  currentJobId = result.id;
  stopButton.disabled = false;
  pollJob(result.id);
});

async function pollJob(id) {
  clearTimeout(pollTimer);
  const response = await fetch(`/api/jobs/${encodeURIComponent(id)}`);
  const job = await response.json();

  setStatus(job.status);
  logsEl.textContent = (job.logs || []).join('\n');
  logsEl.scrollTop = logsEl.scrollHeight;
  renderProgress(job.logs || []);
  renderLinks(job.outputLinks || []);

  if (job.status === 'running') {
    pollTimer = setTimeout(() => pollJob(id), 1000);
  } else {
    startButton.disabled = false;
    stopButton.disabled = true;
    currentJobId = null;
  }
}

function setStatus(status) {
  statusEl.textContent = status;
  statusEl.dataset.status = status;
}

function renderLinks(links) {
  linksEl.innerHTML = '';

  for (const [label, href] of links) {
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.textContent = label;
    anchor.target = '_blank';
    linksEl.append(anchor);
  }
}

// ---- Crawl cả site (nhiều truyện) ----

const listStoriesButton = document.querySelector('#listStories');
const crawlSelectedButton = document.querySelector('#crawlSelected');
const storyListEl = document.querySelector('#storyList');
const storyListHead = document.querySelector('#storyListHead');
const storyCountEl = document.querySelector('#storyCount');
const selectAllEl = document.querySelector('#selectAll');
const siteProgressEl = document.querySelector('#siteProgress');

let stories = [];

listStoriesButton.addEventListener('click', async () => {
  listStoriesButton.disabled = true;
  crawlSelectedButton.disabled = true;
  storyListEl.innerHTML = '';
  storyListHead.hidden = true;
  siteProgressEl.textContent = '';
  siteProgressEl.textContent = 'Đang lấy danh sách…';

  try {
    const response = await fetch('/api/stories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: document.querySelector('#siteUrl').value })
    });
    const result = await response.json();

    if (!response.ok) {
      siteProgressEl.textContent = result.error || 'Không lấy được danh sách.';
      return;
    }

    stories = result.stories || [];
    renderStoryList();
    siteProgressEl.textContent = '';
  } catch (error) {
    siteProgressEl.textContent = error.message || String(error);
  } finally {
    listStoriesButton.disabled = false;
  }
});

selectAllEl.addEventListener('change', () => {
  for (const box of storyListEl.querySelectorAll('input[type="checkbox"]')) {
    box.checked = selectAllEl.checked;
  }
  updateCrawlSelectedState();
});

function renderStoryList() {
  storyListEl.innerHTML = '';

  if (!stories.length) {
    storyListHead.hidden = true;
    siteProgressEl.textContent = 'Không tìm thấy truyện nào trên trang này.';
    return;
  }

  stories.forEach((story, index) => {
    const row = document.createElement('label');
    row.className = 'story-row';

    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = true;
    box.dataset.index = String(index);
    box.addEventListener('change', updateCrawlSelectedState);

    const marker = document.createElement('span');
    marker.className = 'story-marker';

    const text = document.createElement('span');
    text.className = 'story-title';
    text.textContent = story.title;
    text.title = story.url;

    row.append(box, marker, text);
    storyListEl.append(row);
    // Keep a handle to the row + marker so the crawl loop can highlight the
    // story currently downloading and tick off finished ones.
    story.row = row;
    story.marker = marker;
  });

  storyListHead.hidden = false;
  selectAllEl.checked = true;
  storyCountEl.textContent = `${stories.length} truyện`;
  updateCrawlSelectedState();
}

function selectedStories() {
  return [...storyListEl.querySelectorAll('input[type="checkbox"]')]
    .filter((box) => box.checked)
    .map((box) => stories[Number(box.dataset.index)]);
}

function updateCrawlSelectedState() {
  crawlSelectedButton.disabled = selectedStories().length === 0;
}

// Highlight the row of the story being crawled (clearing any previous one).
function setActiveStory(story) {
  for (const row of storyListEl.querySelectorAll('.story-row.active')) {
    row.classList.remove('active');
  }

  if (story?.row) {
    story.row.classList.add('active');
    story.row.scrollIntoView({ block: 'nearest' });
  }
}

// Tick a finished story with ✓ (done) or ✗ (error).
function markStory(story, state) {
  if (!story?.marker) {
    return;
  }

  story.row.classList.remove('active');
  story.row.classList.toggle('done', state === 'done');
  story.row.classList.toggle('failed', state === 'error');
  story.marker.textContent = state === 'done' ? '✓' : '✗';
}

crawlSelectedButton.addEventListener('click', async () => {
  const selected = selectedStories();

  if (!selected.length) {
    return;
  }

  listStoriesButton.disabled = true;
  crawlSelectedButton.disabled = true;
  startButton.disabled = true;
  stopButton.disabled = false;
  aborted = false;
  linksEl.innerHTML = '';
  logsEl.textContent = '';
  progressEl.hidden = true;

  // Clear any markers from a previous batch run.
  for (const row of storyListEl.querySelectorAll('.story-row')) {
    row.classList.remove('active', 'done', 'failed');
    const marker = row.querySelector('.story-marker');

    if (marker) {
      marker.textContent = '';
    }
  }

  const payload = {
    maxChapters: document.querySelector('#siteMaxChapters').value,
    concurrency: document.querySelector('#siteConcurrency').value,
    delayMs: document.querySelector('#siteDelayMs').value,
    force: document.querySelector('#siteForce').checked
  };

  let done = 0;

  for (let index = 0; index < selected.length; index += 1) {
    if (aborted) {
      break;
    }

    const story = selected[index];

    // Make it unmistakable which story is being crawled: label the progress
    // line with title + URL, sync the single-novel URL field to match, and
    // highlight the active row in the list.
    setActiveStory(story);
    siteProgressEl.innerHTML = '';
    siteProgressEl.append(document.createTextNode(`[${index + 1}/${selected.length}] ${story.title} — `));
    const link = document.createElement('a');
    link.href = story.url;
    link.textContent = story.url;
    link.target = '_blank';
    siteProgressEl.append(link);
    document.querySelector('#url').value = story.url;
    setStatus(`crawling ${index + 1}/${selected.length}`);

    try {
      await crawlOneStory(story.url, payload, `[${index + 1}/${selected.length}] ${story.title}: `);
      done += 1;
      markStory(story, 'done');
    } catch (error) {
      logsEl.textContent += `\n[LỖI] ${story.title}: ${error.message || error}\n`;
      markStory(story, 'error');
    }
  }

  setActiveStory(null);

  if (aborted) {
    siteProgressEl.textContent = `Đã dừng. Hoàn tất ${done}/${selected.length} truyện.`;
    setStatus('stopped');
  } else {
    siteProgressEl.textContent = `Hoàn tất ${done}/${selected.length} truyện.`;
    setStatus('completed');
  }

  listStoriesButton.disabled = false;
  startButton.disabled = false;
  stopButton.disabled = true;
  currentJobId = null;
  updateCrawlSelectedState();
});

// Start a single crawl job and resolve once it finishes, streaming its logs,
// chapter progress, and output links into the shared status panel. `progressPrefix`
// labels the bar with the story's position in the batch.
function crawlOneStory(url, payload, progressPrefix = '') {
  return new Promise(async (resolve, reject) => {
    let response;

    try {
      response = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, ...payload })
      });
    } catch (error) {
      reject(error);
      return;
    }

    const result = await response.json();

    if (!response.ok) {
      reject(new Error(result.error || 'Không start được job.'));
      return;
    }

    jobIdEl.textContent = result.id;
    currentJobId = result.id;

    const poll = async () => {
      const jobResponse = await fetch(`/api/jobs/${encodeURIComponent(result.id)}`);
      const job = await jobResponse.json();

      logsEl.textContent = (job.logs || []).join('\n');
      logsEl.scrollTop = logsEl.scrollHeight;
      renderProgress(job.logs || [], progressPrefix);
      renderLinks(job.outputLinks || []);

      if (job.status === 'running') {
        setTimeout(poll, 1000);
      } else {
        resolve(job);
      }
    };

    poll();
  });
}

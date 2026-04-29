@php
    /** @var array<string, mixed> $d */
    $d = $d ?? [];
@endphp
<div class="crawler-job-form">
    <div class="field crawler-job-form__full">
        <label for="source_url">URL trang truyện (mục lục hoặc một chương) — <strong>mỗi dòng một URL</strong> (nhiều job cùng selector)</label>
        <textarea name="source_url" id="source_url" rows="5" required placeholder="https://example.com/truyen/a&#10;https://example.com/truyen/b" @if (! empty($autofocusSource)) autofocus @endif>{{ old('source_url', $d['source_url'] ?? '') }}</textarea>
        <span class="muted" style="display:block;margin-top:0.25rem;font-size:0.8rem;">Mỗi dòng một URL <code>https://…</code>. <strong>Gắn truyện có sẵn</strong> chỉ khi đúng một dòng.</span>
    </div>

    <fieldset class="crawler-job-form__panel">
        <legend class="crawler-job-form__legend">CSS selector</legend>
        <div class="field">
            <label for="chapter_links_selector">Liên kết từng chương (tùy chọn)</label>
            <input type="text" name="chapter_links_selector" id="chapter_links_selector" value="{{ old('chapter_links_selector', $d['chapter_links_selector'] ?? '') }}" placeholder="vd: ul.list-chapter a">
            <span class="muted" style="display:block;margin-top:0.25rem;font-size:0.8rem;">Để trống: chỉ crawl đúng <code>source_url</code> như một chương.</span>
        </div>
        <div class="field">
            <label for="chapter_list_next_page_selector">Trang mục lục tiếp theo (tùy chọn)</label>
            <input type="text" name="chapter_list_next_page_selector" id="chapter_list_next_page_selector" value="{{ old('chapter_list_next_page_selector', $d['chapter_list_next_page_selector'] ?? '') }}" placeholder="vd: li.custom-page-item.nav-next a.custom-page-link">
            <span class="muted" style="display:block;margin-top:0.25rem;font-size:0.8rem;">Để trống: một trang mục lục. Có giá trị: lặp next cho đến hết.</span>
        </div>
        <div class="field">
            <label for="chapter_title_selector">Tiêu đề chương</label>
            <input type="text" name="chapter_title_selector" id="chapter_title_selector" value="{{ old('chapter_title_selector', $d['chapter_title_selector'] ?? '') }}" required placeholder="vd: ul.list-chapter a">
        </div>
        <div class="field">
            <label for="chapter_content_selector">Nội dung chương</label>
            <input type="text" name="chapter_content_selector" id="chapter_content_selector" value="{{ old('chapter_content_selector', $d['chapter_content_selector'] ?? '') }}" required placeholder="vd: #chapter-content">
            <span class="muted" style="display:block;margin-top:0.25rem;font-size:0.8rem;">Nội dung trong <code>div</code> con đầu của <code>#chapter-content</code>: <code>#chapter-content > div:first-of-type</code>. Luôn bỏ <code>div.signature</code> / <code>span.signature</code>.</span>
        </div>
    </fieldset>

    <fieldset class="crawler-job-form__panel">
        <legend class="crawler-job-form__legend">Truyện &amp; tham số crawl</legend>
        <div class="field">
            <label for="story_id">Gắn vào truyện có sẵn (tùy chọn)</label>
            <select name="story_id" id="story_id">
                <option value="">— Truyện mới —</option>
                @foreach ($stories as $s)
                    <option value="{{ $s->id }}" @selected((string) old('story_id', $d['story_id'] ?? '') === (string) $s->id)>{{ $s->title }}</option>
                @endforeach
            </select>
        </div>
        <div class="field">
            <label for="new_story_title">Tiêu đề truyện mới (tùy chọn)</label>
            <input type="text" name="new_story_title" id="new_story_title" value="{{ old('new_story_title', $d['new_story_title'] ?? '') }}" maxlength="255">
            <span class="muted" style="display:block;margin-top:0.25rem;font-size:0.8rem;">Khi không chọn truyện có sẵn: có thể để trống nếu đã điền <strong>Selector tên truyện</strong> bên dưới (worker lấy tên từ trang nguồn). Nếu điền tay, cùng một tiêu đề áp cho mọi job khi nhập nhiều URL.</span>
        </div>
        <div class="field">
            <label for="story_title_selector">Selector tên truyện trên trang nguồn (tùy chọn)</label>
            <input type="text" name="story_title_selector" id="story_title_selector" value="{{ old('story_title_selector', $d['story_title_selector'] ?? '') }}" maxlength="2000" placeholder="vd: h1.title, .breadcrumb li:last-child a">
            <span class="muted" style="display:block;margin-top:0.25rem;font-size:0.8rem;">Chỉ dùng khi <strong>truyện mới</strong> và không nhập tiêu đề tay. Worker mở <code>source_url</code>, đọc văn bản phần tử khớp selector rồi lưu làm tên truyện (tối đa 255 ký tự).</span>
        </div>
        <div class="field">
            <label for="max_chapters">Giới hạn số chương (0 / trống = không giới hạn)</label>
            <input type="number" name="max_chapters" id="max_chapters" value="{{ old('max_chapters', array_key_exists('max_chapters', $d) && $d['max_chapters'] !== null ? $d['max_chapters'] : '') }}" min="0" step="1" placeholder="vd: 50">
        </div>
        <div class="field">
            <label for="chapter_start">Bắt đầu từ chương (thứ tự mục lục)</label>
            <input type="number" name="chapter_start" id="chapter_start" value="{{ old('chapter_start', $d['chapter_start'] ?? 1) }}" min="1" step="1" required>
            <span class="muted" style="display:block;margin-top:0.25rem;font-size:0.8rem;"><code>1</code> = từ đầu; <code>101</code> = bỏ 100 URL đầu rồi mới áp giới hạn.</span>
        </div>
        <div class="field">
            <label for="delay_seconds">Nghỉ giữa các chương (giây)</label>
            <input type="number" name="delay_seconds" id="delay_seconds" value="{{ old('delay_seconds', $d['delay_seconds'] ?? '1.5') }}" min="0" max="120" step="0.1">
        </div>
        <div class="field">
            <label for="chapter_fetch_concurrency">Số chương tải song song (tùy chọn)</label>
            <input type="number" name="chapter_fetch_concurrency" id="chapter_fetch_concurrency" value="{{ old('chapter_fetch_concurrency', array_key_exists('chapter_fetch_concurrency', $d) && $d['chapter_fetch_concurrency'] !== null ? $d['chapter_fetch_concurrency'] : '') }}" min="1" max="16" step="1" placeholder="Trống = 1 hoặc .env">
            <span class="muted" style="display:block;margin-top:0.25rem;font-size:0.8rem;">Ví dụ 5: nhiều tab chương cùng lúc; lưu API vẫn đúng thứ tự mục lục.</span>
        </div>
    </fieldset>
</div>

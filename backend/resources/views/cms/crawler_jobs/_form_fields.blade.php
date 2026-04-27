@php
    /** @var array<string, mixed> $d */
    $d = $d ?? [];
@endphp
<div class="field">
    <label for="source_url">URL trang truyện (mục lục hoặc một chương) — <strong>mỗi dòng là một URL</strong></label>
    <textarea name="source_url" id="source_url" rows="6" required placeholder="https://truyenhot.net/truyen/abc&#10;https://truyenhot.net/truyen/xyz" @if (! empty($autofocusSource)) autofocus @endif>{{ old('source_url', $d['source_url'] ?? '') }}</textarea>
    <span class="muted" style="display:block;margin-top:0.25rem;font-size:0.8rem;">Nhập nhiều URL (mỗi URL một dòng) để tạo nhiều job cùng lúc với cấu hình giống nhau.</span>
</div>
<div class="field">
    <label for="chapter_links_selector">CSS selector — link từng chương (tuỳ chọn)</label>
    <input type="text" name="chapter_links_selector" id="chapter_links_selector" value="{{ old('chapter_links_selector', $d['chapter_links_selector'] ?? '') }}" placeholder="vd: ul.list-chapter a">
    <span class="muted" style="display:block;margin-top:0.25rem;font-size:0.8rem;">Để trống: chỉ crawl đúng <code>source_url</code> như một chương.</span>
</div>
<div class="field">
    <label for="chapter_list_next_page_selector">CSS selector — link trang mục lục kế (tuỳ chọn)</label>
    <input type="text" name="chapter_list_next_page_selector" id="chapter_list_next_page_selector" value="{{ old('chapter_list_next_page_selector', $d['chapter_list_next_page_selector'] ?? '') }}" placeholder="vd: li.custom-page-item.nav-next a.custom-page-link">
    <span class="muted" style="display:block;margin-top:0.25rem;font-size:0.8rem;">Để trống: chỉ một trang mục lục. Có giá trị: sau khi lấy link chương trên trang hiện tại, mở link này và lặp cho đến khi không còn phần tử khớp selector.</span>
</div>
<div class="field">
    <label for="chapter_title_selector">CSS selector — tiêu đề chương</label>
    <input type="text" name="chapter_title_selector" id="chapter_title_selector" value="{{ old('chapter_title_selector', $d['chapter_title_selector'] ?? '') }}" required placeholder="vd: ul.list-chapter a">
</div>
<div class="field">
    <label for="chapter_content_selector">CSS selector — nội dung chương</label>
    <input type="text" name="chapter_content_selector" id="chapter_content_selector" value="{{ old('chapter_content_selector', $d['chapter_content_selector'] ?? '') }}" required placeholder="vd: #chapter-content">
</div>
<div class="field">
    <label for="story_id">Gắn vào truyện có sẵn (tuỳ chọn)</label>
    <select name="story_id" id="story_id">
        <option value="">— Truyện mới —</option>
        @foreach ($stories as $s)
            <option value="{{ $s->id }}" @selected((string) old('story_id', $d['story_id'] ?? '') === (string) $s->id)>{{ $s->title }}</option>
        @endforeach
    </select>
</div>
<div class="field">
    <label for="new_story_title">Tiêu đề truyện mới (bắt buộc nếu không chọn truyện có sẵn)</label>
    <input type="text" name="new_story_title" id="new_story_title" value="{{ old('new_story_title', $d['new_story_title'] ?? '') }}" maxlength="255">
</div>
<div class="field">
    <label for="max_chapters">Giới hạn số chương (0 hoặc để trống = không giới hạn)</label>
    <input type="number" name="max_chapters" id="max_chapters" value="{{ old('max_chapters', array_key_exists('max_chapters', $d) && $d['max_chapters'] !== null ? $d['max_chapters'] : '') }}" min="0" step="1" placeholder="vd: 50">
</div>
<div class="field">
    <label for="chapter_start">Bắt đầu từ chương (thứ tự mục lục nguồn)</label>
    <input type="number" name="chapter_start" id="chapter_start" value="{{ old('chapter_start', $d['chapter_start'] ?? 1) }}" min="1" step="1" required>
    <span class="muted" style="display:block;margin-top:0.25rem;font-size:0.8rem;"><code>1</code> = từ đầu; ví dụ <code>101</code> = bỏ qua 100 URL chương đầu, rồi mới áp giới hạn số chương phía trên.</span>
</div>
<div class="field">
    <label for="delay_seconds">Nghỉ giữa các chương (giây)</label>
    <input type="number" name="delay_seconds" id="delay_seconds" value="{{ old('delay_seconds', $d['delay_seconds'] ?? '1.5') }}" min="0" max="120" step="0.1">
</div>
<div class="field">
    <label for="chapter_fetch_concurrency">Số chương tải song song (tuỳ chọn)</label>
    <input type="number" name="chapter_fetch_concurrency" id="chapter_fetch_concurrency" value="{{ old('chapter_fetch_concurrency', array_key_exists('chapter_fetch_concurrency', $d) && $d['chapter_fetch_concurrency'] !== null ? $d['chapter_fetch_concurrency'] : '') }}" min="1" max="16" step="1" placeholder="Để trống = theo crawler/.env hoặc 1">
    <span class="muted" style="display:block;margin-top:0.25rem;font-size:0.8rem;">Ví dụ 5: mở tối đa 5 trang chương cùng lúc (nhanh hơn, tốn RAM). Lưu API vẫn theo đúng thứ tự mục lục. 1 hoặc để trống = tuần tự.</span>
</div>

@extends('cms.layout')

@section('title', 'Tạo job Crawler')

@section('content')
    @include('cms.crawler_jobs._token_warning')
    <h1>Tạo job Crawler</h1>
    @if ($copyFromId)
        <p class="flash" style="margin-bottom: 1rem;">Đang sao chép cấu hình từ <strong>job #{{ $copyFromId }}</strong> — chỉ cần điền <strong>URL trang truyện</strong> mới (và chỉnh thêm nếu cần), rồi gửi.</p>
    @endif
    @php
        $d = $prefill ?? [];
    @endphp
    <p class="content-lead">Nhập URL trang truyện (mục lục), CSS selector cho link chương (để trống nếu chỉ crawl đúng một URL), selector tiêu đề và nội dung từng trang chương. Sau khi gửi, job được lưu DB và đẩy lên Redis cho worker.</p>

    <div class="card" style="max-width: 40rem;">
        <form method="post" action="{{ route('cms.crawler-jobs.store') }}">
            @csrf
            <div class="field">
                <label for="source_url">URL trang truyện (mục lục hoặc một chương)</label>
                <input type="url" name="source_url" id="source_url" value="{{ old('source_url', $d['source_url'] ?? '') }}" required placeholder="https://..." autofocus>
            </div>
            <div class="field">
                <label for="chapter_links_selector">CSS selector — link từng chương (tuỳ chọn)</label>
                <input type="text" name="chapter_links_selector" id="chapter_links_selector" value="{{ old('chapter_links_selector', $d['chapter_links_selector'] ?? '') }}" placeholder="vd: ul.list-chapter a">
                <span class="muted" style="display:block;margin-top:0.25rem;font-size:0.8rem;">Để trống: chỉ crawl đúng <code>source_url</code> như một chương.</span>
            </div>
            <div class="field">
                <label for="chapter_list_next_page_selector">CSS selector — link trang mục lục kế (tuỳ chọn)</label>
                <input type="text" name="chapter_list_next_page_selector" id="chapter_list_next_page_selector" value="{{ old('chapter_list_next_page_selector', $d['chapter_list_next_page_selector'] ?? '') }}" placeholder="vd: .custom-page-item.nav-next .custom-page-link">
                <span class="muted" style="display:block;margin-top:0.25rem;font-size:0.8rem;">Để trống: chỉ một trang mục lục. Có giá trị: sau khi lấy link chương trên trang hiện tại, mở link này và lặp cho đến khi không còn phần tử khớp selector.</span>
            </div>
            <div class="field">
                <label for="chapter_title_selector">CSS selector — tiêu đề chương</label>
                <input type="text" name="chapter_title_selector" id="chapter_title_selector" value="{{ old('chapter_title_selector', $d['chapter_title_selector'] ?? '') }}" required placeholder="vd: h2.chapter-title">
            </div>
            <div class="field">
                <label for="chapter_content_selector">CSS selector — nội dung chương</label>
                <input type="text" name="chapter_content_selector" id="chapter_content_selector" value="{{ old('chapter_content_selector', $d['chapter_content_selector'] ?? '') }}" required placeholder="vd: #chapter-c">
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
                <label for="delay_seconds">Nghỉ giữa các chương (giây)</label>
                <input type="number" name="delay_seconds" id="delay_seconds" value="{{ old('delay_seconds', $d['delay_seconds'] ?? '1.5') }}" min="0" max="120" step="0.1">
            </div>
            <div class="field">
                <label for="chapter_fetch_concurrency">Số chương tải song song (tuỳ chọn)</label>
                <input type="number" name="chapter_fetch_concurrency" id="chapter_fetch_concurrency" value="{{ old('chapter_fetch_concurrency', array_key_exists('chapter_fetch_concurrency', $d) && $d['chapter_fetch_concurrency'] !== null ? $d['chapter_fetch_concurrency'] : '') }}" min="1" max="16" step="1" placeholder="Để trống = theo crawler/.env hoặc 1">
                <span class="muted" style="display:block;margin-top:0.25rem;font-size:0.8rem;">Ví dụ 5: mở tối đa 5 trang chương cùng lúc (nhanh hơn, tốn RAM). Lưu API vẫn theo đúng thứ tự mục lục. 1 hoặc để trống = tuần tự.</span>
            </div>
            <p class="row-actions">
                <button type="submit" class="btn btn-primary">Lưu &amp; đẩy Redis</button>
                <a href="{{ route('cms.crawler-jobs.index') }}" class="btn">Huỷ</a>
            </p>
        </form>
    </div>
@endsection

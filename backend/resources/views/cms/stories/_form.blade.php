{{--
    Biến: $story (null khi tạo), $action (URL), $method ('POST'|'PUT')
--}}
@php
    $isEdit = isset($story) && $story instanceof \App\Models\Story && $story->exists;
@endphp
<form method="post" action="{{ $action }}" class="card">
    @csrf
    @if (($method ?? 'POST') === 'PUT')
        @method('PUT')
    @endif
    <div class="field">
        <label for="title">{{ $isEdit ? 'Tiêu đề' : 'Tiêu đề *' }}</label>
        <input id="title" name="title" value="{{ old('title', $story?->title ?? '') }}" required>
    </div>
    <div class="field">
        <label for="slug">{{ $isEdit ? 'Slug' : 'Slug (tùy chọn)' }}</label>
        <input id="slug" name="slug" value="{{ old('slug', $story?->slug ?? '') }}">
    </div>
    @php
        $selGenres = old('genres', $story?->genres ?? []);
        $selGenres = is_array($selGenres) ? $selGenres : [];
    @endphp
    <input type="hidden" name="_genres_form" value="1">
    <fieldset class="field" style="border: none; padding: 0; margin: 0;">
        <legend style="font-size: 0.8rem; font-weight: 600; margin-bottom: 0.35rem; color: var(--text);">Thể loại (chọn nhiều)</legend>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem 1rem;">
            @foreach (\App\Models\Story::GENRES as $g)
                <label style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 400; cursor: pointer;">
                    <input type="checkbox" name="genres[]" value="{{ $g }}" @checked(in_array($g, $selGenres, true))>
                    <span>{{ \App\Models\Story::genreLabel($g) }}</span>
                </label>
            @endforeach
        </div>
    </fieldset>
    <div class="field">
        <label for="serial_status">Trạng thái ra truyện</label>
        <select id="serial_status" name="serial_status">
            @foreach (\App\Models\Story::SERIAL_STATUSES as $st)
                <option value="{{ $st }}" @selected(old('serial_status', $story?->serial_status ?? 'ongoing') === $st)>{{ \App\Models\Story::serialStatusLabel($st) }}</option>
            @endforeach
        </select>
    </div>
    <div class="field">
        <label for="description">Mô tả</label>
        <textarea id="description" name="description" rows="4">{{ old('description', $story?->description ?? '') }}</textarea>
    </div>
    @if ($isEdit)
        <div class="field">
            <label for="crawl_chapter_start">Crawl từ chương (thứ tự mục lục nguồn)</label>
            <input type="number" id="crawl_chapter_start" name="crawl_chapter_start" min="1" step="1"
                value="{{ old('crawl_chapter_start', $story->crawl_chapter_start ?? 1) }}">
            <p class="muted" style="margin: 0.35rem 0 0; font-size: 0.85rem;">Gợi ý nội bộ (vd. tiếp tục từ chương nào). Worker dùng <strong>chapter_start</strong> trên từng <strong>job crawl</strong> — khi tạo job, điền cùng số vào ô &quot;Bắt đầu từ chương&quot;.</p>
        </div>
    @endif
    @unless ($isEdit)
        <h2>Chương đầu (tùy chọn)</h2>
        <div class="field">
            <label for="first_chapter_title">Tiêu đề chương</label>
            <input id="first_chapter_title" name="first_chapter_title" value="{{ old('first_chapter_title') }}">
        </div>
        <div class="field">
            <label for="first_chapter_content">Nội dung chương</label>
            <textarea id="first_chapter_content" name="first_chapter_content" rows="8">{{ old('first_chapter_content') }}</textarea>
        </div>
    @endunless
    <button type="submit" class="btn btn-primary">{{ $isEdit ? 'Cập nhật' : 'Lưu' }}</button>
</form>

@extends('cms.layout')

@section('title', 'Truyện')

@push('head')
    @include('cms.partials.icon-toolbar-styles')
    @include('cms.partials.cms-filter-bar-styles')
@endpush

@section('content')
    <div class="page-head" style="margin-bottom: 1rem; align-items: center;">
        <h1>Truyện</h1>
        <div class="row-actions" style="margin: 0;">
            <details class="add-dropdown">
                <summary class="btn btn-primary">+ Thêm mới ▾</summary>
                <div class="add-dropdown__menu">
                    <a href="{{ route('cms.stories.create') }}">Thêm một</a>
                    <a href="{{ route('cms.stories.bulk') }}">Thêm nhiều</a>
                </div>
            </details>
        </div>
    </div>
    <p class="content-lead" style="margin-top: -0.25rem; margin-bottom: 0.75rem;">Quản lý truyện, chương và nhân vật.</p>
    <form class="stories-filter-bar stories-filter-bar--scroll" method="get" action="{{ url()->current() }}">
        <input
            type="search"
            id="q"
            name="q"
            class="stories-filter-bar__q"
            value="{{ $q ?? '' }}"
            placeholder="Tìm theo tên truyện"
            aria-label="Tìm theo tên truyện"
            autocomplete="off"
        />
        <select id="genre-filter" class="stories-filter-bar__genre" name="genre" aria-label="Lọc theo thể loại">
            <option value="" @selected(($genre ?? '') === '')>Tất cả thể loại</option>
            @foreach (\App\Models\Story::GENRES as $g)
                <option value="{{ $g }}" @selected(($genre ?? '') === $g)>{{ \App\Models\Story::genreLabel($g) }}</option>
            @endforeach
        </select>
        <div class="stories-filter-bar__actions">
            <button type="submit" class="btn btn-primary">Lọc</button>
            @if (!empty($q) || ($genre ?? '') !== '')
                <a href="{{ url()->current() }}" class="btn">Xóa lọc</a>
            @endif
        </div>
    </form>
    <div class="card card--table">
        <div class="table-scroll">
            <table>
                <thead>
                    <tr>
                        <th>Tiêu đề</th>
                        <th>Thể loại</th>
                        <th>Ra truyện</th>
                        <th>Chương / NV</th>
                        <th class="th-actions">Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse ($stories as $story)
                        <tr>
                            <td><strong style="font-weight: 500;">{{ $story->title }}</strong></td>
                            <td>
                                <div class="cms-cell-flex-badges">
                                    @php
                                        $gList = $story->genres;
                                        $gList = is_array($gList) ? $gList : [];
                                    @endphp
                                    @forelse ($gList as $genreSlug)
                                        @php
                                            $genreBadge = match ($genreSlug) {
                                                'tu-tien' => 'cms-badge--genre-tu-tien',
                                                'huyen-huyen' => 'cms-badge--genre-huyen-huyen',
                                                'kiem-hiep' => 'cms-badge--genre-kiem-hiep',
                                                'do-thi' => 'cms-badge--genre-do-thi',
                                                'khac' => 'cms-badge--genre-khac',
                                                default => 'cms-badge--genre',
                                            };
                                        @endphp
                                        <span class="cms-badge {{ $genreBadge }}">{{ \App\Models\Story::genreLabel($genreSlug) }}</span>
                                    @empty
                                        <span class="cms-badge cms-badge--genre">{{ \App\Models\Story::genreLabel(null) }}</span>
                                    @endforelse
                                </div>
                            </td>
                            <td>
                                @php
                                    $serial = $story->serial_status;
                                    $serialBadge = match ($serial) {
                                        'ongoing' => 'cms-badge--serial-ongoing',
                                        'completed' => 'cms-badge--serial-completed',
                                        default => 'cms-badge--serial-unknown',
                                    };
                                @endphp
                                <span class="cms-badge {{ $serialBadge }}">{{ \App\Models\Story::serialStatusLabel($serial) }}</span>
                            </td>
                            <td>{{ $story->chapters_count }} / {{ $story->characters_count }}</td>
                            <td class="cms-story-row-actions">
                                <a class="icon-btn" href="{{ $story->frontendDetailUrl() }}" target="_blank" rel="noopener noreferrer" title="Mở truyện trên web" aria-label="Mở truyện trên web">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                </a>
                                <a class="icon-btn" href="{{ route('cms.stories.chapters.index', $story) }}" title="Chương" aria-label="Mở danh sách chương">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                                </a>
                                <a class="icon-btn" href="{{ route('cms.stories.characters.index', $story) }}" title="Nhân vật" aria-label="Mở danh sách nhân vật">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                </a>
                                <a class="icon-btn" href="{{ route('cms.stories.edit', $story) }}" title="Sửa truyện" aria-label="Sửa truyện">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                </a>
                                <form action="{{ route('cms.stories.reindex-chapters', $story) }}" method="post" style="display: inline; margin: 0;" onsubmit="return confirm('Gán lại số thứ tự chương (chapter_number) từ tiêu đề cho mọi chương của truyện này?');">
                                    @csrf
                                    <button type="submit" class="icon-btn" title="Re-index: gán số chương từ tiêu đề" aria-label="Re-index chương theo tiêu đề">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                            <path d="M10 2h4"/>
                                            <path d="M12 2v3"/>
                                            <circle cx="12" cy="14" r="8"/>
                                            <path d="M12 14V10"/>
                                            <path d="M12 14l3.5 2"/>
                                        </svg>
                                    </button>
                                </form>
                                <form action="{{ route('cms.stories.destroy', $story) }}" method="post" style="display: inline; margin: 0;" onsubmit="return confirm('Xóa truyện này?');">
                                    @csrf
                                    @method('DELETE')
                                    <button type="submit" class="icon-btn icon-btn--danger" title="Xóa truyện" aria-label="Xóa truyện">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                    </button>
                                </form>
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="5" class="muted" style="padding: 1.5rem; text-align: center;">Chưa có truyện. Dùng <strong>Thêm mới</strong> ở trên.</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>
    @include('cms.partials.pagination', ['paginator' => $stories])
@endsection

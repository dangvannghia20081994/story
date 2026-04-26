@extends('cms.layout')

@section('title', 'Chương')

@push('head')
    @include('cms.partials.icon-toolbar-styles')
@endpush

@section('content')
    <h1>Chương — {{ $story->title }}</h1>
    <div class="cms-story-toolbar">
        <a class="icon-btn" href="{{ route('cms.stories.index') }}" title="Danh sách truyện" aria-label="Quay lại danh sách truyện">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </a>
        <a class="icon-btn" href="{{ route('cms.stories.edit', $story) }}" title="Sửa truyện" aria-label="Sửa truyện">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </a>
        <a class="icon-btn" href="{{ route('cms.stories.characters.index', $story) }}" title="Nhân vật" aria-label="Danh sách nhân vật">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </a>
        <a class="icon-btn" href="{{ $story->frontendDetailUrl() }}" target="_blank" rel="noopener noreferrer" title="Mở truyện trên web" aria-label="Mở truyện trên web">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
        <a class="icon-btn" href="{{ route('cms.stories.index', ['q' => $story->title]) }}" title="Tìm truyện ở danh sách" aria-label="Tìm truyện ở danh sách">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </a>
        <details class="add-dropdown">
            <summary class="btn btn-primary" style="list-style: none;">Thêm chương ▾</summary>
            <div class="add-dropdown__menu">
                <a href="{{ route('cms.stories.chapters.create', $story) }}">Thêm một chương</a>
                <a href="{{ route('cms.stories.chapters.bulk', $story) }}">Thêm nhiều chương</a>
            </div>
        </details>
    </div>
    <div class="card card--table">
        <div class="table-scroll">
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Tiêu đề</th>
                        <th>Trạng thái</th>
                        <th class="th-actions">Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse ($chapters as $chapter)
                        <tr>
                            <td>{{ $chapter->id }}</td>
                            <td><strong style="font-weight: 500;">{{ $chapter->title }}</strong></td>
                            <td>{{ $chapter->status }}</td>
                            <td class="cms-story-row-actions">
                                <a class="icon-btn" href="{{ route('cms.stories.chapters.edit', [$story, $chapter]) }}" title="Sửa chương" aria-label="Sửa chương">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                </a>
                                <form action="{{ route('cms.stories.chapters.queue-tts', [$story, $chapter]) }}" method="post" style="display: inline; margin: 0;">
                                    @csrf
                                    <button
                                        type="submit"
                                        class="icon-btn"
                                        @disabled($chapter->status === \App\Models\Chapter::STATUS_PROCESSING)
                                        title="{{ $chapter->status === \App\Models\Chapter::STATUS_PROCESSING ? 'Đang xử lý — chờ xong mới TTS lại.' : 'Xếp hàng TTS (có thể TTS lại khi đã lỗi hoặc đã xong).' }}"
                                        aria-label="{{ $chapter->status === \App\Models\Chapter::STATUS_PROCESSING ? 'Đang xử lý TTS' : (in_array($chapter->status, [\App\Models\Chapter::STATUS_COMPLETED, \App\Models\Chapter::STATUS_FAILED], true) ? 'TTS lại' : 'Xếp hàng TTS') }}"
                                    >
                                        @if ($chapter->status === \App\Models\Chapter::STATUS_PROCESSING)
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                                        @elseif (in_array($chapter->status, [\App\Models\Chapter::STATUS_COMPLETED, \App\Models\Chapter::STATUS_FAILED], true))
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                                        @else
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                                        @endif
                                    </button>
                                </form>
                                <form action="{{ route('cms.stories.chapters.destroy', [$story, $chapter]) }}" method="post" style="display: inline; margin: 0;" onsubmit="return confirm('Xóa chương?');">
                                    @csrf
                                    @method('DELETE')
                                    <button type="submit" class="icon-btn icon-btn--danger" title="Xóa chương" aria-label="Xóa chương">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                    </button>
                                </form>
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="4" class="muted" style="padding: 1.5rem; text-align: center;">Chưa có chương. Dùng <strong>Thêm chương</strong> ở trên.</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>
    @include('cms.partials.pagination', ['paginator' => $chapters])
@endsection

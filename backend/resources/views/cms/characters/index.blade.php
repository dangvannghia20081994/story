@extends('cms.layout')

@section('title', 'Nhân vật')

@push('head')
    @include('cms.partials.icon-toolbar-styles')
@endpush

@section('content')
    <h1>Nhân vật — {{ $story->title }}</h1>
    <div class="cms-story-toolbar">
        <a class="icon-btn" href="{{ route('cms.stories.index') }}" title="Danh sách truyện" aria-label="Quay lại danh sách truyện">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </a>
        <a class="icon-btn" href="{{ route('cms.stories.edit', $story) }}" title="Sửa truyện" aria-label="Sửa truyện">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </a>
        <a class="icon-btn" href="{{ route('cms.stories.chapters.index', $story) }}" title="Chương" aria-label="Danh sách chương">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        </a>
        <a class="icon-btn" href="{{ $story->frontendDetailUrl() }}" target="_blank" rel="noopener noreferrer" title="Mở truyện trên web" aria-label="Mở truyện trên web">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
        <a class="icon-btn" href="{{ route('cms.stories.index', ['q' => $story->title]) }}" title="Tìm truyện ở danh sách" aria-label="Tìm truyện ở danh sách">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </a>
        <details class="add-dropdown" style="margin-left: 0.15rem;">
            <summary class="btn btn-primary" style="list-style: none;">Thêm nhân vật ▾</summary>
            <div class="add-dropdown__menu">
                <a href="{{ route('cms.stories.characters.create', $story) }}">Thêm một nhân vật</a>
                <a href="{{ route('cms.stories.characters.bulk', $story) }}">Thêm nhiều nhân vật</a>
            </div>
        </details>
    </div>
    <div class="card card--table">
        <div class="table-scroll">
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Tên</th>
                        <th class="th-actions">Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse ($characters as $character)
                        <tr>
                            <td>{{ $character->id }}</td>
                            <td><strong style="font-weight: 500;">{{ $character->name }}</strong></td>
                            <td class="cms-story-row-actions">
                                <a class="icon-btn" href="{{ route('cms.stories.characters.edit', [$story, $character]) }}" title="Sửa" aria-label="Sửa nhân vật">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                </a>
                                <form action="{{ route('cms.stories.characters.destroy', [$story, $character]) }}" method="post" style="display: inline; margin: 0;" onsubmit="return confirm('Xóa nhân vật này?');">
                                    @csrf
                                    @method('DELETE')
                                    <button type="submit" class="icon-btn icon-btn--danger" title="Xóa" aria-label="Xóa nhân vật">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                    </button>
                                </form>
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="3" class="muted" style="padding: 1.5rem; text-align: center;">Chưa có nhân vật. Dùng <strong>Thêm nhân vật</strong> ở trên (một hoặc nhiều).</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>
    @include('cms.partials.pagination', ['paginator' => $characters])
@endsection

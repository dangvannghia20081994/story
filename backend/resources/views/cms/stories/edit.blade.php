@extends('cms.layout')

@section('title', 'Sửa truyện')

@push('head')
    @include('cms.partials.icon-toolbar-styles')
@endpush

@section('content')
    <h1>Sửa truyện — {{ $story->title }}</h1>
    <div class="cms-story-toolbar">
        <a class="icon-btn" href="{{ route('cms.stories.index') }}" title="Danh sách truyện" aria-label="Quay lại danh sách truyện">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </a>
        <a class="icon-btn" href="{{ route('cms.stories.chapters.index', $story) }}" title="Chương" aria-label="Danh sách chương">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
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
    </div>
    @include('cms.stories._form', [
        'story' => $story,
        'action' => route('cms.stories.update', $story),
        'method' => 'PUT',
    ])
@endsection

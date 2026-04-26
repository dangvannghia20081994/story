@extends('cms.layout')

@section('title', 'Tạo nhân vật')

@push('head')
    @include('cms.partials.icon-toolbar-styles')
@endpush

@section('content')
    <h1>Tạo nhân vật — {{ $story->title }}</h1>
    <div class="cms-story-toolbar">
        <a class="icon-btn" href="{{ route('cms.stories.characters.index', $story) }}" title="Danh sách nhân vật" aria-label="Quay lại danh sách nhân vật">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </a>
        <a class="icon-btn" href="{{ route('cms.stories.chapters.index', $story) }}" title="Chương" aria-label="Danh sách chương">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        </a>
        <a class="icon-btn" href="{{ $story->frontendDetailUrl() }}" target="_blank" rel="noopener noreferrer" title="Mở truyện trên web" aria-label="Mở truyện trên web">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
    </div>
    @include('cms.characters._form', [
        'story' => $story,
        'character' => null,
        'action' => route('cms.stories.characters.store', $story),
        'method' => 'POST',
    ])
@endsection

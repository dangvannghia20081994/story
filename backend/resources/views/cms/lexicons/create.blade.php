@extends('cms.layout')

@section('title', 'Tạo lexicon')

@push('head')
    @include('cms.partials.icon-toolbar-styles')
@endpush

@section('content')
    <h1>Tạo lexicon</h1>
    <div class="cms-story-toolbar">
        <a class="icon-btn" href="{{ route('cms.lexicons.index') }}" title="Danh sách lexicon" aria-label="Quay lại danh sách lexicon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </a>
        <a class="icon-btn" href="{{ route('cms.stories.index') }}" title="Truyện" aria-label="Danh sách truyện">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        </a>
    </div>
    @include('cms.lexicons._form', [
        'lexiconTypes' => $lexiconTypes,
        'lexicon' => null,
        'stories' => $stories,
        'action' => route('cms.lexicons.store'),
        'method' => 'POST',
    ])
@endsection

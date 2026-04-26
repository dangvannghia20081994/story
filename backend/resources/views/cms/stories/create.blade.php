@extends('cms.layout')

@section('title', 'Tạo truyện')

@push('head')
    @include('cms.partials.icon-toolbar-styles')
@endpush

@section('content')
    <h1>Tạo truyện</h1>
    <div class="cms-story-toolbar">
        <a class="icon-btn" href="{{ route('cms.stories.index') }}" title="Danh sách truyện" aria-label="Quay lại danh sách truyện">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </a>
    </div>
    @include('cms.stories._form', [
        'story' => null,
        'action' => route('cms.stories.store'),
        'method' => 'POST',
    ])
@endsection

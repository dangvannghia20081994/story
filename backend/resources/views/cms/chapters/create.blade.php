@extends('cms.layout')

@section('title', e($story->title).' — Tạo chương')

@section('content')
    <h1>Tạo chương — {{ $story->title }}</h1>
    <p><a href="{{ route('cms.stories.chapters.index', $story) }}">← Danh sách chương</a></p>
    @include('cms.chapters._form', [
        'story' => $story,
        'chapter' => null,
        'action' => route('cms.stories.chapters.store', $story),
        'method' => 'POST',
    ])
@endsection

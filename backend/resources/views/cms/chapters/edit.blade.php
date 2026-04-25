@extends('cms.layout')

@section('title', 'Sửa chương')

@section('content')
    <h1>Sửa chương — {{ $story->title }}</h1>
    <p><a href="{{ route('cms.stories.chapters.index', $story) }}">← Danh sách chương</a></p>
    @include('cms.chapters._form', [
        'story' => $story,
        'chapter' => $chapter,
        'action' => route('cms.stories.chapters.update', [$story, $chapter]),
        'method' => 'PUT',
    ])
@endsection

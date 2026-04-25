@extends('cms.layout')

@section('title', 'Sửa truyện')

@section('content')
    <h1>Sửa truyện</h1>
    <p class="row-actions">
        <a href="{{ route('cms.stories.index') }}">← Danh sách</a>
        <a href="{{ route('cms.stories.chapters.index', $story) }}">Chương</a>
        <a href="{{ route('cms.stories.characters.index', $story) }}">Nhân vật</a>
    </p>
    @include('cms.stories._form', [
        'story' => $story,
        'action' => route('cms.stories.update', $story),
        'method' => 'PUT',
    ])
@endsection

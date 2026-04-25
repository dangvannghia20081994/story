@extends('cms.layout')

@section('title', 'Sửa nhân vật')

@section('content')
    <h1>Sửa nhân vật — {{ $story->title }}</h1>
    <p><a href="{{ route('cms.stories.characters.index', $story) }}">← Danh sách</a></p>
    @include('cms.characters._form', [
        'story' => $story,
        'character' => $character,
        'action' => route('cms.stories.characters.update', [$story, $character]),
        'method' => 'PUT',
    ])
@endsection

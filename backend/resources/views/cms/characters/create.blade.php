@extends('cms.layout')

@section('title', 'Tạo nhân vật')

@section('content')
    <h1>Tạo nhân vật — {{ $story->title }}</h1>
    <p><a href="{{ route('cms.stories.characters.index', $story) }}">← Danh sách</a></p>
    @include('cms.characters._form', [
        'story' => $story,
        'character' => null,
        'action' => route('cms.stories.characters.store', $story),
        'method' => 'POST',
    ])
@endsection

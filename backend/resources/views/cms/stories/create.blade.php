@extends('cms.layout')

@section('title', 'Tạo truyện')

@section('content')
    <h1>Tạo truyện</h1>
    <p><a href="{{ route('cms.stories.index') }}">← Danh sách</a></p>
    @include('cms.stories._form', [
        'story' => null,
        'action' => route('cms.stories.store'),
        'method' => 'POST',
    ])
@endsection

@extends('cms.layout')

@section('title', 'Tạo lexicon')

@section('content')
    <h1>Tạo lexicon</h1>
    <p><a href="{{ route('cms.lexicons.index') }}">← Danh sách</a></p>
    @include('cms.lexicons._form', [
        'types' => $types,
        'lexicon' => null,
        'action' => route('cms.lexicons.store'),
        'method' => 'POST',
    ])
@endsection

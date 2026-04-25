@extends('cms.layout')

@section('title', 'Sửa lexicon')

@section('content')
    <h1>Sửa lexicon</h1>
    <p><a href="{{ route('cms.lexicons.index') }}">← Danh sách</a></p>
    @include('cms.lexicons._form', [
        'types' => $types,
        'lexicon' => $lexicon,
        'action' => route('cms.lexicons.update', $lexicon),
        'method' => 'PUT',
    ])
@endsection

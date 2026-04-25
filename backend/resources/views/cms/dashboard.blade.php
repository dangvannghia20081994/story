@extends('cms.layout')

@section('title', 'Bảng điều khiển')

@section('content')
    <h1>Bảng điều khiển</h1>
    <p class="muted">Quản lý truyện, chương, nhân vật và lexicon.</p>
    <div class="card">
        <h2>Tổng quan</h2>
        <ul style="margin: 0; padding-left: 1.1rem;">
            <li>Truyện: <strong>{{ $storyCount }}</strong></li>
            <li>Chương: <strong>{{ $chapterCount }}</strong></li>
            <li>Lexicon: <strong>{{ $lexiconCount }}</strong></li>
        </ul>
    </div>
    <p><a href="{{ route('cms.stories.index') }}" class="btn btn-primary">Mở danh sách truyện</a></p>
@endsection

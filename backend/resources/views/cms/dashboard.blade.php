@extends('cms.layout')

@section('title', 'Bảng điều khiển')

@push('head')
    <style>
        a.stat-link:hover { box-shadow: 0 4px 14px rgba(99, 102, 241, 0.2); }
    </style>
@endpush

@section('content')
    <h1>Bảng điều khiển</h1>
    <p class="content-lead">Truyện, chương, lexicon — truy cập từ menu bên trái.</p>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
        <a href="{{ route('cms.stories.index') }}" class="card stat-link" style="text-decoration: none; color: inherit; display: block; text-align: center; padding: 1rem; transition: box-shadow 0.15s;">
            <div style="font-size: 1.5rem; font-weight: 700; color: #6366f1;">{{ $storyCount }}</div>
            <div class="muted" style="font-size: 0.8rem; margin-top: 0.2rem;">Truyện</div>
        </a>
        <div class="card" style="text-align: center; padding: 1rem;">
            <div style="font-size: 1.5rem; font-weight: 700;">{{ $chapterCount }}</div>
            <div class="muted" style="font-size: 0.8rem; margin-top: 0.2rem;">Chương</div>
        </div>
        <a href="{{ route('cms.lexicons.index') }}" class="card stat-link" style="text-decoration: none; color: inherit; display: block; text-align: center; padding: 1rem; transition: box-shadow 0.15s;">
            <div style="font-size: 1.5rem; font-weight: 700; color: #6366f1;">{{ $lexiconCount }}</div>
            <div class="muted" style="font-size: 0.8rem; margin-top: 0.2rem;">Lexicon</div>
        </a>
    </div>
    <p class="row-actions">
        <a href="{{ route('cms.stories.create') }}" class="btn btn-primary">Tạo truyện mới</a>
        <a href="{{ route('cms.stories.bulk') }}" class="btn">Thêm hàng loạt</a>
    </p>
@endsection

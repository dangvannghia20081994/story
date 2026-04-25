@extends('cms.layout')

@section('title', 'Truyện')

@section('content')
    <h1>Truyện</h1>
    <p class="row-actions" style="margin-bottom: 1rem;">
        <a href="{{ route('cms.stories.create') }}" class="btn btn-primary">+ Truyện mới</a>
        <a href="{{ route('cms.lexicons.index') }}" class="btn">Lexicon</a>
    </p>
    <div class="card" style="padding: 0; overflow-x: auto;">
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Tiêu đề</th>
                    <th>Thể loại</th>
                    <th>Chương / NV</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                @forelse ($stories as $story)
                    <tr>
                        <td>{{ $story->id }}</td>
                        <td>{{ $story->title }}</td>
                        <td>{{ \App\Models\Story::genreLabel($story->genre) }}</td>
                        <td>{{ $story->chapters_count }} / {{ $story->characters_count }}</td>
                        <td class="row-actions">
                            <a href="{{ route('cms.stories.chapters.index', $story) }}">Chương</a>
                            <a href="{{ route('cms.stories.characters.index', $story) }}">NV</a>
                            <a href="{{ route('cms.stories.edit', $story) }}">Sửa</a>
                            <form action="{{ route('cms.stories.destroy', $story) }}" method="post" style="display:inline;" onsubmit="return confirm('Xóa truyện này?');">
                                @csrf
                                @method('DELETE')
                                <button type="submit" class="btn btn-danger" style="padding: 0.2rem 0.45rem; font-size: 0.75rem;">Xóa</button>
                            </form>
                        </td>
                    </tr>
                @empty
                    <tr><td colspan="5">Chưa có truyện.</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
    @include('cms.partials.pagination', ['paginator' => $stories])
@endsection

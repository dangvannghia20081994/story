@extends('cms.layout')

@section('title', 'Chương')

@section('content')
    <h1>Chương — {{ $story->title }}</h1>
    <p class="row-actions">
        <a href="{{ route('cms.stories.index') }}">← Truyện</a>
        <a href="{{ route('cms.stories.edit', $story) }}">Sửa truyện</a>
        <a href="{{ route('cms.stories.characters.index', $story) }}">Nhân vật</a>
        <a href="{{ route('cms.stories.chapters.create', $story) }}" class="btn btn-primary" style="display:inline-block;">+ Chương</a>
    </p>
    <div class="card" style="padding: 0; overflow-x: auto;">
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Tiêu đề</th>
                    <th>Trạng thái</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                @forelse ($chapters as $chapter)
                    <tr>
                        <td>{{ $chapter->id }}</td>
                        <td>{{ $chapter->title }}</td>
                        <td>{{ $chapter->status }}</td>
                        <td class="row-actions">
                            <a href="{{ route('cms.stories.chapters.edit', [$story, $chapter]) }}">Sửa</a>
                            <form action="{{ route('cms.stories.chapters.queue-tts', [$story, $chapter]) }}" method="post" style="display:inline;">
                                @csrf
                                <button
                                    type="submit"
                                    class="btn"
                                    style="padding: 0.2rem 0.45rem; font-size: 0.75rem;"
                                    @disabled($chapter->status === \App\Models\Chapter::STATUS_PROCESSING)
                                    title="{{ $chapter->status === \App\Models\Chapter::STATUS_PROCESSING ? 'Đang xử lý — chờ xong mới TTS lại.' : 'Xếp hàng TTS (có thể TTS lại khi đã lỗi hoặc đã xong).' }}"
                                >
                                    @if ($chapter->status === \App\Models\Chapter::STATUS_PROCESSING)
                                        Đang TTS…
                                    @elseif (in_array($chapter->status, [\App\Models\Chapter::STATUS_COMPLETED, \App\Models\Chapter::STATUS_FAILED], true))
                                        TTS lại
                                    @else
                                        TTS
                                    @endif
                                </button>
                            </form>
                            <form action="{{ route('cms.stories.chapters.destroy', [$story, $chapter]) }}" method="post" style="display:inline;" onsubmit="return confirm('Xóa chương?');">
                                @csrf
                                @method('DELETE')
                                <button type="submit" class="btn btn-danger" style="padding: 0.2rem 0.45rem; font-size: 0.75rem;">Xóa</button>
                            </form>
                        </td>
                    </tr>
                @empty
                    <tr><td colspan="4">Chưa có chương.</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
    @include('cms.partials.pagination', ['paginator' => $chapters])
@endsection

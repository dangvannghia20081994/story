@extends('cms.layout')

@section('title', 'Nhân vật')

@section('content')
    <h1>Nhân vật — {{ $story->title }}</h1>
    <p class="row-actions">
        <a href="{{ route('cms.stories.index') }}">← Truyện</a>
        <a href="{{ route('cms.stories.chapters.index', $story) }}">Chương</a>
        <a href="{{ route('cms.stories.characters.create', $story) }}" class="btn btn-primary" style="display:inline-block;">+ Nhân vật</a>
    </p>
    <div class="card" style="padding: 0; overflow-x: auto;">
        <table>
            <thead>
                <tr>
                    <th>Tên</th>
                    <th>Voice ID</th>
                    <th>Pitch / Rate</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                @forelse ($characters as $character)
                    <tr>
                        <td>{{ $character->name }}</td>
                        <td>{{ $character->voice_id }}</td>
                        <td>{{ $character->pitch }} / {{ $character->rate }}</td>
                        <td class="row-actions">
                            <a href="{{ route('cms.stories.characters.edit', [$story, $character]) }}">Sửa</a>
                            <form action="{{ route('cms.stories.characters.destroy', [$story, $character]) }}" method="post" style="display:inline;" onsubmit="return confirm('Xóa?');">
                                @csrf
                                @method('DELETE')
                                <button type="submit" class="btn btn-danger" style="padding: 0.2rem 0.45rem; font-size: 0.75rem;">Xóa</button>
                            </form>
                        </td>
                    </tr>
                @empty
                    <tr><td colspan="4">Chưa có nhân vật.</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
    @include('cms.partials.pagination', ['paginator' => $characters])
@endsection

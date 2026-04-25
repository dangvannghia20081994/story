@extends('cms.layout')

@section('title', 'Lexicon')

@section('content')
    <h1>Lexicon</h1>
    <p class="row-actions">
        <a href="{{ route('cms.stories.index') }}" class="btn">Truyện</a>
        <a href="{{ route('cms.lexicons.create') }}" class="btn btn-primary">+ Mục mới</a>
    </p>
    <div class="card" style="padding: 0; overflow-x: auto;">
        <table>
            <thead>
                <tr>
                    <th>Từ</th>
                    <th>Thay thế</th>
                    <th>Loại</th>
                    <th>Ưu tiên</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                @forelse ($lexicons as $lex)
                    <tr>
                        <td>{{ $lex->word }}</td>
                        <td>{{ $lex->replacement }}</td>
                        <td>{{ $lex->type }}</td>
                        <td>{{ $lex->priority }}</td>
                        <td class="row-actions">
                            <a href="{{ route('cms.lexicons.edit', $lex) }}">Sửa</a>
                            <form action="{{ route('cms.lexicons.destroy', $lex) }}" method="post" style="display:inline;" onsubmit="return confirm('Xóa?');">
                                @csrf
                                @method('DELETE')
                                <button type="submit" class="btn btn-danger" style="padding: 0.2rem 0.45rem; font-size: 0.75rem;">Xóa</button>
                            </form>
                        </td>
                    </tr>
                @empty
                    <tr><td colspan="5">Chưa có lexicon.</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
    @include('cms.partials.pagination', ['paginator' => $lexicons])
@endsection

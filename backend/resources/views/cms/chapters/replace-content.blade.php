@extends('cms.layout')

@section('title', e($story->title).' — Thay chuỗi hàng loạt')

@section('content')
    <h1>Thay chuỗi trong nội dung chương</h1>
    <p class="muted" style="margin-bottom: 0.75rem;">{{ $story->title }} — áp dụng cho <strong>mọi chương</strong> của truyện này.</p>
    <p><a href="{{ route('cms.stories.chapters.index', $story) }}">← Danh sách chương</a></p>

    <form
        method="post"
        action="{{ route('cms.stories.chapters.replace-content.store', $story) }}"
        class="card"
        style="margin-top: 1rem; max-width: 48rem;"
        id="replace-chapter-content-form"
    >
        @csrf
        <div class="field">
            <label for="rules_text">Quy tắc thay thế (mỗi dòng một quy tắc)</label>
            <textarea
                id="rules_text"
                name="rules_text"
                rows="14"
                required
                placeholder="Ví dụ:&#10;cũ|||mới&#10;https://old.example/|||https://new.example/"
            >{{ old('rules_text') }}</textarea>
            <p class="muted" style="margin-top: 0.35rem;">
                Mỗi dòng không rỗng: <code>chuỗi tìm|||chuỗi thay</code> (đúng ba dấu <code>|</code> liên tiếp làm ranh giới).
                Khớp đúng ký tự trong cột <code>content</code> (UTF-8). Phần sau <code>|||</code> được giữ nguyên (không cắt khoảng trắng đầu/cuối của chuỗi thay).
                Thứ tự: áp dụng từ trên xuống; nếu hai quy tắc chồng lên nhau, đặt quy tắc dài hơn trước.
                Giới hạn: tối đa {{ \App\Http\Requests\Cms\ReplaceChapterContentRequest::MAX_PAIRS }} quy tắc; chuỗi tìm tối đa {{ \App\Http\Requests\Cms\ReplaceChapterContentRequest::MAX_SEARCH_LENGTH }} ký tự; chuỗi thay tối đa {{ \App\Http\Requests\Cms\ReplaceChapterContentRequest::MAX_REPLACE_LENGTH }} ký tự.
                Sau khi thay, nội dung vẫn qua bước chuẩn hóa giống khi sửa chương thủ công.
            </p>
        </div>
        @if ($errors->any())
            <div class="field">
                <ul class="muted" style="margin: 0; padding-left: 1.25rem; color: var(--danger, #b42318);">
                    @foreach ($errors->all() as $err)
                        <li>{{ $err }}</li>
                    @endforeach
                </ul>
            </div>
        @endif
        <button type="submit" class="btn btn-primary">Thay chuỗi trên mọi chương</button>
    </form>
    <script>
    (function () {
        var f = document.getElementById('replace-chapter-content-form');
        if (!f) return;
        f.addEventListener('submit', function (e) {
            if (!window.confirm('Thao tác này sửa nội dung nhiều chương. Tiếp tục?')) {
                e.preventDefault();
            }
        });
    })();
    </script>
@endsection

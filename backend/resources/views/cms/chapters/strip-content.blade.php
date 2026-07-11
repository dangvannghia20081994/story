@extends('cms.layout')

@section('title', e($story->title).' — Gỡ chuỗi hàng loạt')

@section('content')
    <h1>Gỡ chuỗi trong nội dung chương</h1>
    <p class="muted" style="margin-bottom: 0.75rem;">{{ $story->title }} — áp dụng cho <strong>mọi chương</strong> của truyện này.</p>
    <p><a href="{{ route('cms.stories.chapters.index', $story) }}">← Danh sách chương</a></p>

    <form
        method="post"
        action="{{ route('cms.stories.chapters.strip-content.store', $story) }}"
        class="card"
        style="margin-top: 1rem; max-width: 48rem;"
        id="strip-chapter-content-form"
    >
        @csrf
        <div class="field">
            <label for="phrases_text">Chuỗi cần gỡ (mỗi dòng một chuỗi)</label>
            <textarea
                id="phrases_text"
                name="phrases_text"
                rows="12"
                required
                placeholder="Ví dụ:&#10;dòng quảng cáo copy-paste&#10;https://example.com/xyz"
            >{{ old('phrases_text') }}</textarea>
            <p class="muted" style="margin-top: 0.35rem;">
                Mỗi dòng không rỗng = một đoạn văn bản sẽ bị <strong>xóa toàn bộ lần xuất hiện</strong> trong cột <code>content</code> (khớp đúng ký tự, UTF-8).
                Thứ tự: xử lý từ trên xuống; nếu hai chuỗi chồng lên nhau, đặt chuỗi dài hơn trước.
                Giới hạn: tối đa {{ \App\Http\Requests\Cms\StripChapterContentRequest::MAX_PHRASES }} chuỗi, mỗi chuỗi tối đa {{ \App\Http\Requests\Cms\StripChapterContentRequest::MAX_PHRASE_LENGTH }} ký tự.
                Sau khi gỡ, nội dung vẫn qua bước chuẩn hóa giống khi sửa chương thủ công.
            </p>
        </div>
        @if ($errors->any())
            <div class="field">
                <ul class="muted" style="margin: 0; padding-left: 1.25rem; color: #dc2626;">
                    @foreach ($errors->all() as $err)
                        <li>{{ $err }}</li>
                    @endforeach
                </ul>
            </div>
        @endif
        <button type="submit" class="btn btn-primary">Gỡ chuỗi trên mọi chương</button>
    </form>
    <script>
    (function () {
        var f = document.getElementById('strip-chapter-content-form');
        if (!f) return;
        f.addEventListener('submit', function (e) {
            if (!window.confirm('Thao tác này sửa nội dung nhiều chương. Tiếp tục?')) {
                e.preventDefault();
            }
        });
    })();
    </script>
@endsection

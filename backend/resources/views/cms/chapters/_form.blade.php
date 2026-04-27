{{--
    Biến: $story, $chapter (null khi tạo), $action, $method ('POST'|'PUT')
--}}
@php
    $isEdit = isset($chapter) && $chapter instanceof \App\Models\Chapter && $chapter->exists;
@endphp
<form method="post" action="{{ $action }}" class="card">
    @csrf
    @if (($method ?? 'POST') === 'PUT')
        @method('PUT')
    @endif
    <div class="field">
        <label for="title">{{ $isEdit ? 'Tiêu đề' : 'Tiêu đề *' }}</label>
        <input id="title" name="title" value="{{ old('title', $chapter?->title ?? '') }}" required>
    </div>
    <div class="field">
        <label for="chapter_number">Số chương (chapter_number)</label>
        <input
            id="chapter_number"
            name="chapter_number"
            type="number"
            min="1"
            max="999999"
            value="{{ old('chapter_number', $chapter?->chapter_number ?? '') }}"
            placeholder="Để trống — tự suy từ tiêu đề khi lưu (nếu khớp mẫu)"
        >
        <p class="muted" style="margin-top: 0.25rem;">Tuỳ chọn. Có giá trị thì dùng làm thứ tự đọc; khi sửa tiêu đề, nếu không đổi ô này thì không ghi đè số đã nhập.</p>
    </div>
    <div class="field">
        <label for="content">{{ $isEdit ? 'Nội dung' : 'Nội dung *' }}</label>
        <textarea id="content" name="content" rows="16" required>{{ old('content', $chapter?->content ?? '') }}</textarea>
        <p class="muted" style="margin-top: 0.35rem; max-width: 42rem;">
            Gợi ý thoại nhiều nhân vật: ngoặc thoại ASCII <code>"</code> hoặc “ ” « » (chuẩn hoá về <code>"</code>); **số dấu <code>"</code> trong cả chương phải chẵn** (đủ cặp). Trong ngoặc = lời nhân vật nếu <strong>dòng không trống ngay trước</strong> mở ngoặc có <strong>tên</strong> (trùng tên trong CMS nhân vật). Hoặc đoạn dùng <code>Tên:</code> / <code>Tên：</code> đầu đoạn (sau <code>\n\n</code>). Phần không gán tên = lời người kể.
        </p>
        <p class="muted" id="content-char-count" style="margin-top: 0.35rem;" aria-live="polite"></p>
    </div>
    @if ($isEdit)
        <div class="field">
            <label for="duration">Thời lượng (giây)</label>
            <input id="duration" type="number" name="duration" min="0" value="{{ old('duration', $chapter->duration) }}">
        </div>
        <div class="field">
            <label for="audio_path">Đường dẫn audio (storage/public)</label>
            <input id="audio_path" name="audio_path" value="{{ old('audio_path', $chapter->audio_path) }}" placeholder="vd: audio/chapters/1.mp3">
        </div>
    @endif
    <button type="submit" class="btn btn-primary">{{ $isEdit ? 'Cập nhật' : 'Lưu' }}</button>
</form>
<script>
(function () {
    var ta = document.getElementById('content');
    var out = document.getElementById('content-char-count');
    if (!ta || !out) return;
    function sync() {
        var n = ta.value.length;
        out.textContent = n.toLocaleString('vi-VN') + ' ký tự';
    }
    ta.addEventListener('input', sync);
    sync();
})();
</script>

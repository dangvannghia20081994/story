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
        <label for="content">{{ $isEdit ? 'Nội dung' : 'Nội dung *' }}</label>
        <textarea id="content" name="content" rows="16" required>{{ old('content', $chapter?->content ?? '') }}</textarea>
        <p class="muted" id="content-char-count" style="margin-top: 0.35rem;" aria-live="polite"></p>
    </div>
    <div class="field">
        <label for="status">Trạng thái</label>
        <select id="status" name="status">
            @foreach (['pending', 'processing', 'completed', 'failed'] as $st)
                <option value="{{ $st }}" @selected(old('status', $chapter?->status ?? 'pending') === $st)>{{ $st }}</option>
            @endforeach
        </select>
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
        <div class="field">
            <label for="error_message">Thông báo lỗi</label>
            <textarea id="error_message" name="error_message" rows="3">{{ old('error_message', $chapter->error_message) }}</textarea>
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

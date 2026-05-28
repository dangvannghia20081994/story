{{--
    Biến: $story, $character (null khi tạo), $action, $method ('POST'|'PUT')
--}}
@php
    $isEdit = isset($character) && $character instanceof \App\Models\Character && $character->exists;
    $voiceFile = $character?->voice_reference_path;
@endphp
<form method="post" action="{{ $action }}" class="card" enctype="multipart/form-data">
    @csrf
    @if (($method ?? 'POST') === 'PUT')
        @method('PUT')
    @endif
    <div class="field">
        <label for="name">{{ $isEdit ? 'Tên' : 'Tên *' }}</label>
        <input id="name" name="name" value="{{ old('name', $character?->name ?? '') }}" required>
    </div>

    @if ($isEdit)
        <div class="field">
            <label for="voice_preset">Preset voice (tùy chọn — bỏ trống = không dùng preset)</label>
            <input id="voice_preset" name="voice_preset" value="{{ old('voice_preset', $character->voice_preset ?? '') }}" placeholder="Binh / Tuyen / Vinh / Doan / Ly / Ngoc / Sơn">
        </div>
        <div class="field">
            <label for="pitch_semitones">Pitch (semitones, -12 → +12)</label>
            <input id="pitch_semitones" name="pitch_semitones" type="number" min="-12" max="12" value="{{ old('pitch_semitones', $character->pitch_semitones ?? 0) }}">
        </div>
        <div class="field">
            <label for="tempo_factor">Tempo (0.5 → 2.0)</label>
            <input id="tempo_factor" name="tempo_factor" type="number" step="0.05" min="0.5" max="2.0" value="{{ old('tempo_factor', $character->tempo_factor ?? 1.0) }}">
        </div>
        <div class="field">
            <label for="voice_file">File giọng mẫu (WAV/MP3, 3–10s, ≤ 5MB)</label>
            <input id="voice_file" name="voice_file" type="file" accept="audio/wav,audio/mpeg,audio/x-wav,audio/mp4,audio/x-m4a">
            @if ($voiceFile)
                <p class="muted" style="margin-top:.4rem;">Hiện đang dùng: <code>{{ $voiceFile }}</code></p>
                <label style="display:inline-flex;gap:.4rem;align-items:center;margin-top:.4rem;">
                    <input type="checkbox" name="delete_voice_file" value="1"> Xóa giọng hiện tại
                </label>
            @endif
        </div>
    @endif

    <button type="submit" class="btn btn-primary">{{ $isEdit ? 'Cập nhật' : 'Lưu' }}</button>
</form>

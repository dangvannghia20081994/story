{{--
    Biến: $story, $character (null khi tạo), $action, $method ('POST'|'PUT')
--}}
@php
    $isEdit = isset($character) && $character instanceof \App\Models\Character && $character->exists;
    $voices = \App\Support\TtsConfig::voices();
    $defaultVoice = \App\Support\TtsConfig::defaultVoiceId();
    $currentVoice = old('voice_id', $character?->voice_id ?? $defaultVoice);
@endphp
<form method="post" action="{{ $action }}" class="card">
    @csrf
    @if (($method ?? 'POST') === 'PUT')
        @method('PUT')
    @endif
    <div class="field">
        <label for="name">{{ $isEdit ? 'Tên' : 'Tên *' }}</label>
        <input id="name" name="name" value="{{ old('name', $character?->name ?? '') }}" required>
    </div>
    <div class="field">
        <label for="voice_id">Giọng TTS (mã lưu DB) @if (! $isEdit) * @endif</label>
        <select id="voice_id" name="voice_id" required>
            @foreach ($voices as $id => $label)
                <option value="{{ $id }}" @selected($currentVoice === $id)>{{ $label }}</option>
            @endforeach
            @if ($isEdit && $currentVoice !== '' && ! array_key_exists($currentVoice, $voices))
                <option value="{{ $currentVoice }}" selected>{{ $currentVoice }} (giữ giá trị hiện tại)</option>
            @endif
        </select>
        <p class="muted" style="font-size: 0.8rem; margin-top: 0.35rem;">
            Danh sách theo dịch vụ <strong>{{ strtoupper(\App\Support\TtsConfig::service()) }}</strong> (<code>TTS_SERVICE</code> trong <code>.env</code>).
            Worker FPT: mã <code>vi-VN-…</code> (Azure) không gửi được API FPT — dùng <code>FPT_TTS_VOICE</code>; tên FPT trong list áp dụng cho nhân vật <em>{{ \App\Support\TtsConfig::narratorCharacterName() }}</em> khi xếp hàng TTS.
        </p>
    </div>
    <div class="field">
        <label for="pitch">Pitch</label>
        <input id="pitch" type="number" step="0.01" name="pitch" min="0.1" max="3" value="{{ old('pitch', $isEdit ? $character->pitch : '1') }}">
    </div>
    <div class="field">
        <label for="rate">Rate</label>
        <input id="rate" type="number" step="0.01" name="rate" min="0.1" max="3" value="{{ old('rate', $isEdit ? $character->rate : '1') }}">
    </div>
    <button type="submit" class="btn btn-primary">{{ $isEdit ? 'Cập nhật' : 'Lưu' }}</button>
</form>

{{--
    Biến: $story, $character (null khi tạo), $action, $method ('POST'|'PUT')
--}}
@php
    $isEdit = isset($character) && $character instanceof \App\Models\Character && $character->exists;
    $voices = config('tts.voices', []);
    $defaultVoice = config('tts.default_voice_id');
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
        <label for="voice_id">{{ $isEdit ? 'Voice ID' : 'Voice ID *' }}</label>
        <select id="voice_id" name="voice_id" required>
            @foreach ($voices as $id => $label)
                <option value="{{ $id }}" @selected($currentVoice === $id)>{{ $label }}</option>
            @endforeach
            @if ($isEdit && $currentVoice !== '' && ! array_key_exists($currentVoice, $voices))
                <option value="{{ $currentVoice }}" selected>{{ $currentVoice }} (giữ giá trị hiện tại)</option>
            @endif
        </select>
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

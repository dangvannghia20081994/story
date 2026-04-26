{{--
    Biến: $story, $character (null khi tạo), $action, $method ('POST'|'PUT')
--}}
@php
    $isEdit = isset($character) && $character instanceof \App\Models\Character && $character->exists;
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
    <button type="submit" class="btn btn-primary">{{ $isEdit ? 'Cập nhật' : 'Lưu' }}</button>
</form>

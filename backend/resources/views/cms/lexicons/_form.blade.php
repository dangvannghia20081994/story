{{--
    Biến: $lexiconTypes, $lexicon (null khi tạo), $stories (Collection id,title), $action, $method ('POST'|'PUT')
--}}
@php
    $isEdit = isset($lexicon) && $lexicon instanceof \App\Models\Lexicon && $lexicon->exists;
@endphp
<form method="post" action="{{ $action }}" class="card">
    @csrf
    @if (($method ?? 'POST') === 'PUT')
        @method('PUT')
    @endif
    <div class="field">
        <label for="story_id">Truyện</label>
        <select id="story_id" name="story_id">
            <option value="" @selected(empty(old('story_id', $lexicon?->story_id)))>— Chung (mọi truyện) —</option>
            @foreach ($stories ?? [] as $st)
                <option value="{{ $st->id }}" @selected((string) old('story_id', $lexicon?->story_id) === (string) $st->id)>{{ $st->title }}</option>
            @endforeach
        </select>
        <p class="muted" style="margin: 0.35rem 0 0; font-size: 0.85rem;">Để trống = lexicon áp dụng cho tất cả truyện khi đọc/nghe.</p>
    </div>
    <div class="field">
        <label for="word">{{ $isEdit ? 'Từ' : 'Từ *' }}</label>
        <input id="word" name="word" value="{{ old('word', $lexicon?->word ?? '') }}" required>
    </div>
    <div class="field">
        <label for="replacement">{{ $isEdit ? 'Thay thế' : 'Thay thế *' }}</label>
        <input id="replacement" name="replacement" value="{{ old('replacement', $lexicon?->replacement ?? '') }}" required>
    </div>
    <div class="field">
        <label for="type">{{ $isEdit ? 'Loại' : 'Loại *' }}</label>
        <select id="type" name="type" required>
            @foreach ($lexiconTypes as $t)
                <option value="{{ $t->value }}" @selected(old('type', $lexicon?->type ?? 'pronunciation') === $t->value)>{{ $t->label() }}</option>
            @endforeach
        </select>
    </div>
    <div class="field">
        <label for="priority">Ưu tiên</label>
        <input id="priority" type="number" name="priority" min="0" value="{{ old('priority', $isEdit ? $lexicon->priority : '0') }}">
    </div>
    <button type="submit" class="btn btn-primary">{{ $isEdit ? 'Cập nhật' : 'Lưu' }}</button>
</form>

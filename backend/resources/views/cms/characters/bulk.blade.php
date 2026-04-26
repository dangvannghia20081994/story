@extends('cms.layout')

@section('title', 'Thêm nhiều nhân vật')
@section('content_class', 'app-content--wide')

@php
    $bulkVoiceOptions = [];
    foreach (config('tts.voices', []) as $id => $label) {
        $bulkVoiceOptions[] = ['value' => $id, 'label' => $label];
    }
@endphp

@push('head')
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/handsontable@14.5.0/dist/handsontable.full.min.css" crossorigin="anonymous">
    @include('cms.partials.bulk-handsontable-skin')
@endpush

@section('content')
    <div class="page-head" style="margin-bottom: 0.75rem;">
        <div>
            <h1>Thêm nhiều nhân vật</h1>
            <p class="content-lead" style="margin: 0;">{{ $story->title }} — mỗi dòng một nhân vật. Voice: chọn từ menu; Pitch / Rate: mặc định 1 nếu để trống.</p>
        </div>
    </div>
    <p class="bulk-hero"><a href="{{ route('cms.stories.characters.index', $story) }}">← Quay lại danh sách nhân vật</a></p>
    <div class="card" style="padding: 0.9rem 1.1rem;">
        <div class="bulk-tbar">
            <p class="muted" style="margin:0;">Cột <strong>Tên</strong> và <strong>Voice</strong> bắt buộc để lưu dòng. Có thể dán từ Excel/Sheets.</p>
            <div class="row-actions">
                <button type="button" class="btn" id="add-rows-char-bulk">+ 10 dòng</button>
            </div>
        </div>
    </div>
    <form method="post" action="{{ route('cms.stories.characters.bulk.store', $story) }}" id="characters-bulk-form" class="card sheet-outer" style="padding: 0; overflow: hidden;">
        @csrf
        <div class="card bulk-grid-card" style="margin:0; border-radius: 0.65rem; padding: 0.5rem; padding-bottom: 0;">
            <div id="bulk-char-hot" class="bulk-hot" aria-label="Bảng nhân vật hàng loạt"></div>
        </div>
        <div class="card" style="margin:0; border: none; box-shadow: none; border-top: 1px solid var(--surface-border); border-radius: 0; padding: 0.9rem 1.1rem;">
            <div class="sheet-form-footer">
                <span class="muted" id="row-hint-char" style="font-size: 0.85rem;"></span>
                <div class="row-actions">
                    <input type="hidden" name="characters" id="characters-payload" value="">
                    <button type="submit" class="btn btn-primary">Lưu tất cả</button>
                </div>
            </div>
        </div>
    </form>
    <script src="https://cdn.jsdelivr.net/npm/handsontable@14.5.0/dist/handsontable.full.min.js" crossorigin="anonymous"></script>
    <script>
    (function () {
        const BULK_VOICES = @json($bulkVoiceOptions);
        if (typeof Handsontable === 'undefined') {
            alert('Không tải được Handsontable (CDN). Kiểm tra mạng hoặc tải lại trang.');
            return;
        }
        const labelToValue = (function () {
            const o = { '': null };
            BULK_VOICES.forEach(function (v) { o[v.label] = v.value; });
            return o;
        }());
        const voiceDropdownSource = [''].concat(BULK_VOICES.map(function (v) { return v.label; }));
        const defaultLabel = BULK_VOICES[0] ? BULK_VOICES[0].label : '';
        const emptyRow = function () { return { name: '', voice: defaultLabel, pitch: 1, rate: 1 }; };
        const initial = Array.from({ length: 20 }, emptyRow);
        const el = document.getElementById('bulk-char-hot');
        const rowHint = document.getElementById('row-hint-char');
        function mapVoiceToId(cell) {
            if (cell == null) { return null; }
            const s = String(cell).trim();
            if (s === '') { return null; }
            if (labelToValue[s] !== undefined) { return labelToValue[s] === null ? null : labelToValue[s]; }
            var i;
            for (i = 0; i < BULK_VOICES.length; i++) {
                if (BULK_VOICES[i].value === s) { return s; }
            }
            const low = s.toLowerCase();
            for (i = 0; i < BULK_VOICES.length; i++) {
                if (BULK_VOICES[i].value.toLowerCase() === low) { return BULK_VOICES[i].value; }
            }
            for (i = 0; i < BULK_VOICES.length; i++) {
                if (BULK_VOICES[i].label.toLowerCase() === low) { return BULK_VOICES[i].value; }
            }
            return null;
        }
        function toNum(v) {
            if (v === null || v === undefined || v === '') { return null; }
            const n = parseFloat(String(v).replace(',', '.'));
            return Number.isFinite(n) ? n : null;
        }
        function updateHint() {
            if (!window.__charBulkHot) { return; }
            rowHint.textContent = window.__charBulkHot.countRows() + ' dòng';
        }
        const hot = new Handsontable(el, {
            data: initial,
            licenseKey: 'non-commercial-and-evaluation',
            rowHeaders: true,
            colHeaders: ['Tên *', 'Voice *', 'Pitch', 'Rate'],
            stretchH: 'all',
            height: 480,
            className: 'htWrap',
            contextMenu: true,
            columns: [
                { data: 'name', type: 'text' },
                {
                    data: 'voice',
                    type: 'dropdown',
                    source: voiceDropdownSource,
                    allowInvalid: true,
                    strict: false
                },
                { data: 'pitch', type: 'numeric', numericFormat: { pattern: '0.00' } },
                { data: 'rate', type: 'numeric', numericFormat: { pattern: '0.00' } }
            ],
            colWidths: [200, 280, 90, 90],
            afterChange: function () { updateHint(); },
            afterInit: function () { updateHint(); }
        });
        window.__charBulkHot = hot;
        document.getElementById('add-rows-char-bulk').addEventListener('click', function () {
            const d = hot.getSourceData();
            for (var k = 0; k < 10; k++) { d.push(emptyRow()); }
            hot.loadData(d);
            updateHint();
        });
        document.getElementById('characters-bulk-form').addEventListener('submit', function (e) {
            const raw = hot.getSourceData();
            const out = [];
            for (var r = 0; r < raw.length; r++) {
                const row = raw[r] || {};
                const name = (row.name != null ? String(row.name) : '').trim();
                if (!name) { continue; }
                const voiceId = mapVoiceToId(row.voice);
                if (!voiceId) { continue; }
                let pitch = toNum(row.pitch);
                let rate = toNum(row.rate);
                if (pitch === null) { pitch = 1; }
                if (rate === null) { rate = 1; }
                out.push({
                    name: name,
                    voice_id: voiceId,
                    pitch: pitch,
                    rate: rate
                });
            }
            if (out.length === 0) {
                e.preventDefault();
                alert('Cần ít nhất một dòng có tên và voice hợp lệ.');
                return;
            }
            document.getElementById('characters-payload').value = JSON.stringify(out);
        });
    })();
    </script>
@endsection

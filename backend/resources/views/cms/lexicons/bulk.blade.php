@extends('cms.layout')

@section('title', 'Thêm nhiều lexicon')
@section('content_class', 'app-content--wide')

@php
    $bulkTypeOptions = array_map(
        static fn (\App\Enums\LexiconType $t) => ['value' => $t->value, 'label' => $t->label()],
        \App\Enums\LexiconType::cases()
    );
@endphp

@push('head')
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/handsontable@14.5.0/dist/handsontable.full.min.css" crossorigin="anonymous">
    @include('cms.partials.bulk-handsontable-skin')
@endpush

@section('content')
    <div class="page-head" style="margin-bottom: 0.75rem;">
        <div>
            <h1>Thêm nhiều lexicon</h1>
            <p class="content-lead" style="margin: 0;">Mỗi dòng: từ, thay thế, loại, ưu tiên. Từ + loại phải duy nhất (cả lô và trong DB). Dán từ Excel/Sheets.</p>
        </div>
    </div>
    <p class="bulk-hero"><a href="{{ route('cms.lexicons.index') }}">← Quay lại danh sách</a></p>
    <div class="card" style="padding: 0.9rem 1.1rem;">
        <div class="bulk-tbar">
            <p class="muted" style="margin:0;">Cột tối thiểu: <strong>Từ</strong>, <strong>Thay thế</strong>, <strong>Loại</strong> (chọn từ menu). Ưu tiên mặc định 0 nếu để trống.</p>
            <div class="row-actions">
                <button type="button" class="btn" id="add-rows-lex-bulk">+ 10 dòng</button>
            </div>
        </div>
    </div>
    <form method="post" action="{{ route('cms.lexicons.bulk.store') }}" id="lexicons-bulk-form" class="card sheet-outer" style="padding: 0; overflow: hidden;">
        @csrf
        <div class="card bulk-grid-card" style="margin:0; border-radius: 0.65rem; padding: 0.5rem; padding-bottom: 0;">
            <div id="bulk-lex-hot" class="bulk-hot" aria-label="Bảng lexicon hàng loạt"></div>
        </div>
        <div class="card" style="margin:0; border: none; box-shadow: none; border-top: 1px solid var(--surface-border); border-radius: 0; padding: 0.9rem 1.1rem;">
            <div class="sheet-form-footer">
                <span class="muted" id="row-hint-lex" style="font-size: 0.85rem;"></span>
                <div class="row-actions">
                    <input type="hidden" name="lexicons" id="lexicons-payload" value="">
                    <button type="submit" class="btn btn-primary">Lưu tất cả</button>
                </div>
            </div>
        </div>
    </form>
    <script src="https://cdn.jsdelivr.net/npm/handsontable@14.5.0/dist/handsontable.full.min.js" crossorigin="anonymous"></script>
    <script>
    (function () {
        const BULK_TYPES = @json($bulkTypeOptions);
        if (typeof Handsontable === 'undefined') {
            alert('Không tải được Handsontable (CDN). Kiểm tra mạng hoặc tải lại trang.');
            return;
        }
        const labelToValue = (function () {
            const o = { '': null };
            BULK_TYPES.forEach(function (x) { o[x.label] = x.value; });
            return o;
        }());
        const typeDropdownSource = [''].concat(BULK_TYPES.map(function (x) { return x.label; }));
        const defaultType = BULK_TYPES[0] ? BULK_TYPES[0].label : 'pronunciation';
        const emptyRow = function () { return { word: '', replacement: '', type: defaultType, priority: 0 }; };
        const initial = Array.from({ length: 20 }, emptyRow);
        const el = document.getElementById('bulk-lex-hot');
        const rowHint = document.getElementById('row-hint-lex');
        function mapType(cell) {
            if (cell == null) { return null; }
            const s = String(cell).trim();
            if (s === '') { return null; }
            if (labelToValue[s] !== undefined) { return labelToValue[s] === null ? null : labelToValue[s]; }
            var i;
            for (i = 0; i < BULK_TYPES.length; i++) {
                if (BULK_TYPES[i].value === s) { return s; }
            }
            const low = s.toLowerCase();
            for (i = 0; i < BULK_TYPES.length; i++) {
                if (BULK_TYPES[i].value.toLowerCase() === low) { return BULK_TYPES[i].value; }
            }
            for (i = 0; i < BULK_TYPES.length; i++) {
                if (BULK_TYPES[i].label.toLowerCase() === low) { return BULK_TYPES[i].value; }
            }
            return null;
        }
        function toInt(v) {
            if (v === null || v === undefined || v === '') { return 0; }
            const n = parseInt(String(v), 10);
            return Number.isFinite(n) ? n : 0;
        }
        function updateHint() {
            if (!window.__lexBulkHot) { return; }
            rowHint.textContent = window.__lexBulkHot.countRows() + ' dòng';
        }
        const hot = new Handsontable(el, {
            data: initial,
            licenseKey: 'non-commercial-and-evaluation',
            rowHeaders: true,
            colHeaders: ['Từ *', 'Thay thế *', 'Loại *', 'Ưu tiên'],
            stretchH: 'all',
            height: 480,
            className: 'htWrap',
            contextMenu: true,
            columns: [
                { data: 'word', type: 'text' },
                { data: 'replacement', type: 'text' },
                {
                    data: 'type',
                    type: 'dropdown',
                    source: typeDropdownSource,
                    allowInvalid: true,
                    strict: false
                },
                { data: 'priority', type: 'numeric', numericFormat: { pattern: '0' } }
            ],
            colWidths: [180, 220, 150, 90],
            afterChange: function () { updateHint(); },
            afterInit: function () { updateHint(); }
        });
        window.__lexBulkHot = hot;
        document.getElementById('add-rows-lex-bulk').addEventListener('click', function () {
            const d = hot.getSourceData();
            for (var k = 0; k < 10; k++) { d.push(emptyRow()); }
            hot.loadData(d);
            updateHint();
        });
        document.getElementById('lexicons-bulk-form').addEventListener('submit', function (e) {
            const raw = hot.getSourceData();
            const out = [];
            for (var r = 0; r < raw.length; r++) {
                const row = raw[r] || {};
                const word = (row.word != null ? String(row.word) : '').trim();
                const replacement = (row.replacement != null ? String(row.replacement) : '').trim();
                if (!word || !replacement) { continue; }
                const t = mapType(row.type);
                if (!t) { continue; }
                out.push({
                    word: word,
                    replacement: replacement,
                    type: t,
                    priority: toInt(row.priority)
                });
            }
            if (out.length === 0) {
                e.preventDefault();
                alert('Cần ít nhất một dòng có từ, thay thế và loại hợp lệ.');
                return;
            }
            document.getElementById('lexicons-payload').value = JSON.stringify(out);
        });
    })();
    </script>
@endsection

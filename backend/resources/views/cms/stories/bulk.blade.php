@extends('cms.layout')

@php
    $bulkGenreOptions = array_map(
        static fn (string $g) => ['value' => $g, 'label' => \App\Models\Story::genreLabel($g)],
        \App\Models\Story::GENRES
    );
    $bulkSerialOptions = array_map(
        static fn (string $s) => ['value' => $s, 'label' => \App\Models\Story::serialStatusLabel($s)],
        \App\Models\Story::SERIAL_STATUSES
    );
@endphp

@section('title', 'Thêm nhiều truyện')
@section('content_class', 'app-content--wide')

@push('head')
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/handsontable@14.5.0/dist/handsontable.full.min.css" crossorigin="anonymous">
    @include('cms.partials.bulk-handsontable-skin')
@endpush

@section('content')
    <div class="page-head" style="margin-bottom: 0.75rem;">
        <div>
            <h1>Thêm nhiều truyện</h1>
            <p class="content-lead" style="margin: 0;">Lưới dữ liệu Handsontable — dán từ Excel/Sheets như bảng tính</p>
        </div>
    </div>
    <p class="bulk-hero"><a href="{{ route('cms.stories.index') }}">← Quay lại danh sách truyện</a></p>
    <div class="card" style="padding: 0.9rem 1.1rem;">
        <div class="bulk-tbar">
            <p class="muted" style="margin:0;">Chọn vùng trong Excel rồi dán. Cột <strong>thể loại</strong> dùng menu hoặc dán tên / mã thể loại. Chuột phải trên dòng: thêm / xóa dòng (theo Handsontable).</p>
            <div class="row-actions">
                <button type="button" class="btn" id="add-rows-bulk">+ 10 dòng</button>
            </div>
        </div>
    </div>
    <form method="post" action="{{ route('cms.stories.bulk.store') }}" id="bulk-form" class="card sheet-outer" style="padding: 0; overflow: hidden;">
        @csrf
        <div class="card bulk-grid-card" style="margin:0; border-radius: 0.65rem; padding: 0.5rem; padding-bottom: 0;">
            <div id="bulk-hot" class="bulk-hot" aria-label="Bảng truyện hàng loạt"></div>
        </div>
        <div class="card" style="margin:0; border: none; box-shadow: none; border-top: 1px solid var(--surface-border); border-radius: 0; padding: 0.9rem 1.1rem;">
            <div class="sheet-form-footer">
                <span class="muted" id="row-hint" style="font-size: 0.85rem;"></span>
                <div class="row-actions">
                    <input type="hidden" name="stories" id="stories-payload" value="">
                    <button type="submit" class="btn btn-primary">Lưu tất cả</button>
                </div>
            </div>
        </div>
    </form>
    <script src="https://cdn.jsdelivr.net/npm/handsontable@14.5.0/dist/handsontable.full.min.js" crossorigin="anonymous"></script>
    <script>
    (function () {
        const BULK_GENRES = @json($bulkGenreOptions);
        const BULK_SERIAL = @json($bulkSerialOptions);
        if (typeof Handsontable === 'undefined') {
            alert('Không tải được Handsontable (CDN). Kiểm tra mạng hoặc tải lại trang.');
            return;
        }
        const labelToValue = (function () {
            const o = { '': null };
            BULK_GENRES.forEach(function (g) { o[g.label] = g.value; });
            return o;
        }());
        const genreDropdownSource = [''].concat(BULK_GENRES.map(function (g) { return g.label; }));
        const serialLabelToValue = (function () {
            const o = { '': null };
            BULK_SERIAL.forEach(function (s) { o[s.label] = s.value; });
            return o;
        }());
        const serialDropdownSource = [''].concat(BULK_SERIAL.map(function (s) { return s.label; }));
        const emptyRow = function () { return { title: '', slug: '', genre: '', serial_status: '', description: '' }; };
        const initial = Array.from({ length: 24 }, emptyRow);
        const el = document.getElementById('bulk-hot');
        const rowHint = document.getElementById('row-hint');
        function mapGenreToSlug(cell) {
            if (cell == null) { return null; }
            const s = String(cell).trim();
            if (s === '') { return null; }
            if (labelToValue[s] !== undefined) { return labelToValue[s] === null ? null : labelToValue[s]; }
            for (var i = 0; i < BULK_GENRES.length; i++) {
                if (BULK_GENRES[i].value === s) { return s; }
            }
            const low = s.toLowerCase();
            for (i = 0; i < BULK_GENRES.length; i++) {
                if (BULK_GENRES[i].value.toLowerCase() === low) { return BULK_GENRES[i].value; }
            }
            for (i = 0; i < BULK_GENRES.length; i++) {
                if (BULK_GENRES[i].label.toLowerCase() === low) { return BULK_GENRES[i].value; }
            }
            return null;
        }
        function mapSerialToSlug(cell) {
            if (cell == null) { return null; }
            const s = String(cell).trim();
            if (s === '') { return null; }
            if (serialLabelToValue[s] !== undefined) { return serialLabelToValue[s] === null ? null : serialLabelToValue[s]; }
            for (var i = 0; i < BULK_SERIAL.length; i++) {
                if (BULK_SERIAL[i].value === s) { return s; }
            }
            const low = s.toLowerCase();
            for (i = 0; i < BULK_SERIAL.length; i++) {
                if (BULK_SERIAL[i].value.toLowerCase() === low) { return BULK_SERIAL[i].value; }
            }
            for (i = 0; i < BULK_SERIAL.length; i++) {
                if (BULK_SERIAL[i].label.toLowerCase() === low) { return BULK_SERIAL[i].value; }
            }
            return null;
        }
        function updateHint() {
            if (!window.__bulkHot) { return; }
            rowHint.textContent = window.__bulkHot.countRows() + ' dòng';
        }
        const hot = new Handsontable(el, {
            data: initial,
            licenseKey: 'non-commercial-and-evaluation',
            rowHeaders: true,
            colHeaders: ['Tiêu đề *', 'Slug', 'Thể loại', 'Ra truyện', 'Mô tả'],
            stretchH: 'all',
            height: 480,
            className: 'htWrap',
            contextMenu: true,
            columns: [
                { data: 'title', type: 'text' },
                { data: 'slug', type: 'text' },
                {
                    data: 'genre',
                    type: 'dropdown',
                    source: genreDropdownSource,
                    allowInvalid: true,
                    strict: false
                },
                {
                    data: 'serial_status',
                    type: 'dropdown',
                    source: serialDropdownSource,
                    allowInvalid: true,
                    strict: false
                },
                { data: 'description', type: 'text' }
            ],
            colWidths: [240, 180, 140, 130, 320],
            afterChange: function () { updateHint(); },
            afterInit: function () { updateHint(); }
        });
        window.__bulkHot = hot;
        document.getElementById('add-rows-bulk').addEventListener('click', function () {
            const d = hot.getSourceData();
            for (var k = 0; k < 10; k++) { d.push(emptyRow()); }
            hot.loadData(d);
            updateHint();
        });
        document.getElementById('bulk-form').addEventListener('submit', function (e) {
            const raw = hot.getSourceData();
            const out = [];
            for (var r = 0; r < raw.length; r++) {
                const row = raw[r] || {};
                const title = (row.title != null ? String(row.title) : '').trim();
                if (!title) { continue; }
                out.push({
                    title: title,
                    slug: (row.slug != null && String(row.slug).trim() !== '') ? String(row.slug).trim() : null,
                    genre: mapGenreToSlug(row.genre),
                    serial_status: mapSerialToSlug(row.serial_status),
                    description: (row.description != null && String(row.description).trim() !== '') ? String(row.description).trim() : null
                });
            }
            if (out.length === 0) {
                e.preventDefault();
                alert('Cần ít nhất một dòng có tiêu đề.');
                return;
            }
            document.getElementById('stories-payload').value = JSON.stringify(out);
        });
    })();
    </script>
@endsection

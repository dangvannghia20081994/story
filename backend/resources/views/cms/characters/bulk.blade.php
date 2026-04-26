@extends('cms.layout')

@section('title', 'Thêm nhiều nhân vật')
@section('content_class', 'app-content--wide')

@push('head')
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/handsontable@14.5.0/dist/handsontable.full.min.css" crossorigin="anonymous">
    @include('cms.partials.bulk-handsontable-skin')
@endpush

@section('content')
    <div class="page-head" style="margin-bottom: 0.75rem;">
        <div>
            <h1>Thêm nhiều nhân vật</h1>
            <p class="content-lead" style="margin: 0;">{{ $story->title }} — mỗi dòng một tên nhân vật.</p>
        </div>
    </div>
    <p class="bulk-hero"><a href="{{ route('cms.stories.characters.index', $story) }}">← Quay lại danh sách nhân vật</a></p>
    <div class="card" style="padding: 0.9rem 1.1rem;">
        <div class="bulk-tbar">
            <p class="muted" style="margin:0;">Cột <strong>Tên</strong> bắt buộc để lưu dòng. Có thể dán từ Excel/Sheets.</p>
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
        if (typeof Handsontable === 'undefined') {
            alert('Không tải được Handsontable (CDN). Kiểm tra mạng hoặc tải lại trang.');
            return;
        }
        const emptyRow = function () { return { name: '' }; };
        const initial = Array.from({ length: 20 }, emptyRow);
        const el = document.getElementById('bulk-char-hot');
        const rowHint = document.getElementById('row-hint-char');
        function updateHint() {
            if (!window.__charBulkHot) { return; }
            rowHint.textContent = window.__charBulkHot.countRows() + ' dòng';
        }
        const hot = new Handsontable(el, {
            data: initial,
            licenseKey: 'non-commercial-and-evaluation',
            rowHeaders: true,
            colHeaders: ['Tên *'],
            stretchH: 'all',
            height: 480,
            className: 'htWrap',
            contextMenu: true,
            columns: [
                { data: 'name', type: 'text' }
            ],
            colWidths: [400],
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
                out.push({ name: name });
            }
            if (out.length === 0) {
                e.preventDefault();
                alert('Cần ít nhất một dòng có tên.');
                return;
            }
            document.getElementById('characters-payload').value = JSON.stringify(out);
        });
    })();
    </script>
@endsection

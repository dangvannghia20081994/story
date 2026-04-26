@extends('cms.layout')

@section('title', 'Thêm nhiều chương')
@section('content_class', 'app-content--wide')

@push('head')
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/handsontable@14.5.0/dist/handsontable.full.min.css" crossorigin="anonymous">
    @include('cms.partials.bulk-handsontable-skin')
@endpush

@section('content')
    <div class="page-head" style="margin-bottom: 0.75rem;">
        <div>
            <h1>Thêm nhiều chương</h1>
            <p class="content-lead" style="margin: 0;">{{ $story->title }} — mỗi dòng một chương (tiêu đề + nội dung). Dán từ Excel/Sheets.</p>
        </div>
    </div>
    <p class="bulk-hero"><a href="{{ route('cms.stories.chapters.index', $story) }}">← Quay lại danh sách chương</a></p>
    <div class="card" style="padding: 0.9rem 1.1rem;">
        <div class="bulk-tbar">
            <p class="muted" style="margin:0;">Hai cột: <strong>Tiêu đề</strong> và <strong>Nội dung</strong> (bắt buộc cả hai để lưu dòng). Trạng thái mới: <code>pending</code>.</p>
            <div class="row-actions">
                <button type="button" class="btn" id="add-rows-chapters-bulk">+ 10 dòng</button>
            </div>
        </div>
    </div>
    <form method="post" action="{{ route('cms.stories.chapters.bulk.store', $story) }}" id="chapters-bulk-form" class="card sheet-outer" style="padding: 0; overflow: hidden;">
        @csrf
        <div class="card bulk-grid-card" style="margin:0; border-radius: 0.65rem; padding: 0.5rem; padding-bottom: 0;">
            <div id="bulk-hot" class="bulk-hot" aria-label="Bảng chương hàng loạt"></div>
        </div>
        <div class="card" style="margin:0; border: none; box-shadow: none; border-top: 1px solid var(--surface-border); border-radius: 0; padding: 0.9rem 1.1rem;">
            <div class="sheet-form-footer">
                <span class="muted" id="row-hint" style="font-size: 0.85rem;"></span>
                <div class="row-actions">
                    <input type="hidden" name="chapters" id="chapters-payload" value="">
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
        const emptyRow = function () { return { title: '', content: '' }; };
        const initial = Array.from({ length: 16 }, emptyRow);
        const el = document.getElementById('bulk-hot');
        const rowHint = document.getElementById('row-hint');
        function updateHint() {
            if (!window.__chaptersBulkHot) { return; }
            rowHint.textContent = window.__chaptersBulkHot.countRows() + ' dòng';
        }
        const hot = new Handsontable(el, {
            data: initial,
            licenseKey: 'non-commercial-and-evaluation',
            rowHeaders: true,
            colHeaders: ['Tiêu đề *', 'Nội dung *'],
            stretchH: 'all',
            wordWrap: true,
            height: 480,
            className: 'htWrap',
            contextMenu: true,
            columns: [
                { data: 'title', type: 'text' },
                { data: 'content', type: 'text' }
            ],
            colWidths: [240, 680],
            afterChange: function () { updateHint(); },
            afterInit: function () { updateHint(); }
        });
        window.__chaptersBulkHot = hot;
        document.getElementById('add-rows-chapters-bulk').addEventListener('click', function () {
            const d = hot.getSourceData();
            for (var k = 0; k < 10; k++) { d.push(emptyRow()); }
            hot.loadData(d);
            updateHint();
        });
        document.getElementById('chapters-bulk-form').addEventListener('submit', function (e) {
            const raw = hot.getSourceData();
            const out = [];
            for (var r = 0; r < raw.length; r++) {
                const row = raw[r] || {};
                const title = (row.title != null ? String(row.title) : '').trim();
                const content = (row.content != null ? String(row.content) : '').trim();
                if (!title || !content) { continue; }
                out.push({ title: title, content: content });
            }
            if (out.length === 0) {
                e.preventDefault();
                alert('Cần ít nhất một dòng có đủ tiêu đề và nội dung.');
                return;
            }
            document.getElementById('chapters-payload').value = JSON.stringify(out);
        });
    })();
    </script>
@endsection

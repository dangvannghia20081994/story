@extends('cms.layout')

@section('title', 'Lexicon từ chương')
@section('content_class', 'app-content--wide')

@php
    $bulkTypeOptions = array_map(
        static fn (\App\Enums\LexiconType $t) => ['value' => $t->value, 'label' => $t->label()],
        $lexiconTypes
    );
    $draftRows = $draftRows ?? null;
    /** @var array{min_length?: int, default_type?: string, skip_existing?: bool, prefill_replacement_as_word?: bool, truncated?: bool, count?: int}|null $extractMeta */
    $extractMeta = $extractMeta ?? null;
@endphp

@push('head')
    @if ($draftRows !== null && count($draftRows) > 0)
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/handsontable@14.5.0/dist/handsontable.full.min.css" crossorigin="anonymous">
        @include('cms.partials.bulk-handsontable-skin')
    @endif
@endpush

@section('content')
    <div class="page-head" style="margin-bottom: 0.75rem;">
        <div>
            <h1>Lexicon từ một chương</h1>
            <p class="content-lead" style="margin: 0;">Dán HTML/plain text hoặc chọn chương có sẵn — trích danh sách <strong>Từ</strong>; điền <strong>Thay thế</strong> (thường phải khác Từ). Có thể bật tùy chọn điền sẵn «Thay thế» = «Từ» rồi sửa từng dòng.</p>
        </div>
    </div>
    <p class="bulk-hero"><a href="{{ route('cms.lexicons.index') }}">← Lexicon</a></p>

    @if (session('status'))
        <p class="card" style="padding: 0.75rem 1rem; margin-bottom: 1rem; border-left: 4px solid var(--accent);">{{ session('status') }}</p>
    @endif

    @if ($extractMeta !== null && ! empty($extractMeta['truncated']))
        <p class="card" style="padding: 0.75rem 1rem; margin-bottom: 1rem; border-left: 4px solid #f59e0b;">Chỉ hiển thị tối đa 1000 từ đầu. Tăng độ dài tối thiểu hoặc rút văn nếu cần đủ bộ.</p>
    @endif

    @if ($draftRows === null || count($draftRows) === 0)
        <form method="post" action="{{ route('cms.lexicons.from-chapter.extract') }}" class="card" style="padding: 1rem 1.15rem;">
            @csrf
            <h2 style="font-size: 1rem; margin: 0 0 0.85rem;">Nạp nội dung chương</h2>

            <div style="display: flex; flex-wrap: wrap; align-items: flex-end; gap: 1rem 1.25rem; margin-bottom: 1rem;">
                <div style="flex: 1 1 12rem; min-width: 0;">
                    <label for="pick-story" style="display: block; margin-bottom: 0.25rem;">Truyện (tùy chọn)</label>
                    <select id="pick-story" name="source_story_id" style="width: 100%; max-width: 100%;">
                        <option value="">— Chọn truyện —</option>
                        @foreach ($stories as $s)
                            <option value="{{ $s->id }}">{{ $s->title }}</option>
                        @endforeach
                    </select>
                </div>
                <div style="flex: 2 1 18rem; min-width: 0;">
                    <label for="pick-chapter" style="display: block; margin-bottom: 0.25rem;">Chương</label>
                    <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem;">
                        <select id="pick-chapter" disabled style="flex: 1 1 12rem; min-width: 0; max-width: 100%;">
                            <option value="">— Chọn truyện trước —</option>
                        </select>
                        <button type="button" class="btn" id="btn-load-chapter" disabled style="flex-shrink: 0;">Đưa nội dung vào ô dưới</button>
                    </div>
                </div>
            </div>

            <div class="sheet-form-row">
                <label for="content">Nội dung chương *</label>
                <textarea id="content" name="content" rows="14" required style="width: 100%; max-width: 100%; font-family: ui-monospace, monospace; font-size: 0.85rem;">{{ old('content', $prefillContent ?? '') }}</textarea>
            </div>

            <div style="display: flex; flex-wrap: wrap; align-items: flex-end; gap: 1rem 1.25rem; margin-top: 1rem;">
                <div style="flex: 0 0 auto;">
                    <label for="min_length" style="display: block; margin-bottom: 0.25rem;">Độ dài tối thiểu</label>
                    <input type="number" id="min_length" name="min_length" min="1" max="50" value="{{ old('min_length', 2) }}" title="Ký tự" style="width: 4.5rem;">
                </div>
                <div style="flex: 1 1 14rem; min-width: 0;">
                    <label for="default_type" style="display: block; margin-bottom: 0.25rem;">Loại mặc định *</label>
                    <select id="default_type" name="default_type" required style="width: 100%; max-width: 24rem;">
                        @foreach ($lexiconTypes as $t)
                            <option value="{{ $t->value }}" @selected(old('default_type', 'pronunciation') === $t->value)>{{ $t->label() }}</option>
                        @endforeach
                    </select>
                </div>
                <div style="flex: 0 1 auto; min-width: 11rem; align-self: flex-end; padding: 0.35rem 0.55rem; border: 1px solid var(--surface-border); border-radius: 0.4rem; background: rgba(148, 163, 184, 0.08);">
                    <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                        <label style="display: flex; align-items: flex-start; gap: 0.4rem; cursor: pointer; margin: 0; line-height: 1.25;">
                            <input type="checkbox" name="skip_existing" value="1" @checked(old('skip_existing')) style="margin-top: 0.12rem; flex-shrink: 0;">
                            <span>Bỏ qua từ đã có (cùng loại)</span>
                        </label>
                        <label style="display: flex; align-items: flex-start; gap: 0.4rem; cursor: pointer; margin: 0; line-height: 1.25;">
                            <input type="checkbox" name="prefill_replacement_as_word" value="1" @checked(old('prefill_replacement_as_word')) style="margin-top: 0.12rem; flex-shrink: 0;">
                            <span>«Thay thế» mặc định = «Từ» (sửa sau; cho phép lưu khi trùng)</span>
                        </label>
                    </div>
                </div>
            </div>

            <div class="sheet-form-footer" style="margin-top: 1rem;">
                <button type="submit" class="btn btn-primary">Trích xuất từ</button>
            </div>
        </form>

        @php
            // Không dùng route(..., $story): binding / model có thể khiến thiếu tham số; URL tĩnh + {SID} cho JS.
            $tplChapters = url('/admin/lexicons/from-chapter/stories/{SID}/chapters');
        @endphp
        <script>
        (function () {
            const csrf = @json(csrf_token());
            const storySel = document.getElementById('pick-story');
            const chapterSel = document.getElementById('pick-chapter');
            const btnLoad = document.getElementById('btn-load-chapter');
            const ta = document.getElementById('content');
            const tplChapters = @json($tplChapters);
            const hasStories = @json($stories->isNotEmpty());

            function chaptersBase(sid) {
                return tplChapters.replace('{SID}', String(sid));
            }
            function chapterContentUrl(sid, cid) {
                return chaptersBase(sid) + '/' + String(cid) + '/content';
            }

            if (!storySel || !chapterSel || !btnLoad || !ta) {
                return;
            }
            if (!hasStories) {
                storySel.disabled = true;
                chapterSel.disabled = true;
                btnLoad.disabled = true;
                return;
            }

            storySel.addEventListener('change', async function () {
                const sid = storySel.value;
                chapterSel.innerHTML = '<option value="">— Chọn chương —</option>';
                chapterSel.disabled = true;
                btnLoad.disabled = true;
                if (!sid) { return; }
                try {
                    const r = await fetch(chaptersBase(sid), {
                        headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': csrf }
                    });
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    const rows = await r.json();
                    rows.forEach(function (ch) {
                        const o = document.createElement('option');
                        o.value = ch.id;
                        o.textContent = ch.title;
                        chapterSel.appendChild(o);
                    });
                    chapterSel.disabled = false;
                } catch (e) {
                    console.error(e);
                    alert('Không tải được danh sách chương.');
                }
            });

            chapterSel.addEventListener('change', function () {
                btnLoad.disabled = !chapterSel.value;
            });

            btnLoad.addEventListener('click', async function () {
                const sid = storySel.value;
                const cid = chapterSel.value;
                if (!sid || !cid) { return; }
                btnLoad.disabled = true;
                try {
                    const r = await fetch(chapterContentUrl(sid, cid), {
                        headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': csrf }
                    });
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    const data = await r.json();
                    ta.value = data.content || '';
                } catch (e) {
                    console.error(e);
                    alert('Không tải được nội dung chương.');
                } finally {
                    btnLoad.disabled = !chapterSel.value;
                }
            });
        })();
        </script>
    @else
        <p class="muted" style="margin-bottom: 0.75rem;">Đã trích <strong>{{ $extractMeta['count'] }}</strong> từ.@if (! empty($extractMeta['prefill_replacement_as_word'])) Cột «Thay thế» đã điền sẵn như «Từ» — sửa các dòng cần phiên âm; lưu vẫn cho phép dòng trùng.@else Điền <strong>Thay thế</strong> (bắt buộc, thường khác Từ).@endif Chỉnh <strong>Loại</strong> nếu cần, rồi <strong>Lưu vào lexicon</strong> hoặc <a href="{{ route('cms.lexicons.from-chapter') }}">trích xuất lại</a>.</p>

        <form method="post" action="{{ route('cms.lexicons.bulk.store') }}" id="lexicons-from-chapter-save" class="card sheet-outer" style="padding: 0; overflow: hidden;">
            @csrf
            <div class="card" style="margin:0; border-radius: 0.65rem 0.65rem 0 0; padding: 0.75rem 1rem; border-bottom: 1px solid var(--surface-border);">
                <label for="fc-bulk-story-id" class="muted" style="display:block; font-size:0.85rem; margin-bottom:0.35rem;">Truyện (để trống = lexicon chung)</label>
                <select id="fc-bulk-story-id" name="story_id" style="max-width: 28rem; width: 100%; padding: 0.4rem 0.5rem;">
                    <option value="">— Chung —</option>
                    @foreach ($stories as $st)
                        <option value="{{ $st->id }}" @selected((string) old('story_id', $extractMeta['default_story_id'] ?? '') === (string) $st->id)>{{ $st->title }}</option>
                    @endforeach
                </select>
            </div>
            <div class="card bulk-grid-card" style="margin:0; border-radius: 0.65rem; padding: 0.5rem; padding-bottom: 0;">
                <div id="bulk-lex-from-chapter-hot" class="bulk-hot" aria-label="Bảng lexicon từ chương"></div>
            </div>
            <div class="card" style="margin:0; border: none; box-shadow: none; border-top: 1px solid var(--surface-border); border-radius: 0; padding: 0.9rem 1.1rem;">
                <div class="sheet-form-footer">
                    <span class="muted" id="row-hint-lex-fc" style="font-size: 0.85rem;"></span>
                    <div class="row-actions">
                        <input type="hidden" name="lexicons" id="lexicons-payload-fc" value="">
                        <a href="{{ route('cms.lexicons.from-chapter') }}" class="btn">Trích xuất lại</a>
                        <button type="submit" class="btn btn-primary">Lưu vào lexicon</button>
                    </div>
                </div>
            </div>
        </form>

        <script src="https://cdn.jsdelivr.net/npm/handsontable@14.5.0/dist/handsontable.full.min.js" crossorigin="anonymous"></script>
        <script>
        (function () {
            const allowSameReplacement = @json((bool) ($extractMeta['prefill_replacement_as_word'] ?? false));
            const BULK_TYPES = @json($bulkTypeOptions);
            const INITIAL = @json($draftRows);
            if (typeof Handsontable === 'undefined') {
                alert('Không tải được Handsontable (CDN).');
                return;
            }
            const labelToValue = (function () {
                const o = { '': null };
                BULK_TYPES.forEach(function (x) { o[x.label] = x.value; });
                return o;
            }());
            const typeDropdownSource = [''].concat(BULK_TYPES.map(function (x) { return x.label; }));
            function mapType(cell) {
                if (cell == null) { return null; }
                const s = String(cell).trim();
                if (s === '') { return null; }
                if (labelToValue[s] !== undefined) { return labelToValue[s] === null ? null : labelToValue[s]; }
                var i;
                for (i = 0; i < BULK_TYPES.length; i++) {
                    if (BULK_TYPES[i].value === s) { return s; }
                    if (BULK_TYPES[i].label.toLowerCase() === s.toLowerCase()) { return BULK_TYPES[i].value; }
                }
                return null;
            }
            function toInt(v) {
                if (v === null || v === undefined || v === '') { return 0; }
                const n = parseInt(String(v), 10);
                return Number.isFinite(n) ? n : 0;
            }
            const el = document.getElementById('bulk-lex-from-chapter-hot');
            const rowHint = document.getElementById('row-hint-lex-fc');
            function updateHint() {
                if (!window.__lexFromChapterHot) { return; }
                rowHint.textContent = window.__lexFromChapterHot.countRows() + ' dòng';
            }
            const defaultTypeLabel = BULK_TYPES.find(function (x) { return x.value === @json($extractMeta['default_type'] ?? 'pronunciation'); });
            const typeLabel = defaultTypeLabel ? defaultTypeLabel.label : (BULK_TYPES[0] ? BULK_TYPES[0].label : '');
            const rows = INITIAL.map(function (r) {
                const lbl = BULK_TYPES.find(function (x) { return x.value === r.type; });
                return { word: r.word, replacement: r.replacement, type: lbl ? lbl.label : typeLabel, priority: r.priority || 0 };
            });
            const hot = new Handsontable(el, {
                data: rows,
                licenseKey: 'non-commercial-and-evaluation',
                rowHeaders: true,
                colHeaders: ['Từ *', 'Thay thế *', 'Loại *', 'Ưu tiên'],
                stretchH: 'all',
                height: 520,
                className: 'htWrap',
                contextMenu: true,
                columns: [
                    { data: 'word', type: 'text' },
                    { data: 'replacement', type: 'text' },
                    { data: 'type', type: 'dropdown', source: typeDropdownSource, allowInvalid: true, strict: false },
                    { data: 'priority', type: 'numeric', numericFormat: { pattern: '0' } }
                ],
                colWidths: [180, 220, 150, 90],
                afterChange: function () { updateHint(); },
                afterInit: function () { updateHint(); }
            });
            window.__lexFromChapterHot = hot;
            document.getElementById('lexicons-from-chapter-save').addEventListener('submit', function (e) {
                const raw = hot.getSourceData();
                const out = [];
                for (var r = 0; r < raw.length; r++) {
                    const row = raw[r] || {};
                    const word = (row.word != null ? String(row.word) : '').trim();
                    const replacement = (row.replacement != null ? String(row.replacement) : '').trim();
                    if (!word) { continue; }
                    if (!replacement) {
                        e.preventDefault();
                        alert('Dòng ' + (r + 1) + ': cột «Thay thế» không được để trống.');
                        return;
                    }
                    if (word === replacement && !allowSameReplacement) {
                        e.preventDefault();
                        alert('Dòng ' + (r + 1) + ': «Thay thế» phải khác «Từ» (hoặc khi trích xuất đã bật «Thay thế mặc định = Từ»).');
                        return;
                    }
                    const t = mapType(row.type);
                    if (!t) { continue; }
                    out.push({ word: word, replacement: replacement, type: t, priority: toInt(row.priority) });
                }
                if (out.length === 0) {
                    e.preventDefault();
                    alert('Cần ít nhất một dòng có Từ, Thay thế và Loại hợp lệ.');
                    return;
                }
                document.getElementById('lexicons-payload-fc').value = JSON.stringify(out);
            });
        })();
        </script>
    @endif
@endsection

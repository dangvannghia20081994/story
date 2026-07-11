@extends('cms.layout')

@section('title', e($story->title).' — Sửa chương')

@section('content')
    <h1>Sửa chương — {{ $story->title }}</h1>
    <div style="margin-bottom: 1rem;">
        <a href="{{ route('cms.stories.chapters.index', $story) }}" class="btn" style="font-size: 0.82rem; padding: 0.35rem 0.7rem;">← Danh sách chương</a>
    </div>

    {{-- Prev/Next fixed bottom-right --}}
    <style>
        .chapter-nav-fixed {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 999;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }
        .chapter-nav-fixed .btn {
            opacity: 0.3;
            transition: opacity 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
            font-size: 0.82rem;
            padding: 10px 16px;
            border-radius: 8px;
            border: none;
            color: #fff !important;
            box-shadow: 0 3px 10px rgba(0,0,0,0.18);
            text-align: center;
        }
        .chapter-nav-fixed .btn-prev {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .chapter-nav-fixed .btn-next {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        }
        .chapter-nav-fixed .btn:hover {
            opacity: 1;
            box-shadow: 0 6px 18px rgba(0,0,0,0.28);
            filter: brightness(1.08);
        }
    </style>
    <div class="chapter-nav-fixed">
        @if ($prevChapter)
            <a href="{{ route('cms.stories.chapters.edit', [$story, $prevChapter['id']]) }}"
               class="btn btn-prev"
               title="{{ $prevChapter['title'] }}">‹ Trước</a>
        @endif
        @if ($nextChapter)
            <a href="{{ route('cms.stories.chapters.edit', [$story, $nextChapter['id']]) }}"
               class="btn btn-next"
               title="{{ $nextChapter['title'] }}">Sau ›</a>
        @endif
    </div>
    @include('cms.chapters._form', [
        'story' => $story,
        'chapter' => $chapter,
        'action' => route('cms.stories.chapters.update', [$story, $chapter]),
        'method' => 'PUT',
    ])

    {{-- Section segments editor — form riêng, không submit chung với form content --}}
    <div class="card" style="margin-top: 1.5rem;">
        <h2 style="margin-bottom: 0.75rem;">Chỉnh sửa nhân vật theo câu thoại</h2>

        @php
            $segments = $chapter->content_segments ?? [];
            $hasSegments = is_array($segments) && count($segments) > 0;
            $characters = $story->characters()->orderBy('name')->pluck('name')->toArray();

            // ── Palette 10 màu (bg, text, ring hex) ─────────────────────────────
            // narration → zinc, _unknown → slate, characters → hash vào palette
            $palette = [
                'rose'    => ['bg' => '#FFE4E6', 'text' => '#9F1239', 'ring' => '#FB7185'],
                'amber'   => ['bg' => '#FEF3C7', 'text' => '#92400E', 'ring' => '#FCD34D'],
                'emerald' => ['bg' => '#D1FAE5', 'text' => '#065F46', 'ring' => '#6EE7B7'],
                'sky'     => ['bg' => '#E0F2FE', 'text' => '#0C4A6E', 'ring' => '#7DD3FC'],
                'violet'  => ['bg' => '#EDE9FE', 'text' => '#4C1D95', 'ring' => '#A78BFA'],
                'fuchsia' => ['bg' => '#FDF4FF', 'text' => '#86198F', 'ring' => '#E879F9'],
                'teal'    => ['bg' => '#CCFBF1', 'text' => '#134E4A', 'ring' => '#5EEAD4'],
                'lime'    => ['bg' => '#ECFCCB', 'text' => '#365314', 'ring' => '#BEF264'],
                'cyan'    => ['bg' => '#CFFAFE', 'text' => '#164E63', 'ring' => '#67E8F9'],
                'orange'  => ['bg' => '#FFEDD5', 'text' => '#7C2D12', 'ring' => '#FDBA74'],
            ];
            $paletteKeys = array_keys($palette);
            $paletteSize = count($paletteKeys); // 10

            // Reserved
            $colorNarration = ['bg' => '#F1F5F9', 'text' => '#334155', 'ring' => '#94A3B8']; // zinc
            $colorUnknown   = ['bg' => '#E2E8F0', 'text' => '#1E293B', 'ring' => '#64748B']; // slate đậm

            // Helper: lấy color array cho speaker
            // crc32() có thể trả âm, abs() trước khi modulo
            $speakerColor = function (string $sp) use ($palette, $paletteKeys, $paletteSize, $colorNarration, $colorUnknown): array {
                if ($sp === 'narration') return $colorNarration;
                if ($sp === '_unknown')  return $colorUnknown;
                $idx = abs(crc32($sp)) % $paletteSize;
                return $palette[$paletteKeys[$idx]];
            };

            // ── speakerOptions & sort ────────────────────────────────────────────
            // Tính số segment per speaker từ snapshot DB (không live)
            $speakerCounts = [];
            foreach ($segments as $seg) {
                $sp = $seg['speaker'] ?? 'narration';
                $speakerCounts[$sp] = ($speakerCounts[$sp] ?? 0) + 1;
            }
            // characters sort DESC theo count (0 nếu không có), narration + _unknown luôn đầu
            $charactersSorted = $characters;
            usort($charactersSorted, fn($a, $b) => ($speakerCounts[$b] ?? 0) <=> ($speakerCounts[$a] ?? 0));
            $chipOrder = array_merge(['narration', '_unknown'], $charactersSorted);

            // Chia chip thành 2 nhóm: dùng trong chapter (count > 0) và không dùng
            // → mặc định chỉ hiện nhóm "dùng" để hotbar không phình to với story >100 nhân vật.
            $usedChips = [];
            $unusedChips = [];
            foreach ($chipOrder as $sp) {
                $cnt = $speakerCounts[$sp] ?? 0;
                if ($sp === 'narration' || $sp === '_unknown' || $cnt > 0) {
                    $usedChips[] = $sp;
                } else {
                    $unusedChips[] = $sp;
                }
            }

            // Build map speaker → color name (key trong palette) để expose sang JS
            // JS sẽ dùng map này trong applyBadge
            $speakerColorMap = [];
            foreach ($chipOrder as $sp) {
                $c = $speakerColor($sp);
                $speakerColorMap[$sp] = $c; // ['bg'=>..., 'text'=>..., 'ring'=>...]
            }
            // Thêm fallback narration/unknown nếu chưa có (luôn có, nhưng phòng hờ)
            if (!isset($speakerColorMap['narration'])) $speakerColorMap['narration'] = $colorNarration;
            if (!isset($speakerColorMap['_unknown']))  $speakerColorMap['_unknown']  = $colorUnknown;
        @endphp

        {{-- Expose color map sang JS --}}
        <script>
            const SPEAKER_COLORS = @json($speakerColorMap);
            // fallback cho speaker chưa biết
            const COLOR_FALLBACK = @json($colorNarration);
        </script>

        @if (!$hasSegments)
            <p class="muted">Chưa có segments. Cần populate thủ công (script offline phân tích nhân vật).</p>
        @else
            <form id="speakers-form" method="post" action="{{ route('cms.stories.chapters.update-speakers', [$story, $chapter]) }}">
                @csrf

                {{-- Toolbar: save + counter --}}
                <div style="margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                    <span class="muted" style="font-size: 0.8rem;">{{ count($segments) }} segment</span>
                    <span id="modified-counter" class="muted" style="font-size: 0.8rem; display: none;">
                        — <span id="modified-count">0</span> thay đổi
                    </span>
                    <button type="submit" class="btn btn-primary" style="padding: 0.38rem 0.8rem; font-size: 0.82rem;">Lưu speaker</button>
                    <button type="button" id="reset-btn" class="btn" style="padding: 0.38rem 0.8rem; font-size: 0.82rem; display: none;">Reset</button>
                </div>

                {{-- Hotbar chip speakers (sticky) --}}
                <div id="speaker-hotbar" style="
                    position: sticky;
                    top: 3.2rem;
                    z-index: 30;
                    background: var(--surface);
                    border: 1px solid var(--surface-border);
                    border-radius: 0.5rem;
                    padding: 0.55rem 0.75rem;
                    margin-bottom: 0.75rem;
                    box-shadow: 0 2px 8px rgba(15,23,42,0.07);
                ">
                    {{-- Toolbar: label + search + toggle --}}
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; flex-wrap: wrap;">
                        <span class="muted" style="font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; flex-shrink: 0;">Speaker:</span>
                        <input
                            type="search"
                            id="chip-search"
                            placeholder="Lọc theo tên… ({{ count($unusedChips) }} chưa dùng)"
                            style="
                                flex: 1;
                                min-width: 8rem;
                                max-width: 18rem;
                                font-size: 0.76rem;
                                padding: 0.22rem 0.55rem;
                                border: 1px solid var(--surface-border);
                                border-radius: 0.35rem;
                                background: var(--surface);
                                color: var(--text);
                            "
                            autocomplete="off"
                        >
                        @if (count($unusedChips) > 0)
                            <button
                                type="button"
                                id="chip-toggle-all"
                                class="btn"
                                style="font-size: 0.72rem; padding: 0.2rem 0.55rem;"
                                data-expanded="0"
                            >Hiện tất cả ({{ count($unusedChips) }})</button>
                        @endif
                    </div>

                    {{-- Chip container: cap chiều cao, scroll khi quá nhiều --}}
                    <div id="chip-list" style="
                        display: flex;
                        flex-wrap: wrap;
                        gap: 0.4rem 0.5rem;
                        align-items: center;
                        max-height: 8rem;
                        overflow-y: auto;
                    ">
                        @foreach ($usedChips as $chipIdx => $sp)
                            @php
                                $cnt = $speakerCounts[$sp] ?? 0;
                                $c   = $speakerColor($sp);
                            @endphp
                            <button
                                type="button"
                                class="speaker-chip"
                                data-speaker="{{ $sp }}"
                                data-chip-idx="{{ $chipIdx }}"
                                data-used="1"
                                style="
                                    display: inline-flex;
                                    align-items: center;
                                    gap: 0.3rem;
                                    padding: 0.3rem 0.7rem;
                                    border-radius: 9999px;
                                    border: 2px solid transparent;
                                    background: {{ $c['bg'] }};
                                    color: {{ $c['text'] }};
                                    font-size: 0.78rem;
                                    font-weight: 600;
                                    cursor: pointer;
                                    font-family: inherit;
                                    transition: transform 0.1s, box-shadow 0.1s;
                                    white-space: nowrap;
                                "
                                title="Hotkey: {{ $chipIdx + 1 <= 9 ? $chipIdx + 1 : '-' }}"
                            >
                                <span class="chip-label">{{ $sp }}</span>
                                <span class="chip-counter" data-speaker="{{ $sp }}" style="
                                    display: inline-flex;
                                    align-items: center;
                                    justify-content: center;
                                    min-width: 1.1rem;
                                    height: 1.1rem;
                                    padding: 0 0.2rem;
                                    border-radius: 9999px;
                                    background: rgba(0,0,0,0.12);
                                    font-size: 0.68rem;
                                    font-weight: 700;
                                ">{{ $cnt }}</span>
                            </button>
                        @endforeach
                        @foreach ($unusedChips as $offset => $sp)
                            @php
                                $chipIdx = count($usedChips) + $offset;
                                $cnt = $speakerCounts[$sp] ?? 0;
                                $c   = $speakerColor($sp);
                            @endphp
                            <button
                                type="button"
                                class="speaker-chip chip-unused"
                                data-speaker="{{ $sp }}"
                                data-chip-idx="{{ $chipIdx }}"
                                data-used="0"
                                style="
                                    display: none;
                                    align-items: center;
                                    gap: 0.3rem;
                                    padding: 0.3rem 0.7rem;
                                    border-radius: 9999px;
                                    border: 2px solid transparent;
                                    background: {{ $c['bg'] }};
                                    color: {{ $c['text'] }};
                                    font-size: 0.78rem;
                                    font-weight: 600;
                                    cursor: pointer;
                                    font-family: inherit;
                                    transition: transform 0.1s, box-shadow 0.1s;
                                    white-space: nowrap;
                                    opacity: 0.65;
                                "
                            >
                                <span class="chip-label">{{ $sp }}</span>
                                <span class="chip-counter" data-speaker="{{ $sp }}" style="
                                    display: inline-flex;
                                    align-items: center;
                                    justify-content: center;
                                    min-width: 1.1rem;
                                    height: 1.1rem;
                                    padding: 0 0.2rem;
                                    border-radius: 9999px;
                                    background: rgba(0,0,0,0.12);
                                    font-size: 0.68rem;
                                    font-weight: 700;
                                ">{{ $cnt }}</span>
                            </button>
                        @endforeach
                    </div>
                </div>

                {{-- Segment rows --}}
                <div id="segments-list" style="border: 1px solid var(--surface-border); border-radius: 0.5rem; overflow: hidden;">
                    @foreach ($segments as $i => $seg)
                        @php
                            $currentSpeaker = $seg['speaker'] ?? 'narration';
                            $bc = $speakerColor($currentSpeaker);
                        @endphp
                        <div
                            class="segment-row"
                            data-idx="{{ $i }}"
                            data-original-speaker="{{ $currentSpeaker }}"
                            style="
                                display: grid;
                                grid-template-columns: 2.5rem 10rem 1fr;
                                gap: 0.4rem 0.6rem;
                                align-items: start;
                                padding: 0.5rem 0.75rem;
                                border-bottom: 1px solid var(--surface-border);
                                cursor: pointer;
                                position: relative;
                                user-select: none;
                            "
                        >
                            {{-- Dirty indicator --}}
                            <span class="dirty-dot" style="
                                display: none;
                                position: absolute;
                                left: 0.25rem;
                                top: 50%;
                                transform: translateY(-50%);
                                width: 0.45rem;
                                height: 0.45rem;
                                border-radius: 50%;
                                background: #f59e0b;
                            "></span>

                            {{-- Index --}}
                            <span class="muted" style="font-size: 0.78rem; padding-top: 0.3rem; text-align: right; font-variant-numeric: tabular-nums;">#{{ $i + 1 }}</span>

                            {{-- Speaker badge --}}
                            <div style="padding-top: 0.28rem;">
                                <span class="speaker-badge" data-idx="{{ $i }}" style="
                                    display: inline-block;
                                    padding: 0.18rem 0.6rem;
                                    border-radius: 9999px;
                                    font-size: 0.73rem;
                                    font-weight: 600;
                                    white-space: nowrap;
                                    max-width: 9.5rem;
                                    overflow: hidden;
                                    text-overflow: ellipsis;
                                    background: {{ $bc['bg'] }};
                                    color: {{ $bc['text'] }};
                                ">{{ $currentSpeaker }}</span>
                            </div>

                            {{-- Text --}}
                            <div style="
                                font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
                                font-size: 0.79rem;
                                line-height: 1.55;
                                color: var(--text);
                                padding-top: 0.28rem;
                                word-break: break-word;
                            ">{{ $seg['text'] ?? '' }}</div>

                            {{-- Hidden input submit --}}
                            <input type="hidden" name="speakers[{{ $i }}]" value="{{ $currentSpeaker }}" class="speaker-input" data-idx="{{ $i }}">
                        </div>
                    @endforeach
                </div>

                <div style="margin-top: 0.85rem; padding-bottom: 5rem; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                    <button type="submit" class="btn btn-primary" style="padding: 0.38rem 0.8rem; font-size: 0.82rem;">Lưu speaker</button>
                    <button type="button" id="reset-btn-bottom" class="btn" style="padding: 0.38rem 0.8rem; font-size: 0.82rem; display: none;">Reset</button>
                    <span id="modified-counter-bottom" class="muted" style="font-size: 0.8rem; display: none;">
                        <span id="modified-count-bottom">0</span> thay đổi chưa lưu
                    </span>
                </div>
            </form>
        @endif
    </div>
@endsection

@push('scripts')
<script>
(function () {
    'use strict';

    // ─── Color lookup từ SPEAKER_COLORS map (server-side built) ──────────────
    // SPEAKER_COLORS được expose bởi <script> phía trên (ngoài push block)
    function speakerStyle(sp) {
        if (typeof SPEAKER_COLORS !== 'undefined' && SPEAKER_COLORS[sp]) {
            return SPEAKER_COLORS[sp];
        }
        // fallback: dùng COLOR_FALLBACK (zinc) cho speaker lạ chưa có trong map
        if (typeof COLOR_FALLBACK !== 'undefined') return COLOR_FALLBACK;
        return { bg: '#F1F5F9', text: '#334155' };
    }

    // ─── State ────────────────────────────────────────────────────────────────
    var rows = document.querySelectorAll('.segment-row');
    var totalRows = rows.length;
    if (totalRows === 0) return;

    // Snapshot từ DOM (data-original-speaker)
    var originalSpeakers = Array.from(rows).map(function (r) {
        return r.dataset.originalSpeaker || 'narration';
    });
    // Working copy
    var speakers = originalSpeakers.slice();

    var activeSpeaker = null;     // chip đang active
    var lastClickedIdx = null;    // shift+click range anchor

    // ─── DOM refs ─────────────────────────────────────────────────────────────
    var chips = document.querySelectorAll('.speaker-chip');
    var chipSearch = document.getElementById('chip-search');
    var chipToggleAll = document.getElementById('chip-toggle-all');
    var modifiedCounter   = document.getElementById('modified-counter');
    var modifiedCount     = document.getElementById('modified-count');
    var modifiedCounterBot = document.getElementById('modified-counter-bottom');
    var modifiedCountBot  = document.getElementById('modified-count-bottom');
    var resetBtn     = document.getElementById('reset-btn');
    var resetBtnBot  = document.getElementById('reset-btn-bottom');

    // ─── Helpers ──────────────────────────────────────────────────────────────
    function countModified() {
        var n = 0;
        for (var i = 0; i < totalRows; i++) {
            if (speakers[i] !== originalSpeakers[i]) n++;
        }
        return n;
    }

    function updateModifiedUI() {
        var n = countModified();
        var visible = n > 0;
        if (modifiedCounter)    { modifiedCounter.style.display    = visible ? '' : 'none'; }
        if (modifiedCount)      { modifiedCount.textContent        = n; }
        if (modifiedCounterBot) { modifiedCounterBot.style.display = visible ? '' : 'none'; }
        if (modifiedCountBot)   { modifiedCountBot.textContent     = n; }
        if (resetBtn)    { resetBtn.style.display    = visible ? '' : 'none'; }
        if (resetBtnBot) { resetBtnBot.style.display = visible ? '' : 'none'; }
    }

    function speakerCountMap() {
        var map = {};
        for (var i = 0; i < totalRows; i++) {
            var sp = speakers[i];
            map[sp] = (map[sp] || 0) + 1;
        }
        return map;
    }

    function updateChipCounters() {
        var map = speakerCountMap();
        document.querySelectorAll('.chip-counter').forEach(function (el) {
            var sp = el.dataset.speaker;
            el.textContent = map[sp] || 0;
        });
    }

    function applyBadge(idx, sp) {
        var badge = document.querySelector('.speaker-badge[data-idx="' + idx + '"]');
        if (!badge) return;
        var st = speakerStyle(sp);
        badge.textContent         = sp;
        badge.style.background    = st.bg;
        badge.style.color         = st.text;
    }

    function applyDirtyDot(idx) {
        var row = rows[idx];
        if (!row) return;
        var dot = row.querySelector('.dirty-dot');
        if (!dot) return;
        dot.style.display = (speakers[idx] !== originalSpeakers[idx]) ? '' : 'none';
    }

    function setRowHighlight(idx, on) {
        if (!rows[idx]) return;
        rows[idx].style.background = on
            ? 'rgba(99,102,241,0.08)'
            : '';
    }

    // ─── Core: set speaker for 1 row ─────────────────────────────────────────
    function setSpeaker(idx, sp) {
        if (idx < 0 || idx >= totalRows) return;
        speakers[idx] = sp;
        applyBadge(idx, sp);
        applyDirtyDot(idx);
        // update hidden input
        var input = document.querySelector('.speaker-input[data-idx="' + idx + '"]');
        if (input) input.value = sp;
        updateChipCounters();
        updateModifiedUI();
    }

    function applyRange(from, to, sp) {
        var lo = Math.min(from, to), hi = Math.max(from, to);
        for (var i = lo; i <= hi; i++) {
            setSpeaker(i, sp);
        }
    }

    // ─── Row hover (row bg) ───────────────────────────────────────────────────
    rows.forEach(function (row, idx) {
        row.addEventListener('mouseenter', function () { setRowHighlight(idx, true); });
        row.addEventListener('mouseleave', function () { setRowHighlight(idx, false); });
    });

    // ─── Row click ────────────────────────────────────────────────────────────
    rows.forEach(function (row, idx) {
        row.addEventListener('click', function (e) {
            if (!activeSpeaker) {
                // Nhấp nhẹ: flash hotbar để user chú ý
                var hotbar = document.getElementById('speaker-hotbar');
                if (hotbar) {
                    hotbar.style.outline = '2px solid #f59e0b';
                    setTimeout(function () { hotbar.style.outline = ''; }, 600);
                }
                return;
            }
            if (e.shiftKey && lastClickedIdx !== null) {
                applyRange(lastClickedIdx, idx, activeSpeaker);
            } else {
                setSpeaker(idx, activeSpeaker);
            }
            lastClickedIdx = idx;
        });
    });

    // ─── Chip click ───────────────────────────────────────────────────────────
    chips.forEach(function (chip) {
        chip.addEventListener('click', function () {
            var sp = chip.dataset.speaker;
            var st = speakerStyle(sp);
            // Deactivate all — restore each chip's own color
            chips.forEach(function (c) {
                var cSp = c.dataset.speaker;
                var cSt = speakerStyle(cSp);
                c.style.borderColor = 'transparent';
                c.style.transform   = '';
                c.style.boxShadow   = '';
                c.style.background  = cSt.bg;
                c.style.color       = cSt.text;
            });
            // Active state: viền dày cùng màu ring của speaker, scale up
            chip.style.borderColor = st.ring || st.text;
            chip.style.transform   = 'scale(1.05)';
            chip.style.boxShadow   = '0 0 0 3px ' + (st.ring ? st.ring + '55' : 'rgba(99,102,241,0.25)');
            activeSpeaker = sp;
        });
    });

    // ─── Hotkey 1-9 → chip by position ───────────────────────────────────────
    document.addEventListener('keydown', function (e) {
        // Bỏ qua khi focus vào input/textarea/select
        var tag = document.activeElement && document.activeElement.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        var n = parseInt(e.key, 10);
        if (n >= 1 && n <= 9) {
            var target = chips[n - 1];
            if (target) target.click();
        }
    });

    // ─── Reset ────────────────────────────────────────────────────────────────
    function doReset() {
        for (var i = 0; i < totalRows; i++) {
            speakers[i] = originalSpeakers[i];
            applyBadge(i, originalSpeakers[i]);
            applyDirtyDot(i);
            var input = document.querySelector('.speaker-input[data-idx="' + i + '"]');
            if (input) input.value = originalSpeakers[i];
        }
        updateChipCounters();
        updateModifiedUI();
        lastClickedIdx = null;
    }
    if (resetBtn)    { resetBtn.addEventListener('click',    doReset); }
    if (resetBtnBot) { resetBtnBot.addEventListener('click', doReset); }

    // ─── Chip filter (search) + toggle unused ────────────────────────────────
    var showAllUnused = false;

    function chipDefaultDisplay(chip) {
        // Chip "used" luôn inline-flex; "unused" chỉ show khi toggle bật.
        return (chip.dataset.used === '1' || showAllUnused) ? 'inline-flex' : 'none';
    }

    function applyChipFilter() {
        var q = (chipSearch && chipSearch.value || '').trim().toLowerCase();
        chips.forEach(function (chip) {
            var name = (chip.dataset.speaker || '').toLowerCase();
            var matchesSearch = q === '' || name.indexOf(q) !== -1;
            if (q !== '') {
                // Khi đang search → show mọi chip match, bất kể used/unused
                chip.style.display = matchesSearch ? 'inline-flex' : 'none';
            } else {
                chip.style.display = chipDefaultDisplay(chip);
            }
        });
    }

    if (chipSearch) {
        chipSearch.addEventListener('input', applyChipFilter);
    }
    if (chipToggleAll) {
        var collapsedLabel = chipToggleAll.textContent; // "Hiện tất cả (N)"
        var expandedLabel = 'Ẩn nhân vật chưa dùng';
        chipToggleAll.addEventListener('click', function () {
            showAllUnused = !showAllUnused;
            chipToggleAll.dataset.expanded = showAllUnused ? '1' : '0';
            chipToggleAll.textContent = showAllUnused ? expandedLabel : collapsedLabel;
            applyChipFilter();
        });
    }

    // ─── Init ─────────────────────────────────────────────────────────────────
    updateChipCounters();
    updateModifiedUI();
    applyChipFilter();

})();
</script>
@endpush

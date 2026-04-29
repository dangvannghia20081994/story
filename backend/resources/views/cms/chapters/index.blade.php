@extends('cms.layout')

@section('title', e($story->title).' — Chương')

@push('head')
    @include('cms.partials.icon-toolbar-styles')
    @include('cms.partials.cms-filter-bar-styles')
@endpush

@section('content')
    <h1>Chương — {{ $story->title }}</h1>
    <div class="cms-story-toolbar">
        <a class="icon-btn" href="{{ route('cms.stories.index') }}" title="Danh sách truyện" aria-label="Quay lại danh sách truyện">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </a>
        <a class="icon-btn" href="{{ route('cms.stories.edit', $story) }}" title="Sửa truyện" aria-label="Sửa truyện">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </a>
        <a class="icon-btn" href="{{ route('cms.stories.characters.index', $story) }}" title="Nhân vật" aria-label="Danh sách nhân vật">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </a>
        <a class="icon-btn" href="{{ $story->frontendDetailUrl() }}" target="_blank" rel="noopener noreferrer" title="Mở truyện trên web" aria-label="Mở truyện trên web">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
        <a class="icon-btn" href="{{ route('cms.stories.index', ['q' => $story->title]) }}" title="Tìm truyện ở danh sách" aria-label="Tìm truyện ở danh sách">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </a>
        <details class="add-dropdown">
            <summary class="btn btn-primary" style="list-style: none;">Thêm chương ▾</summary>
            <div class="add-dropdown__menu">
                <a href="{{ route('cms.stories.chapters.create', $story) }}">Thêm một chương</a>
                <a href="{{ route('cms.stories.chapters.bulk', $story) }}">Thêm nhiều chương</a>
                <a href="{{ route('cms.stories.chapters.strip-content', $story) }}">Gỡ chuỗi hàng loạt</a>
            </div>
        </details>
    </div>
    <form class="stories-filter-bar stories-filter-bar--scroll" method="get" action="{{ url()->current() }}">
        <input
            type="search"
            name="q"
            class="stories-filter-bar__q"
            value="{{ $q ?? '' }}"
            placeholder="Tìm theo tiêu đề chương"
            aria-label="Tìm theo tiêu đề chương"
            autocomplete="off"
        />
        <select name="tts" class="stories-filter-bar__genre" style="min-width: 12rem; max-width: 16rem;" aria-label="Lọc trạng thái TTS">
            <option value="" @selected(($tts ?? '') === '')>Mọi trạng thái TTS</option>
            <option value="ready" @selected(($tts ?? '') === 'ready')>Đã có audio</option>
            <option value="queued" @selected(($tts ?? '') === 'queued')>Đã xếp hàng TTS</option>
            <option value="pending" @selected(($tts ?? '') === 'pending')>Chưa đẩy hàng (có nội dung)</option>
            <option value="no_text" @selected(($tts ?? '') === 'no_text')>Thiếu nội dung (gần đúng)</option>
        </select>
        <select name="audio" class="stories-filter-bar__genre" aria-label="Lọc file audio">
            <option value="" @selected(($audio ?? '') === '')>Audio: tất cả</option>
            <option value="1" @selected(($audio ?? '') === '1')>Có đường dẫn audio</option>
            <option value="0" @selected(($audio ?? '') === '0')>Chưa có audio</option>
        </select>
        <select name="sort" class="stories-filter-bar__genre" style="min-width: 13rem; max-width: 17rem;" aria-label="Sắp xếp">
            <option value="read_asc" @selected(($sort ?? 'read_asc') === 'read_asc')>Thứ tự đọc (số chương ↑)</option>
            <option value="read_desc" @selected(($sort ?? '') === 'read_desc')>Thứ tự đọc (số chương ↓)</option>
            <option value="updated_desc" @selected(($sort ?? '') === 'updated_desc')>Cập nhật mới nhất</option>
            <option value="updated_asc" @selected(($sort ?? '') === 'updated_asc')>Cập nhật cũ nhất</option>
            <option value="id_desc" @selected(($sort ?? '') === 'id_desc')>ID chương mới → cũ</option>
            <option value="id_asc" @selected(($sort ?? '') === 'id_asc')>ID chương cũ → mới</option>
        </select>
        <div class="stories-filter-bar__actions">
            <button type="submit" class="btn btn-primary">Lọc</button>
            @if (($q ?? '') !== '' || ($tts ?? '') !== '' || ($audio ?? '') !== '' || ($sort ?? 'read_asc') !== 'read_asc')
                <a href="{{ url()->current() }}" class="btn">Xóa lọc</a>
            @endif
        </div>
    </form>
    @include('cms.partials.pagination', ['paginator' => $chapters, 'variant' => 'toolbar'])
    <div class="card card--table">
        <div class="table-scroll">
            <table>
                <thead>
                    <tr>
                        <th>Tiêu đề</th>
                        <th>Trạng thái TTS</th>
                        <th>Audio</th>
                        <th class="th-actions">Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse ($chapters as $chapter)
                        <tr>
                            <td><strong style="font-weight: 500;">{{ $chapter->title }}</strong></td>
                            <td>
                                <span
                                    id="chapter-tts-badge-{{ $chapter->id }}"
                                    class="cms-badge {{ $chapter->cmsTtsBadgeClass() }}"
                                    @if ($chapter->cmsTtsStatusKey() === 'queued' && $chapter->tts_enqueued_at)
                                        title="Đã đẩy hàng lúc {{ $chapter->tts_enqueued_at->timezone(config('app.timezone'))->format('d/m/Y H:i') }}"
                                    @endif
                                >{{ $chapter->cmsTtsStatusLabel() }}</span>
                            </td>
                            <td>
                                @if ($chapter->hasAudioFile())
                                    <span class="cms-badge cms-badge--tts-ready">Có file</span>
                                    @if ((int) $chapter->duration > 0)
                                        <span class="muted" style="font-size: 0.8rem;">{{ (int) $chapter->duration }}s</span>
                                    @endif
                                @else
                                    <span class="muted">—</span>
                                @endif
                            </td>
                            <td class="cms-story-row-actions">
                                <a
                                    class="icon-btn"
                                    href="{{ $story->frontendReadChapterUrl($chapter) }}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Mở trang đọc chương trên web"
                                    aria-label="Mở trang đọc chương trên web"
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M8 7h8"/><path d="M8 11h6"/></svg>
                                </a>
                                <button
                                    type="button"
                                    class="icon-btn js-enqueue-tts"
                                    data-url="{{ route('cms.stories.chapters.enqueue-tts', [$story, $chapter]) }}"
                                    data-chapter-id="{{ $chapter->id }}"
                                    title="{{ $chapter->canEnqueueWorkerTts() ? 'Đưa chương vào Redis list cho worker-tts (worker_redis.py — chạy ./run-dev.sh --with-worker hoặc run_worker_redis.cmd)' : 'Không có nội dung text để TTS' }}"
                                    aria-label="Đưa vào hàng TTS"
                                    @disabled(! $chapter->canEnqueueWorkerTts())
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                                </button>
                                <a class="icon-btn" href="{{ route('cms.stories.chapters.edit', [$story, $chapter]) }}" title="Sửa chương" aria-label="Sửa chương">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                </a>
                                <form action="{{ route('cms.stories.chapters.destroy', [$story, $chapter]) }}" method="post" style="display: inline; margin: 0;" onsubmit="return confirm('Xóa chương?');">
                                    @csrf
                                    @method('DELETE')
                                    <button type="submit" class="icon-btn icon-btn--danger" title="Xóa chương" aria-label="Xóa chương">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                    </button>
                                </form>
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="4" class="muted" style="padding: 1.5rem; text-align: center;">Chưa có chương. Dùng <strong>Thêm chương</strong> ở trên.</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>
    @include('cms.partials.pagination', ['paginator' => $chapters, 'variant' => 'footer'])
@endsection

@push('scripts')
    <script src="https://cdn.jsdelivr.net/npm/axios@1.7.9/dist/axios.min.js" crossorigin="anonymous"></script>
    <script>
    (function () {
        var csrf = @json(csrf_token());
        function notify(kind, text) {
            if (typeof window.cmsToast === 'function') {
                window.cmsToast(text, { variant: kind === 'error' ? 'error' : 'success' });
            } else {
                window.alert(text);
            }
        }
        document.querySelectorAll('.js-enqueue-tts').forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (btn.disabled) return;
                var url = btn.getAttribute('data-url');
                var id = btn.getAttribute('data-chapter-id');
                if (!url || !id) return;
                var badge = document.getElementById('chapter-tts-badge-' + id);
                btn.disabled = true;
                axios.post(url, {}, {
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-CSRF-TOKEN': csrf
                    }
                }).then(function (res) {
                    var d = res.data;
                    if (badge && d.tts) {
                        badge.className = 'cms-badge ' + d.tts.badge_class;
                        badge.textContent = d.tts.label;
                        if (d.tts.title) {
                            badge.setAttribute('title', d.tts.title);
                        } else {
                            badge.removeAttribute('title');
                        }
                    }
                    notify('ok', d.message || 'Đã xếp hàng TTS.');
                }).catch(function (err) {
                    var msg = 'Lỗi mạng hoặc máy chủ.';
                    if (err.response && err.response.data) {
                        if (err.response.data.message) {
                            msg = err.response.data.message;
                        } else if (err.response.data.errors && err.response.data.errors.tts) {
                            msg = err.response.data.errors.tts[0] || msg;
                        }
                    }
                    notify('error', msg);
                }).finally(function () {
                    btn.disabled = false;
                });
            });
        });
    })();
    </script>
@endpush

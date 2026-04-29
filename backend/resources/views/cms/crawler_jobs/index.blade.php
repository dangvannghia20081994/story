@extends('cms.layout')

@section('title', 'Crawler')

@push('head')
    <style>
        .crawler-jobs-hero {
            position: relative;
            overflow: hidden;
            background:
                radial-gradient(circle at top right, rgba(99, 102, 241, 0.18), transparent 28%),
                linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.92));
            border: 1px solid rgba(148, 163, 184, 0.18);
            color: #f8fafc;
        }
        .crawler-jobs-hero::after {
            content: '';
            position: absolute;
            inset: auto -2rem -3rem auto;
            width: 12rem;
            height: 12rem;
            border-radius: 9999px;
            background: radial-gradient(circle, rgba(129, 140, 248, 0.25), transparent 65%);
            pointer-events: none;
        }
        .crawler-jobs-hero__inner {
            position: relative;
            z-index: 1;
            display: grid;
            gap: 1rem;
            grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
            align-items: start;
        }
        @media (max-width: 960px) {
            .crawler-jobs-hero__inner { grid-template-columns: 1fr; }
        }
        .crawler-jobs-hero__eyebrow {
            display: inline-flex;
            align-items: center;
            gap: 0.45rem;
            padding: 0.25rem 0.65rem;
            border-radius: 9999px;
            background: rgba(255, 255, 255, 0.08);
            color: #c7d2fe;
            font-size: 0.76rem;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
        }
        .crawler-jobs-hero h1 {
            margin: 0.8rem 0 0.45rem;
            color: #fff;
            font-size: clamp(1.7rem, 4vw, 2.45rem);
            letter-spacing: -0.04em;
        }
        .crawler-jobs-hero__lead {
            margin: 0;
            max-width: 42rem;
            color: rgba(226, 232, 240, 0.9);
            font-size: 0.96rem;
        }
        .crawler-jobs-hero__actions {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            margin-top: 1rem;
        }
        .crawler-jobs-hero__note-grid {
            display: grid;
            gap: 0.7rem;
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        @media (max-width: 640px) {
            .crawler-jobs-hero__note-grid { grid-template-columns: 1fr; }
        }
        .crawler-jobs-note {
            padding: 0.9rem 1rem;
            border-radius: 0.8rem;
            background: rgba(15, 23, 42, 0.36);
            border: 1px solid rgba(148, 163, 184, 0.16);
        }
        .crawler-jobs-note__label {
            display: block;
            font-size: 0.72rem;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: rgba(191, 219, 254, 0.78);
            margin-bottom: 0.3rem;
        }
        .crawler-jobs-note__value {
            font-size: 1.45rem;
            font-weight: 700;
            letter-spacing: -0.04em;
            color: #fff;
            word-break: break-word;
        }
        .crawler-jobs-note__sub {
            margin-top: 0.15rem;
            font-size: 0.82rem;
            color: rgba(226, 232, 240, 0.82);
        }
        .crawler-jobs-grid {
            display: grid;
            gap: 0.9rem;
            grid-template-columns: repeat(12, minmax(0, 1fr));
            margin-top: 0.95rem;
        }
        .crawler-jobs-stat {
            grid-column: span 3;
            display: flex;
            flex-direction: column;
            gap: 0.55rem;
            transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
        }
        .crawler-jobs-stat:hover {
            transform: translateY(-1px);
            box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08);
        }
        .crawler-jobs-stat__label {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.75rem;
            color: var(--muted);
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .crawler-jobs-stat__value {
            font-size: 2rem;
            line-height: 1;
            font-weight: 700;
            letter-spacing: -0.05em;
            color: var(--text);
        }
        .crawler-jobs-stat__meta {
            color: var(--muted);
            font-size: 0.86rem;
        }
        .crawler-jobs-stat--accent .crawler-jobs-stat__value,
        .crawler-jobs-stat--accent .crawler-jobs-stat__label strong {
            color: var(--accent);
        }
        .crawler-jobs-stat--warn .crawler-jobs-stat__value,
        .crawler-jobs-stat--warn .crawler-jobs-stat__label strong {
            color: #d97706;
        }
        .crawler-jobs-stat--success .crawler-jobs-stat__value,
        .crawler-jobs-stat--success .crawler-jobs-stat__label strong {
            color: #059669;
        }
        .crawler-jobs-status-badges {
            display: flex;
            flex-wrap: wrap;
            gap: 0.4rem;
            margin: 0.9rem 0 0.35rem;
        }
        @media (max-width: 1100px) {
            .crawler-jobs-stat { grid-column: span 6; }
        }
        @media (max-width: 720px) {
            .crawler-jobs-stat { grid-column: span 12; }
        }
        .crawler-jobs-index td.cell-1line { max-width: 16rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; vertical-align: middle; }
        .crawler-jobs-index td.cell-1line a { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .crawler-jobs-index td.cell-actions { white-space: nowrap; width: 1%; vertical-align: middle; }
        .crawler-jobs-index td.cell-actions .row-actions { flex-wrap: nowrap; }
        .crawler-jobs-index td.cell-actions form { display: inline-flex; margin: 0; vertical-align: middle; }
    </style>
@endpush

@section('content')
    @include('cms.crawler_jobs._token_warning')
    <div class="card crawler-jobs-hero">
        <div class="crawler-jobs-hero__inner">
            <div>
                <span class="crawler-jobs-hero__eyebrow">Quản lý crawl</span>
                <h1>Quản lý job crawl</h1>
                <p class="crawler-jobs-hero__lead">Quản lý job crawl, theo dõi hàng đợi Redis và xử lý lỗi từ một màn hình duy nhất thay vì phải mở từng job.</p>
                <div class="crawler-jobs-hero__actions">
                    <a href="{{ route('cms.crawler-jobs.create') }}" class="btn btn-primary">Tạo job crawl</a>
                    <a href="{{ route('cms.stories.index') }}" class="btn">Về danh sách truyện</a>
                </div>
            </div>
            <div class="crawler-jobs-hero__note-grid">
                <div class="crawler-jobs-note">
                    <span class="crawler-jobs-note__label">Job hiện có</span>
                    <div class="crawler-jobs-note__value">{{ $crawlerJobCount }}</div>
                    <div class="crawler-jobs-note__sub">Đang lưu trong bảng <code>crawler_jobs</code>.</div>
                </div>
                <div class="crawler-jobs-note">
                    <span class="crawler-jobs-note__label">Hàng đợi Redis</span>
                    <div class="crawler-jobs-note__value">{{ config('crawler.redis_queue_list') }}</div>
                    <div class="crawler-jobs-note__sub">Worker Python lấy payload từ hàng đợi này.</div>
                </div>
            </div>
        </div>
    </div>
    <div class="crawler-jobs-grid">
        <div class="card crawler-jobs-stat">
            <div class="crawler-jobs-stat__label"><span>Chờ đẩy</span><strong>Chờ đẩy</strong></div>
            <div class="crawler-jobs-stat__value">{{ $crawlerStatusCounts[\App\Models\CrawlerJob::STATUS_PENDING] ?? 0 }}</div>
            <div class="crawler-jobs-stat__meta">Job mới tạo, chưa đưa vào Redis.</div>
        </div>
        <div class="card crawler-jobs-stat crawler-jobs-stat--accent">
            <div class="crawler-jobs-stat__label"><span>Đã xếp hàng</span><strong>Đã xếp hàng</strong></div>
            <div class="crawler-jobs-stat__value">{{ $crawlerStatusCounts[\App\Models\CrawlerJob::STATUS_QUEUED] ?? 0 }}</div>
            <div class="crawler-jobs-stat__meta">Có thể đang chờ worker xử lý.</div>
        </div>
        <div class="card crawler-jobs-stat crawler-jobs-stat--warn">
            <div class="crawler-jobs-stat__label"><span>Đang xử lý</span><strong>Đang xử lý</strong></div>
            <div class="crawler-jobs-stat__value">{{ $crawlerStatusCounts[\App\Models\CrawlerJob::STATUS_PROCESSING] ?? 0 }}</div>
            <div class="crawler-jobs-stat__meta">Cần tránh sửa trong lúc chạy.</div>
        </div>
        <div class="card crawler-jobs-stat crawler-jobs-stat--success">
            <div class="crawler-jobs-stat__label"><span>Hoàn tất</span><strong>Hoàn tất</strong></div>
            <div class="crawler-jobs-stat__value">{{ $crawlerStatusCounts[\App\Models\CrawlerJob::STATUS_COMPLETED] ?? 0 }}</div>
            <div class="crawler-jobs-stat__meta">Đã nhập xong nội dung.</div>
        </div>
    </div>
    <div class="crawler-jobs-status-badges">
        <span class="cms-badge cms-badge--job-pending">chờ đẩy {{ $crawlerStatusCounts[\App\Models\CrawlerJob::STATUS_PENDING] ?? 0 }}</span>
        <span class="cms-badge cms-badge--job-queued">đã xếp hàng {{ $crawlerStatusCounts[\App\Models\CrawlerJob::STATUS_QUEUED] ?? 0 }}</span>
        <span class="cms-badge cms-badge--job-processing">đang xử lý {{ $crawlerStatusCounts[\App\Models\CrawlerJob::STATUS_PROCESSING] ?? 0 }}</span>
        <span class="cms-badge cms-badge--job-completed">hoàn tất {{ $crawlerStatusCounts[\App\Models\CrawlerJob::STATUS_COMPLETED] ?? 0 }}</span>
        <span class="cms-badge cms-badge--job-failed">thất bại {{ $crawlerStatusCounts[\App\Models\CrawlerJob::STATUS_FAILED] ?? 0 }}</span>
    </div>
    <p class="content-lead">Job lưu trong bảng <code>crawler_jobs</code>, đẩy ID lên Redis (<code>{{ config('crawler.redis_queue_list') }}</code>). Worker Python lấy nội dung và gọi API nội bộ để ghi chương. <strong>Sửa</strong> cập nhật cấu hình trong cơ sở dữ liệu (không tự đẩy hàng đợi). <strong>Sao chép</strong> mở form tạo job với cùng selector / truyện — chỉ cần đổi URL nguồn. <strong>Đẩy lại Redis</strong> (chờ đẩy / đã xếp hàng / thất bại / hoàn tất) đẩy thêm payload và đặt lại <code>queued</code> — chương trùng tiêu đề sẽ được cập nhật nội dung; job <code>queued</code> có thể bị xử lý hai lần nếu hàng đợi cũ vẫn còn tin.</p>

    @include('cms.partials.pagination', ['paginator' => $jobs, 'variant' => 'toolbar'])
    <div class="card card--table">
        <div class="table-scroll">
            <table class="crawler-jobs-index">
                <thead>
                    <tr>
                        <th>URL nguồn</th>
                        <th>Số chương đã nhập</th>
                        <th>Truyện</th>
                        <th>Trạng thái</th>
                        <th>Lỗi</th>
                        <th>Ngày tạo</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    @forelse ($jobs as $job)
                        <tr>
                            <td class="cell-1line" title="{{ $job->source_url }}"><a href="{{ $job->source_url }}" target="_blank" rel="noopener">{{ $job->source_url }}</a></td>
                            <td>{{ $job->chapters_imported }}</td>
                            <td class="cell-1line" title="{{ $job->story?->title ?? '' }}">
                                @if ($job->story)
                                    <a href="{{ route('cms.stories.chapters.index', $job->story) }}">{{ $job->story->title }}</a>
                                @else
                                    <span class="muted">—</span>
                                @endif
                            </td>
                            <td>
                                <span id="crawler-job-status-{{ $job->id }}" class="cms-badge {{ $job->cmsJobStatusBadgeClass() }}">{{ $job->status }}</span>
                            </td>
                            <td id="crawler-job-error-{{ $job->id }}" class="cell-1line muted" title="{{ $job->last_error ?? '' }}">{{ $job->last_error ? $job->last_error : '—' }}</td>
                            <td class="muted" style="white-space: nowrap;">{{ $job->created_at?->format('Y-m-d H:i') }}</td>
                            <td class="cell-actions">
                                <div class="row-actions" style="gap: 0.35rem;">
                                    @if ($job->status !== \App\Models\CrawlerJob::STATUS_PROCESSING)
                                        <a href="{{ route('cms.crawler-jobs.edit', $job) }}" class="btn" style="font-size: 0.78rem; padding: 0.28rem 0.55rem;">Sửa</a>
                                    @endif
                                    <a href="{{ route('cms.crawler-jobs.create', ['from' => $job->id]) }}" class="btn" style="font-size: 0.78rem; padding: 0.28rem 0.55rem;">Sao chép</a>
                                    @if (in_array($job->status, [\App\Models\CrawlerJob::STATUS_FAILED, \App\Models\CrawlerJob::STATUS_PENDING, \App\Models\CrawlerJob::STATUS_QUEUED, \App\Models\CrawlerJob::STATUS_COMPLETED], true))
                                        <button
                                            type="button"
                                            class="btn js-crawler-resend-redis"
                                            style="font-size: 0.78rem; padding: 0.28rem 0.55rem;"
                                            data-url="{{ route('cms.crawler-jobs.resend', $job) }}"
                                            data-job-id="{{ $job->id }}"
                                        >Đẩy lại Redis</button>
                                    @endif
                                </div>
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="7" class="muted">Chưa có job crawl.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>
    @include('cms.partials.pagination', ['paginator' => $jobs])
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
        document.querySelectorAll('.js-crawler-resend-redis').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var url = btn.getAttribute('data-url');
                var id = btn.getAttribute('data-job-id');
                if (!url || !id) return;
                var badge = document.getElementById('crawler-job-status-' + id);
                var errCell = document.getElementById('crawler-job-error-' + id);
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
                    if (badge && d.job) {
                        badge.className = 'cms-badge ' + d.job.badge_class;
                        badge.textContent = d.job.status;
                    }
                    if (errCell && d.job) {
                        var le = d.job.last_error;
                        errCell.textContent = le ? le : '—';
                        errCell.setAttribute('title', le ? le : '');
                    }
                    notify('ok', d.message || 'Đã đẩy lại job crawl lên Redis.');
                }).catch(function (err) {
                    var msg = 'Lỗi mạng hoặc máy chủ.';
                    if (err.response && err.response.data) {
                        if (err.response.data.message) {
                            msg = err.response.data.message;
                        } else if (err.response.data.errors && err.response.data.errors.redis) {
                            msg = err.response.data.errors.redis[0] || msg;
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

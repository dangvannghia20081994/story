@extends('cms.layout')

@section('title', 'Bảng điều khiển')
@section('header_crumbs', 'Tổng quan điều hành')

@push('head')
    <style>
        .dashboard-hero {
            position: relative;
            overflow: hidden;
            background:
                radial-gradient(circle at top right, rgba(99, 102, 241, 0.18), transparent 28%),
                linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.92));
            border: 1px solid rgba(148, 163, 184, 0.18);
            color: #f8fafc;
        }
        .dashboard-hero::after {
            content: '';
            position: absolute;
            inset: auto -2rem -3rem auto;
            width: 12rem;
            height: 12rem;
            border-radius: 9999px;
            background: radial-gradient(circle, rgba(129, 140, 248, 0.25), transparent 65%);
            pointer-events: none;
        }
        .dashboard-hero__inner {
            position: relative;
            z-index: 1;
            display: grid;
            gap: 1rem;
            grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
            align-items: start;
        }
        @media (max-width: 960px) {
            .dashboard-hero__inner { grid-template-columns: 1fr; }
        }
        .dashboard-hero__eyebrow {
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
        .dashboard-hero h1 {
            margin: 0.8rem 0 0.45rem;
            color: #fff;
            font-size: clamp(1.7rem, 4vw, 2.45rem);
            letter-spacing: -0.04em;
        }
        .dashboard-hero__lead {
            margin: 0;
            max-width: 42rem;
            color: rgba(226, 232, 240, 0.9);
            font-size: 0.96rem;
        }
        .dashboard-hero__actions {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            margin-top: 1rem;
        }
        .dashboard-hero__note-grid {
            display: grid;
            gap: 0.7rem;
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        @media (max-width: 640px) {
            .dashboard-hero__note-grid { grid-template-columns: 1fr; }
        }
        .dashboard-note {
            padding: 0.9rem 1rem;
            border-radius: 0.8rem;
            background: rgba(15, 23, 42, 0.36);
            border: 1px solid rgba(148, 163, 184, 0.16);
        }
        .dashboard-note__label {
            display: block;
            font-size: 0.72rem;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: rgba(191, 219, 254, 0.78);
            margin-bottom: 0.3rem;
        }
        .dashboard-note__value {
            font-size: 1.5rem;
            font-weight: 700;
            letter-spacing: -0.04em;
            color: #fff;
        }
        .dashboard-note__sub {
            margin-top: 0.15rem;
            font-size: 0.82rem;
            color: rgba(226, 232, 240, 0.82);
        }
        .dashboard-grid {
            display: grid;
            gap: 0.9rem;
            grid-template-columns: repeat(12, minmax(0, 1fr));
        }
        .dashboard-stat {
            grid-column: span 3;
            min-height: 100%;
            display: flex;
            flex-direction: column;
            gap: 0.55rem;
            text-decoration: none;
            transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
        }
        .dashboard-stat:hover {
            transform: translateY(-1px);
            box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08);
            text-decoration: none;
        }
        .dashboard-stat__label {
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
        .dashboard-stat__value {
            font-size: 2rem;
            line-height: 1;
            font-weight: 700;
            letter-spacing: -0.05em;
            color: var(--text);
        }
        .dashboard-stat__meta {
            color: var(--muted);
            font-size: 0.86rem;
        }
        .dashboard-stat--accent .dashboard-stat__value,
        .dashboard-stat--accent .dashboard-stat__label strong {
            color: var(--accent);
        }
        .dashboard-stat--danger .dashboard-stat__value,
        .dashboard-stat--danger .dashboard-stat__label strong {
            color: #dc2626;
        }
        .dashboard-stat--success .dashboard-stat__value,
        .dashboard-stat--success .dashboard-stat__label strong {
            color: #059669;
        }
        .dashboard-stat--warn .dashboard-stat__value,
        .dashboard-stat--warn .dashboard-stat__label strong {
            color: #d97706;
        }
        .dashboard-section {
            display: grid;
            gap: 0.9rem;
            grid-template-columns: repeat(12, minmax(0, 1fr));
            align-items: start;
            margin-top: 0.9rem;
        }
        .dashboard-panel {
            grid-column: span 6;
            height: 100%;
        }
        .dashboard-panel--full { grid-column: 1 / -1; }
        .dashboard-panel__head {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 1rem;
            margin-bottom: 0.9rem;
        }
        .dashboard-panel__head h2 {
            margin: 0;
            font-size: 1rem;
        }
        .dashboard-panel__head p {
            margin: 0.2rem 0 0;
        }
        .dashboard-panel__actions {
            display: flex;
            flex-wrap: wrap;
            gap: 0.4rem;
            justify-content: flex-end;
        }
        .dashboard-action-grid {
            display: grid;
            gap: 0.7rem;
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        @media (max-width: 720px) {
            .dashboard-action-grid { grid-template-columns: 1fr; }
        }
        .dashboard-action {
            display: block;
            padding: 0.95rem 1rem;
            border-radius: 0.7rem;
            border: 1px solid var(--surface-border);
            background: linear-gradient(180deg, rgba(99, 102, 241, 0.04), rgba(99, 102, 241, 0.01));
            color: var(--text);
            text-decoration: none;
            transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
        }
        .dashboard-action:hover {
            transform: translateY(-1px);
            border-color: rgba(99, 102, 241, 0.35);
            text-decoration: none;
            background: linear-gradient(180deg, rgba(99, 102, 241, 0.08), rgba(99, 102, 241, 0.03));
        }
        .dashboard-action__title {
            display: block;
            font-weight: 700;
            margin-bottom: 0.25rem;
        }
        .dashboard-action__desc {
            display: block;
            color: var(--muted);
            font-size: 0.84rem;
        }
        .dashboard-alerts {
            display: grid;
            gap: 0.65rem;
        }
        .dashboard-alert {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            padding: 0.82rem 0.95rem;
            border-radius: 0.65rem;
            border: 1px solid var(--surface-border);
            background: rgba(148, 163, 184, 0.06);
        }
        .dashboard-alert__copy strong { display: block; margin-bottom: 0.1rem; }
        .dashboard-alert__copy span { color: var(--muted); font-size: 0.84rem; }
        .dashboard-alert__value {
            flex-shrink: 0;
            font-size: 1.2rem;
            font-weight: 700;
        }
        .dashboard-status-row {
            display: flex;
            flex-wrap: wrap;
            gap: 0.45rem;
        }
        .dashboard-status-card {
            grid-column: span 12;
        }
        .dashboard-status-card__grid {
            display: grid;
            gap: 0.7rem;
            grid-template-columns: repeat(5, minmax(0, 1fr));
        }
        @media (max-width: 1100px) {
            .dashboard-stat { grid-column: span 6; }
            .dashboard-panel { grid-column: span 12; }
            .dashboard-status-card__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 720px) {
            .dashboard-stat { grid-column: span 12; }
            .dashboard-status-card__grid { grid-template-columns: 1fr; }
        }
        .dashboard-mini-card {
            padding: 0.85rem 0.95rem;
            border-radius: 0.7rem;
            border: 1px solid var(--surface-border);
            background: var(--surface);
        }
        .dashboard-mini-card__label {
            display: block;
            color: var(--muted);
            font-size: 0.68rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.01em;
            margin-bottom: 0.25rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .dashboard-mini-card__value {
            font-size: 1.45rem;
            font-weight: 700;
            letter-spacing: -0.04em;
        }
        .dashboard-list {
            display: grid;
            gap: 0.55rem;
        }
        .dashboard-list__item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            padding: 0.8rem 0.95rem;
            border-radius: 0.65rem;
            border: 1px solid var(--surface-border);
            background: var(--surface);
        }
        .dashboard-list__item:hover {
            border-color: rgba(99, 102, 241, 0.3);
        }
        .dashboard-list__main {
            min-width: 0;
        }
        .dashboard-list__title {
            display: block;
            font-weight: 600;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .dashboard-list__meta {
            display: block;
            color: var(--muted);
            font-size: 0.82rem;
            margin-top: 0.15rem;
        }
        .dashboard-list__side {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            gap: 0.4rem;
            flex-wrap: wrap;
            justify-content: flex-end;
        }
        .dashboard-empty {
            padding: 1rem 1rem;
            border-radius: 0.65rem;
            border: 1px dashed var(--surface-border);
            color: var(--muted);
            background: rgba(148, 163, 184, 0.04);
        }
        .dashboard-status-badges {
            display: flex;
            flex-wrap: wrap;
            gap: 0.4rem;
        }
        .dashboard-status-badges .cms-badge {
            padding: 0.22rem 0.6rem;
        }
        .dashboard-table {
            width: 100%;
            border-collapse: collapse;
        }
        .dashboard-table td {
            padding: 0;
            border: 0;
        }
        .dashboard-kpi-help {
            color: var(--muted);
            font-size: 0.84rem;
            margin-top: 0.2rem;
        }
    </style>
@endpush

@section('content')
    <div class="card dashboard-hero">
        <div class="dashboard-hero__inner">
            <div>
                <span class="dashboard-hero__eyebrow">Vận hành CMS</span>
                <h1>Bảng điều khiển</h1>
                <p class="dashboard-hero__lead">Một màn hình điều hành gọn hơn cho việc tạo truyện, xử lý chương, theo dõi crawler và quay lại đúng chỗ cần làm ngay.</p>
                <div class="dashboard-hero__actions">
                    <a href="{{ route('cms.stories.create') }}" class="btn btn-primary">Tạo truyện mới</a>
                    <a href="{{ route('cms.stories.bulk') }}" class="btn">Nhập hàng loạt truyện</a>
                    <a href="{{ route('cms.crawler-jobs.create') }}" class="btn">Tạo job crawl</a>
                    <a href="{{ route('cms.lexicons.from-chapter') }}" class="btn">Trích lexicon từ chương</a>
                </div>
            </div>
            <div class="dashboard-hero__note-grid">
                <div class="dashboard-note">
                    <span class="dashboard-note__label">Truyện chưa có chương</span>
                    <div class="dashboard-note__value">{{ $storiesWithoutChaptersCount }}</div>
                    <div class="dashboard-note__sub">Cần kiểm tra hoặc đẩy dữ liệu đầu vào.</div>
                </div>
                <div class="dashboard-note">
                    <span class="dashboard-note__label">Chương có audio</span>
                    <div class="dashboard-note__value">{{ $chapterAudioCount }}</div>
                    <div class="dashboard-note__sub">Đã sẵn sàng cho luồng nghe / phát lại.</div>
                </div>
            </div>
        </div>
    </div>

    <div class="dashboard-grid" style="margin-top: 0.95rem;">
        <a href="{{ route('cms.stories.index') }}" class="card dashboard-stat dashboard-stat--accent">
            <div class="dashboard-stat__label"><span>Truyện</span><strong>Mở danh sách</strong></div>
            <div class="dashboard-stat__value">{{ $storyCount }}</div>
            <div class="dashboard-stat__meta">Tổng truyện trong CMS, bao gồm bản đã chỉnh sửa.</div>
        </a>
        <a href="{{ route('cms.stories.index') }}" class="card dashboard-stat">
            <div class="dashboard-stat__label"><span>Chương</span><strong>Duyệt chi tiết</strong></div>
            <div class="dashboard-stat__value">{{ $chapterCount }}</div>
            <div class="dashboard-stat__meta">Dùng làm nguồn cho phát audio và crawl lại nội dung.</div>
        </a>
        <a href="{{ route('cms.lexicons.index') }}" class="card dashboard-stat dashboard-stat--success">
            <div class="dashboard-stat__label"><span>Lexicon</span><strong>Tra cứu nhanh</strong></div>
            <div class="dashboard-stat__value">{{ $lexiconCount }}</div>
            <div class="dashboard-stat__meta">Các quy tắc thay thế từ / tên / lọc đang lưu.</div>
        </a>
        <a href="{{ route('cms.crawler-jobs.index') }}" class="card dashboard-stat dashboard-stat--warn">
            <div class="dashboard-stat__label"><span>Job crawl</span><strong>Theo dõi hàng đợi</strong></div>
            <div class="dashboard-stat__value">{{ $crawlerJobCount }}</div>
            <div class="dashboard-stat__meta">Job lưu trong cơ sở dữ liệu và được đẩy vào Redis để worker xử lý.</div>
        </a>
    </div>

    <div class="dashboard-section">
        <section class="card dashboard-panel">
            <div class="dashboard-panel__head">
                <div>
                    <h2>Tác vụ nhanh</h2>
                    <p class="content-lead">Các đường tắt hay dùng nhất cho thao tác hàng ngày.</p>
                </div>
            </div>
            <div class="dashboard-action-grid">
                <a href="{{ route('cms.stories.create') }}" class="dashboard-action">
                    <span class="dashboard-action__title">Tạo truyện</span>
                    <span class="dashboard-action__desc">Thêm một truyện mới rồi nhập chương sau.</span>
                </a>
                <a href="{{ route('cms.stories.bulk') }}" class="dashboard-action">
                    <span class="dashboard-action__title">Nhập lô truyện</span>
                    <span class="dashboard-action__desc">Dán dữ liệu dạng bảng để tạo nhiều truyện cùng lúc.</span>
                </a>
                <a href="{{ route('cms.crawler-jobs.create') }}" class="dashboard-action">
                    <span class="dashboard-action__title">Tạo job crawl</span>
                    <span class="dashboard-action__desc">Tạo cấu hình crawl và đẩy ngay vào Redis.</span>
                </a>
                <a href="{{ route('cms.lexicons.from-chapter') }}" class="dashboard-action">
                    <span class="dashboard-action__title">Trích lexicon từ chương</span>
                    <span class="dashboard-action__desc">Lấy danh sách từ cần thay thế từ nội dung chương.</span>
                </a>
                <a href="{{ route('cms.crawler-jobs.index') }}" class="dashboard-action">
                    <span class="dashboard-action__title">Quản lý job crawl</span>
                    <span class="dashboard-action__desc">Xem trạng thái, lỗi, sao chép hoặc đẩy lại Redis.</span>
                </a>
                <a href="{{ url('/docs/api') }}" target="_blank" rel="noopener" class="dashboard-action">
                    <span class="dashboard-action__title">Mở tài liệu API</span>
                    <span class="dashboard-action__desc">Kiểm tra hợp đồng API runtime và spec đang export.</span>
                </a>
            </div>
        </section>

        <section class="card dashboard-panel">
            <div class="dashboard-panel__head">
                <div>
                    <h2>Tình trạng cần chú ý</h2>
                    <p class="content-lead">Các số liệu nhanh để biết khu vực nào đang thiếu dữ liệu hoặc cần xử lý.</p>
                </div>
            </div>
            <div class="dashboard-alerts">
                <div class="dashboard-alert">
                    <div class="dashboard-alert__copy">
                        <strong>Truyện chưa có chương</strong>
                        <span>Thường là dữ liệu đầu vào còn dang dở hoặc cần nhập lô.</span>
                    </div>
                    <div class="dashboard-alert__value">{{ $storiesWithoutChaptersCount }}</div>
                </div>
                <div class="dashboard-alert">
                    <div class="dashboard-alert__copy">
                        <strong>Chương đang chờ TTS</strong>
                        <span>Đã xếp hàng TTS nhưng chưa có audio file.</span>
                    </div>
                    <div class="dashboard-alert__value">{{ $chapterTtsQueuedCount }}</div>
                </div>
                <div class="dashboard-alert">
                    <div class="dashboard-alert__copy">
                        <strong>Job crawl đang chạy hoặc chờ xử lý</strong>
                        <span>Bao gồm chờ đẩy, đã xếp hàng và đang xử lý.</span>
                    </div>
                    <div class="dashboard-alert__value">
                        {{ ($crawlerStatusCounts[\App\Models\CrawlerJob::STATUS_PENDING] ?? 0) + ($crawlerStatusCounts[\App\Models\CrawlerJob::STATUS_QUEUED] ?? 0) + ($crawlerStatusCounts[\App\Models\CrawlerJob::STATUS_PROCESSING] ?? 0) }}
                    </div>
                </div>
            </div>
        </section>
    </div>

    <div class="dashboard-section">
        <section class="card dashboard-panel">
            <div class="dashboard-panel__head">
                <div>
                    <h2>Trạng thái crawler</h2>
                    <p class="content-lead">Phân rã theo trạng thái để biết job nào cần can thiệp.</p>
                </div>
                <div class="dashboard-panel__actions">
                    <a href="{{ route('cms.crawler-jobs.create') }}" class="btn btn-primary">Tạo job</a>
                    <a href="{{ route('cms.crawler-jobs.index') }}" class="btn">Mở danh sách</a>
                </div>
            </div>
            <div class="dashboard-status-card__grid">
                <div class="dashboard-mini-card">
                    <span class="dashboard-mini-card__label">Chờ đẩy</span>
                    <div class="dashboard-mini-card__value">{{ $crawlerStatusCounts[\App\Models\CrawlerJob::STATUS_PENDING] ?? 0 }}</div>
                    <div class="dashboard-kpi-help">Chưa đẩy vào Redis.</div>
                </div>
                <div class="dashboard-mini-card">
                    <span class="dashboard-mini-card__label">Đã xếp hàng</span>
                    <div class="dashboard-mini-card__value">{{ $crawlerStatusCounts[\App\Models\CrawlerJob::STATUS_QUEUED] ?? 0 }}</div>
                    <div class="dashboard-kpi-help">Đã vào hàng đợi worker.</div>
                </div>
                <div class="dashboard-mini-card">
                    <span class="dashboard-mini-card__label">Đang xử lý</span>
                    <div class="dashboard-mini-card__value">{{ $crawlerStatusCounts[\App\Models\CrawlerJob::STATUS_PROCESSING] ?? 0 }}</div>
                    <div class="dashboard-kpi-help">Worker đang crawl.</div>
                </div>
                <div class="dashboard-mini-card">
                    <span class="dashboard-mini-card__label">Hoàn tất</span>
                    <div class="dashboard-mini-card__value">{{ $crawlerStatusCounts[\App\Models\CrawlerJob::STATUS_COMPLETED] ?? 0 }}</div>
                    <div class="dashboard-kpi-help">Đã nhập xong nội dung.</div>
                </div>
                <div class="dashboard-mini-card">
                    <span class="dashboard-mini-card__label">Thất bại</span>
                    <div class="dashboard-mini-card__value">{{ $crawlerStatusCounts[\App\Models\CrawlerJob::STATUS_FAILED] ?? 0 }}</div>
                    <div class="dashboard-kpi-help">Cần kiểm tra URL / selector / lỗi worker.</div>
                </div>
            </div>
            <div class="dashboard-status-badges" style="margin-top: 0.75rem;">
                <span class="cms-badge cms-badge--job-pending">chờ đẩy {{ $crawlerStatusCounts[\App\Models\CrawlerJob::STATUS_PENDING] ?? 0 }}</span>
                <span class="cms-badge cms-badge--job-queued">đã xếp hàng {{ $crawlerStatusCounts[\App\Models\CrawlerJob::STATUS_QUEUED] ?? 0 }}</span>
                <span class="cms-badge cms-badge--job-processing">đang xử lý {{ $crawlerStatusCounts[\App\Models\CrawlerJob::STATUS_PROCESSING] ?? 0 }}</span>
                <span class="cms-badge cms-badge--job-completed">hoàn tất {{ $crawlerStatusCounts[\App\Models\CrawlerJob::STATUS_COMPLETED] ?? 0 }}</span>
                <span class="cms-badge cms-badge--job-failed">thất bại {{ $crawlerStatusCounts[\App\Models\CrawlerJob::STATUS_FAILED] ?? 0 }}</span>
            </div>
        </section>

        <section class="card dashboard-panel">
            <div class="dashboard-panel__head">
                <div>
                    <h2>Số liệu nội dung</h2>
                    <p class="content-lead">Nhìn nhanh độ phủ dữ liệu trong CMS.</p>
                </div>
            </div>
            <div class="dashboard-status-card__grid">
                <div class="dashboard-mini-card">
                    <span class="dashboard-mini-card__label">Chương có audio</span>
                    <div class="dashboard-mini-card__value">{{ $chapterAudioCount }}</div>
                    <div class="dashboard-kpi-help">Có thể phát trên giao diện nghe truyện.</div>
                </div>
                <div class="dashboard-mini-card">
                    <span class="dashboard-mini-card__label">Chương chờ TTS</span>
                    <div class="dashboard-mini-card__value">{{ $chapterTtsQueuedCount }}</div>
                    <div class="dashboard-kpi-help">Đã enqueue nhưng chưa có file audio.</div>
                </div>
                <div class="dashboard-mini-card">
                    <span class="dashboard-mini-card__label">Thiếu chương</span>
                    <div class="dashboard-mini-card__value">{{ $storiesWithoutChaptersCount }}</div>
                    <div class="dashboard-kpi-help">Nên kiểm tra nhập liệu hoặc crawl.</div>
                </div>
                <div class="dashboard-mini-card">
                    <span class="dashboard-mini-card__label">Lexicon ưu tiên</span>
                    <div class="dashboard-mini-card__value">{{ $lexiconCount }}</div>
                    <div class="dashboard-kpi-help">Dùng cho chuẩn hóa từ / tên / filter.</div>
                </div>
                <div class="dashboard-mini-card">
                    <span class="dashboard-mini-card__label">Tổng truyện</span>
                    <div class="dashboard-mini-card__value">{{ $storyCount }}</div>
                    <div class="dashboard-kpi-help">Bao gồm cả bản đang chỉnh sửa.</div>
                </div>
            </div>
        </section>
    </div>

    <div class="dashboard-section">
        <section class="card dashboard-panel">
            <div class="dashboard-panel__head">
                <div>
                    <h2>Truyện gần đây</h2>
                    <p class="content-lead">Những truyện vừa thay đổi gần nhất.</p>
                </div>
                <div class="dashboard-panel__actions">
                    <a href="{{ route('cms.stories.index') }}" class="btn">Mở danh sách</a>
                </div>
            </div>
            <div class="dashboard-list">
                @forelse ($recentStories as $story)
                    <div class="dashboard-list__item">
                        <div class="dashboard-list__main">
                            <a class="dashboard-list__title" href="{{ route('cms.stories.chapters.index', $story) }}">{{ $story->title }}</a>
                            <span class="dashboard-list__meta">
                                {{ $story->chapters_count }} chương · {{ $story->characters_count }} nhân vật
                            </span>
                            <span class="dashboard-list__meta">cập nhật {{ $story->updated_at?->format('Y-m-d H:i') }}</span>
                        </div>
                        <div class="dashboard-list__side">
                            <span class="cms-badge cms-badge--genre cms-badge--genre-{{ $story->genre ?? 'khac' }}">{{ \App\Models\Story::genreLabel($story->genre) }}</span>
                            <span class="cms-badge cms-badge--serial-{{ $story->serial_status ?? 'unknown' }}">{{ \App\Models\Story::serialStatusLabel($story->serial_status) }}</span>
                            <a href="{{ route('cms.stories.edit', $story) }}" class="btn" style="font-size: 0.78rem; padding: 0.28rem 0.55rem;">Sửa</a>
                        </div>
                    </div>
                @empty
                    <div class="dashboard-empty">Chưa có truyện nào.</div>
                @endforelse
            </div>
        </section>

        <section class="card dashboard-panel">
            <div class="dashboard-panel__head">
                <div>
                    <h2>Chương gần đây</h2>
                    <p class="content-lead">Những chương vừa cập nhật hoặc thêm mới.</p>
                </div>
                <div class="dashboard-panel__actions">
                    <a href="{{ route('cms.stories.index') }}" class="btn">Mở danh sách truyện</a>
                </div>
            </div>
            <div class="dashboard-list">
                @forelse ($recentChapters as $chapter)
                    <div class="dashboard-list__item">
                        <div class="dashboard-list__main">
                            <a class="dashboard-list__title" href="{{ route('cms.stories.chapters.edit', [$chapter->story, $chapter]) }}">{{ $chapter->title }}</a>
                            <span class="dashboard-list__meta">
                                {{ $chapter->story?->title ?? '—' }} · {{ $chapter->chapter_number !== null ? 'Chương '.$chapter->chapter_number : 'Không số chương' }}
                            </span>
                            <span class="dashboard-list__meta">{{ $chapter->updated_at?->format('Y-m-d H:i') }}</span>
                        </div>
                        <div class="dashboard-list__side">
                            <span class="cms-badge {{ $chapter->cmsTtsBadgeClass() }}">{{ $chapter->cmsTtsStatusLabel() }}</span>
                            @if ($chapter->story)
                                <a href="{{ route('cms.stories.chapters.index', $chapter->story) }}" class="btn" style="font-size: 0.78rem; padding: 0.28rem 0.55rem;">Mở truyện</a>
                            @endif
                        </div>
                    </div>
                @empty
                    <div class="dashboard-empty">Chưa có chương nào.</div>
                @endforelse
            </div>
        </section>
    </div>
@endsection

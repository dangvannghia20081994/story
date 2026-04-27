@extends('cms.layout')

@section('title', 'Crawler')

@push('head')
    <style>
        .crawler-jobs-index td.cell-1line { max-width: 16rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; vertical-align: middle; }
        .crawler-jobs-index td.cell-1line a { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .crawler-jobs-index td.cell-actions { white-space: nowrap; width: 1%; vertical-align: middle; }
        .crawler-jobs-index td.cell-actions .row-actions { flex-wrap: nowrap; }
        .crawler-jobs-index td.cell-actions form { display: inline-flex; margin: 0; vertical-align: middle; }
    </style>
@endpush

@section('content')
    @include('cms.crawler_jobs._token_warning')
    <div class="page-head">
        <h1>Crawler</h1>
        <p class="row-actions" style="margin: 0;">
            <a href="{{ route('cms.crawler-jobs.create') }}" class="btn btn-primary">Tạo job mới</a>
        </p>
    </div>
    <p class="content-lead">Job lưu trong bảng <code>crawler_jobs</code>, đẩy ID lên Redis (<code>{{ config('crawler.redis_queue_list') }}</code>). Worker Python lấy nội dung và gọi API nội bộ để ghi chương. <strong>Sửa</strong> cập nhật cấu hình trong DB (không tự đẩy queue). <strong>Sao chép</strong> mở form tạo job với cùng selector / truyện — chỉ cần đổi URL nguồn. <strong>Gửi lại Redis</strong> (pending / queued / failed / completed) đẩy thêm payload và đặt lại <code>queued</code> — chương trùng tiêu đề sẽ được cập nhật nội dung; job <code>queued</code> có thể bị xử lý hai lần nếu queue cũ vẫn còn tin.</p>

    <div class="card card--table">
        <div class="table-scroll">
            <table class="crawler-jobs-index">
                <thead>
                    <tr>
                        <th>URL nguồn</th>
                        <th>Chương đã nhập</th>
                        <th>Truyện</th>
                        <th>Trạng thái</th>
                        <th>Lỗi</th>
                        <th>Tạo</th>
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
                                @php
                                    $jobStatus = $job->status;
                                    $jobBadge = match ($jobStatus) {
                                        \App\Models\CrawlerJob::STATUS_PENDING => 'cms-badge--job-pending',
                                        \App\Models\CrawlerJob::STATUS_QUEUED => 'cms-badge--job-queued',
                                        \App\Models\CrawlerJob::STATUS_PROCESSING => 'cms-badge--job-processing',
                                        \App\Models\CrawlerJob::STATUS_COMPLETED => 'cms-badge--job-completed',
                                        \App\Models\CrawlerJob::STATUS_FAILED => 'cms-badge--job-failed',
                                        default => 'cms-badge--genre',
                                    };
                                @endphp
                                <span class="cms-badge {{ $jobBadge }}">{{ $jobStatus }}</span>
                            </td>
                            <td class="cell-1line muted" title="{{ $job->last_error ?? '' }}">{{ $job->last_error ? $job->last_error : '—' }}</td>
                            <td class="muted" style="white-space: nowrap;">{{ $job->created_at?->format('Y-m-d H:i') }}</td>
                            <td class="cell-actions">
                                <div class="row-actions" style="gap: 0.35rem;">
                                    @if ($job->status !== \App\Models\CrawlerJob::STATUS_PROCESSING)
                                        <a href="{{ route('cms.crawler-jobs.edit', $job) }}" class="btn" style="font-size: 0.78rem; padding: 0.28rem 0.55rem;">Sửa</a>
                                    @endif
                                    <a href="{{ route('cms.crawler-jobs.create', ['from' => $job->id]) }}" class="btn" style="font-size: 0.78rem; padding: 0.28rem 0.55rem;">Sao chép</a>
                                    @if (in_array($job->status, [\App\Models\CrawlerJob::STATUS_FAILED, \App\Models\CrawlerJob::STATUS_PENDING, \App\Models\CrawlerJob::STATUS_QUEUED, \App\Models\CrawlerJob::STATUS_COMPLETED], true))
                                        <form method="post" action="{{ route('cms.crawler-jobs.resend', $job) }}">
                                            @csrf
                                            <button type="submit" class="btn" style="font-size: 0.78rem; padding: 0.28rem 0.55rem;">Gửi lại Redis</button>
                                        </form>
                                    @endif
                                </div>
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="7" class="muted">Chưa có job.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>
    @include('cms.partials.pagination', ['paginator' => $jobs])
@endsection

@extends('cms.layout')

@section('title', 'Crawler')

@section('content')
    @include('cms.crawler_jobs._token_warning')
    <div class="page-head">
        <h1>Crawler</h1>
        <p class="row-actions" style="margin: 0;">
            <a href="{{ route('cms.crawler-jobs.create') }}" class="btn btn-primary">Tạo job mới</a>
        </p>
    </div>
    <p class="content-lead">Job lưu trong bảng <code>crawler_jobs</code>, đẩy ID lên Redis (<code>{{ config('crawler.redis_queue_list') }}</code>). Worker Python lấy nội dung và gọi API nội bộ để ghi chương. <strong>Sao chép</strong> mở form tạo job với cùng selector / truyện — chỉ cần đổi URL nguồn. <strong>Gửi lại Redis</strong> (pending / queued / failed / completed) đẩy thêm payload và đặt lại <code>queued</code> — chương trùng tiêu đề sẽ được cập nhật nội dung; job <code>queued</code> có thể bị xử lý hai lần nếu queue cũ vẫn còn tin.</p>

    <div class="card card--table">
        <div class="table-scroll">
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Trạng thái</th>
                        <th>URL nguồn</th>
                        <th>Chương đã nhập</th>
                        <th>Truyện</th>
                        <th>Lỗi</th>
                        <th>Tạo</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    @forelse ($jobs as $job)
                        <tr>
                            <td>{{ $job->id }}</td>
                            <td><code>{{ $job->status }}</code></td>
                            <td style="max-width: 18rem; word-break: break-all;"><a href="{{ $job->source_url }}" target="_blank" rel="noopener">{{ \Illuminate\Support\Str::limit($job->source_url, 64) }}</a></td>
                            <td>{{ $job->chapters_imported }}</td>
                            <td>
                                @if ($job->story)
                                    <a href="{{ route('cms.stories.chapters.index', $job->story) }}">{{ $job->story->title }}</a>
                                @else
                                    <span class="muted">—</span>
                                @endif
                            </td>
                            <td style="max-width: 14rem; word-break: break-word;" class="muted">{{ $job->last_error ? \Illuminate\Support\Str::limit($job->last_error, 120) : '—' }}</td>
                            <td class="muted" style="white-space: nowrap;">{{ $job->created_at?->format('Y-m-d H:i') }}</td>
                            <td>
                                <div class="row-actions" style="flex-wrap: wrap; gap: 0.35rem;">
                                    <a href="{{ route('cms.crawler-jobs.create', ['from' => $job->id]) }}" class="btn" style="font-size: 0.78rem; padding: 0.28rem 0.55rem;">Sao chép</a>
                                    @if (in_array($job->status, [\App\Models\CrawlerJob::STATUS_FAILED, \App\Models\CrawlerJob::STATUS_PENDING, \App\Models\CrawlerJob::STATUS_QUEUED, \App\Models\CrawlerJob::STATUS_COMPLETED], true))
                                        <form method="post" action="{{ route('cms.crawler-jobs.resend', $job) }}" style="display: inline; margin: 0;">
                                            @csrf
                                            <button type="submit" class="btn" style="font-size: 0.78rem; padding: 0.28rem 0.55rem;">Gửi lại Redis</button>
                                        </form>
                                    @endif
                                </div>
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="8" class="muted">Chưa có job.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>
    @include('cms.partials.pagination', ['paginator' => $jobs])
@endsection

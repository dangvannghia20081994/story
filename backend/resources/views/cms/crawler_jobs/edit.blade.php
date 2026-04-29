@extends('cms.layout')

@section('title', 'Sửa job crawl')

@section('content')
    @include('cms.crawler_jobs._token_warning')
    <h1>Sửa job crawl #{{ $job->id }}</h1>
    <p class="content-lead">Cập nhật cấu hình trong cơ sở dữ liệu. Trạng thái và số chương đã nhập giữ nguyên; sau khi lưu dùng <strong>Đẩy lại Redis</strong> trên danh sách nếu muốn chạy worker với cấu hình mới.</p>
    <p class="muted" style="margin-bottom: 1rem;">Trạng thái hiện tại: <code>{{ $job->status }}</code> — số chương đã nhập: <strong>{{ $job->chapters_imported }}</strong></p>

    <div class="card card--crawler-job">
        <form method="post" action="{{ route('cms.crawler-jobs.update', $job) }}">
            @csrf
            @method('PUT')
            @include('cms.crawler_jobs._form_fields', ['d' => $d, 'autofocusSource' => true])
            <p class="row-actions">
                <button type="submit" class="btn btn-primary">Lưu thay đổi</button>
                <a href="{{ route('cms.crawler-jobs.index') }}" class="btn">Hủy</a>
            </p>
        </form>
    </div>
@endsection

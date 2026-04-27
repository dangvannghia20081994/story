@extends('cms.layout')

@section('title', 'Sửa job Crawler')

@section('content')
    @include('cms.crawler_jobs._token_warning')
    <h1>Sửa job #{{ $job->id }}</h1>
    <p class="content-lead">Cập nhật cấu hình trong DB. Trạng thái và số chương đã nhập giữ nguyên; sau khi lưu dùng <strong>Gửi lại Redis</strong> trên danh sách nếu muốn chạy worker với cấu hình mới.</p>
    <p class="muted" style="margin-bottom: 1rem;">Trạng thái hiện tại: <code>{{ $job->status }}</code> — chương đã nhập: <strong>{{ $job->chapters_imported }}</strong></p>

    <div class="card" style="max-width: 40rem;">
        <form method="post" action="{{ route('cms.crawler-jobs.update', $job) }}">
            @csrf
            @method('PUT')
            @include('cms.crawler_jobs._form_fields', ['d' => $d, 'autofocusSource' => true])
            <p class="row-actions">
                <button type="submit" class="btn btn-primary">Lưu thay đổi</button>
                <a href="{{ route('cms.crawler-jobs.index') }}" class="btn">Huỷ</a>
            </p>
        </form>
    </div>
@endsection

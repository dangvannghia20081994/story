@extends('cms.layout')

@section('title', 'Tạo job Crawler')

@section('content')
    @include('cms.crawler_jobs._token_warning')
    <h1>Tạo job Crawler</h1>
    @if ($copyFromId)
        <p class="flash" style="margin-bottom: 1rem;">Đang sao chép cấu hình từ <strong>job #{{ $copyFromId }}</strong> — chỉ cần điền <strong>URL trang truyện</strong> mới (và chỉnh thêm nếu cần), rồi gửi.</p>
    @endif
    @php
        $d = $prefill ?? [];
    @endphp
    <p class="content-lead">Một bộ <strong>CSS selector</strong> chung: có thể nhập <strong>nhiều URL</strong> (mỗi dòng một job). Truyện mới: nhập tiêu đề tay <strong>hoặc</strong> selector lấy tên trên trang nguồn. Sau khi gửi, job lưu DB và đẩy Redis cho worker.</p>

    <div class="card card--crawler-job">
        <form method="post" action="{{ route('cms.crawler-jobs.store') }}">
            @csrf
            @include('cms.crawler_jobs._form_fields', ['d' => $d, 'autofocusSource' => true])
            <p class="row-actions">
                <button type="submit" class="btn btn-primary">Lưu &amp; đẩy Redis</button>
                <a href="{{ route('cms.crawler-jobs.index') }}" class="btn">Huỷ</a>
            </p>
        </form>
    </div>
@endsection

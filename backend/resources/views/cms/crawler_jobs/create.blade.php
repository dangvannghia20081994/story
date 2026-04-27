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
    <p class="content-lead">Nhập URL trang truyện (mục lục), CSS selector cho link chương (để trống nếu chỉ crawl đúng một URL), selector tiêu đề và nội dung từng trang chương. <strong>Nhập nhiều URL (mỗi dòng một URL) để tạo nhiều job cùng lúc.</strong> Sau khi gửi, các job được lưu DB và đẩy lên Redis cho worker.</p>

    <div class="card" style="max-width: 40rem;">
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

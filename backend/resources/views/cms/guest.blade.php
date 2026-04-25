<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Đăng nhập CMS — {{ config('app.name') }}</title>
    <style>
        body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: #fafafa; color: #18181b; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .box { width: 100%; max-width: 22rem; background: #fff; border: 1px solid #e4e4e7; border-radius: 0.5rem; padding: 1.25rem; }
        label { display: block; font-size: 0.8rem; font-weight: 500; margin-bottom: 0.25rem; }
        input { width: 100%; padding: 0.45rem 0.5rem; border-radius: 0.375rem; border: 1px solid #d4d4d8; box-sizing: border-box; }
        .field { margin-bottom: 0.85rem; }
        .btn { width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: none; background: #4f46e5; color: #fff; font-weight: 500; cursor: pointer; }
        .error { color: #dc2626; font-size: 0.8rem; margin-top: 0.25rem; }
        h1 { font-size: 1.15rem; margin: 0 0 1rem; }
        .chk { display: flex; align-items: center; gap: 0.35rem; font-size: 0.875rem; }
        .chk input { width: auto; }
    </style>
</head>
<body>
    <div class="box">
        @yield('content')
    </div>
</body>
</html>

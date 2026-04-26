<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Đăng nhập CMS — {{ config('app.name') }}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; }
        body {
            margin: 0;
            font-family: "DM Sans", ui-sans-serif, system-ui, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem 1rem;
            background: linear-gradient(150deg, #0f172a 0%, #1e1b4b 45%, #312e81 100%);
        }
        .box {
            width: 100%;
            max-width: 24rem;
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 0.75rem;
            padding: 1.6rem 1.5rem 1.5rem;
            box-shadow: 0 20px 50px -12px rgba(0,0,0,0.25);
        }
        @media (prefers-color-scheme: dark) {
            .box { background: #0f172a; border-color: #334155; }
            body { color: #f1f5f9; }
            label { color: #e2e8f0; }
        }
        label { display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.3rem; color: #0f172a; }
        input { width: 100%; padding: 0.5rem 0.6rem; border-radius: 0.45rem; border: 1px solid #cbd5e1; box-sizing: border-box; font-size: 0.9rem; }
        @media (prefers-color-scheme: dark) { input { background: #020617; border-color: #475569; color: #f8fafc; } }
        .field { margin-bottom: 0.9rem; }
        .btn { width: 100%; padding: 0.5rem; border-radius: 0.45rem; border: none; background: #6366f1; color: #fff; font-weight: 600; cursor: pointer; font-family: inherit; font-size: 0.9rem; }
        .btn:hover { background: #4f46e5; }
        .error { color: #f87171; font-size: 0.8rem; margin-top: 0.25rem; }
        h1 { font-size: 1.25rem; font-weight: 700; margin: 0 0 1.1rem; letter-spacing: -0.02em; }
        @media (prefers-color-scheme: dark) { h1 { color: #f8fafc; } }
        .chk { display: flex; align-items: center; gap: 0.4rem; font-size: 0.875rem; }
        .chk input { width: auto; }
    </style>
</head>
<body>
    <div class="box">
        @yield('content')
    </div>
</body>
</html>

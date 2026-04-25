<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('title', 'CMS') — {{ config('app.name') }}</title>
    <style>
        :root { color-scheme: light dark; }
        body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: #fafafa; color: #18181b; line-height: 1.5; }
        @media (prefers-color-scheme: dark) {
            body { background: #09090b; color: #fafafa; }
            .card { background: #18181b !important; border-color: #27272a !important; }
            input, select, textarea { background: #09090b !important; color: #fafafa !important; border-color: #3f3f46 !important; }
            table { border-color: #27272a !important; }
            th, td { border-color: #27272a !important; }
        }
        a { color: #4f46e5; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .top { background: #18181b; color: #fafafa; padding: 0.75rem 1.25rem; display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem 1.25rem; }
        .top a { color: #a1a1aa; }
        .top a:hover { color: #fafafa; }
        .top .brand { font-weight: 600; color: #fafafa; margin-right: auto; }
        main { max-width: 56rem; margin: 0 auto; padding: 1.25rem; }
        .card { background: #fff; border: 1px solid #e4e4e7; border-radius: 0.5rem; padding: 1rem 1.25rem; margin-bottom: 1rem; }
        .muted { color: #71717a; font-size: 0.875rem; }
        .btn { display: inline-block; padding: 0.4rem 0.75rem; border-radius: 0.375rem; border: 1px solid #d4d4d8; background: #fff; cursor: pointer; font-size: 0.875rem; }
        .btn-primary { background: #4f46e5; border-color: #4338ca; color: #fff; }
        .btn-danger { background: #dc2626; border-color: #b91c1c; color: #fff; }
        label { display: block; font-size: 0.8rem; font-weight: 500; margin-bottom: 0.25rem; }
        input, select, textarea { width: 100%; max-width: 100%; padding: 0.45rem 0.5rem; border-radius: 0.375rem; border: 1px solid #d4d4d8; box-sizing: border-box; }
        textarea { min-height: 10rem; font-family: ui-monospace, monospace; font-size: 0.85rem; }
        .field { margin-bottom: 0.85rem; }
        .error { color: #dc2626; font-size: 0.8rem; margin-top: 0.25rem; }
        .flash { background: #ecfdf5; border: 1px solid #6ee7b7; color: #065f46; padding: 0.6rem 0.85rem; border-radius: 0.375rem; margin-bottom: 1rem; font-size: 0.875rem; }
        table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
        th, td { text-align: left; padding: 0.5rem 0.4rem; border-bottom: 1px solid #e4e4e7; vertical-align: top; }
        .row-actions { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
        h1 { font-size: 1.35rem; margin: 0 0 0.75rem; }
        h2 { font-size: 1.1rem; margin: 0 0 0.5rem; }
    </style>
    @stack('head')
</head>
<body>
    <header class="top">
        <span class="brand">Story CMS</span>
        <a href="{{ route('cms.dashboard') }}">Bảng điều khiển</a>
        <a href="{{ route('cms.stories.index') }}">Truyện</a>
        <a href="{{ route('cms.lexicons.index') }}">Lexicon</a>
        <a href="{{ url('/docs/api') }}" target="_blank" rel="noopener">API docs</a>
        <form action="{{ route('cms.logout') }}" method="post" style="margin-left: auto;">
            @csrf
            <button type="submit" class="btn">Đăng xuất</button>
        </form>
    </header>
    <main>
        @if (session('status'))
            <div class="flash">{{ session('status') }}</div>
        @endif
        @if ($errors->any())
            <div class="card" style="border-color: #fecaca;">
                <strong>Không lưu được:</strong>
                <ul style="margin: 0.5rem 0 0 1rem;">
                    @foreach ($errors->all() as $err)
                        <li>{{ $err }}</li>
                    @endforeach
                </ul>
            </div>
        @endif
        @yield('content')
    </main>
</body>
</html>

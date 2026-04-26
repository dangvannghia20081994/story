<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('title', 'CMS') — {{ config('app.name') }}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap" rel="stylesheet">
    <style>
        :root {
            --font: "DM Sans", ui-sans-serif, system-ui, sans-serif;
            --content-max: 88rem;
            --sidebar-w: 15.5rem;
            --sidebar-bg: #0f172a;
            --sidebar-border: #1e293b;
            --sidebar-text: #94a3b8;
            --sidebar-hover: #1e293b;
            --sidebar-active: #312e81;
            --sidebar-active-fg: #e0e7ff;
            --accent: #6366f1;
            --accent-hover: #4f46e5;
            --body-bg: #f1f5f9;
            --surface: #fff;
            --surface-border: #e2e8f0;
            --text: #0f172a;
            --muted: #64748b;
        }
        @media (prefers-color-scheme: dark) {
            :root {
                --body-bg: #020617;
                --surface: #0f172a;
                --surface-border: #1e293b;
                --text: #f1f5f9;
                --muted: #94a3b8;
            }
        }
        *, *::before, *::after { box-sizing: border-box; }
        body {
            margin: 0;
            font-family: var(--font);
            background: var(--body-bg);
            color: var(--text);
            line-height: 1.5;
            min-height: 100vh;
        }
        a { color: var(--accent); text-decoration: none; }
        a:hover { text-decoration: underline; }
        .app { display: flex; min-height: 100vh; }
        .sidebar {
            position: fixed;
            left: 0;
            top: 0;
            z-index: 200;
            width: var(--sidebar-w);
            height: 100vh;
            background: var(--sidebar-bg);
            color: #f8fafc;
            display: flex;
            flex-direction: column;
            border-right: 1px solid var(--sidebar-border);
            transform: translateX(0);
            transition: transform 0.2s ease;
        }
        @media (max-width: 900px) {
            .sidebar { transform: translateX(-100%); }
            .app--nav-open .sidebar { transform: translateX(0); }
        }
        .sidebar__brand {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            padding: 1.1rem 1.15rem 1.25rem;
            font-weight: 700;
            font-size: 1.02rem;
            color: #fff;
            text-decoration: none;
            border-bottom: 1px solid var(--sidebar-border);
        }
        .sidebar__brand:hover { text-decoration: none; color: #c7d2fe; }
        .sidebar__nav { flex: 1; padding: 0.75rem 0.5rem; overflow-y: auto; }
        .nav-item {
            display: flex;
            align-items: center;
            gap: 0.65rem;
            padding: 0.5rem 0.7rem 0.5rem 0.6rem;
            border-radius: 0.4rem;
            color: var(--sidebar-text);
            text-decoration: none;
            font-size: 0.9rem;
            font-weight: 500;
            margin-bottom: 0.15rem;
        }
        .nav-item:hover { background: var(--sidebar-hover); color: #e2e8f0; text-decoration: none; }
        .nav-item[aria-current="page"] {
            background: var(--sidebar-active);
            color: var(--sidebar-active-fg);
        }
        .nav-item svg { flex-shrink: 0; opacity: 0.85; }
        .nav-item[aria-current="page"] svg { opacity: 1; }
        .sidebar__footer { padding: 0.6rem 0.5rem 1rem; border-top: 1px solid var(--sidebar-border); }
        .app__main { flex: 1; min-width: 0; display: flex; flex-direction: column; margin-left: var(--sidebar-w); }
        @media (max-width: 900px) {
            .app__main { margin-left: 0; }
        }
        .content-header {
            position: sticky;
            top: 0;
            z-index: 50;
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 0.6rem 1rem;
            min-height: 3.1rem;
            padding: 0.55rem 1.5rem;
            background: var(--surface);
            border-bottom: 1px solid var(--surface-border);
            box-shadow: 0 1px 0 rgba(15, 23, 42, 0.04);
        }
        @media (prefers-color-scheme: dark) {
            .content-header { box-shadow: 0 1px 0 rgba(0, 0, 0, 0.2); }
        }
        .content-header__left {
            display: flex;
            align-items: center;
            gap: 0.65rem;
            min-width: 0;
            flex: 1;
        }
        .content-header__right {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 0.5rem 0.9rem;
        }
        .user-email { font-size: 0.85rem; color: var(--muted); max-width: 12rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        @media (min-width: 480px) { .user-email { max-width: 20rem; } }
        .menu-toggle {
            display: none;
            align-items: center;
            justify-content: center;
            width: 2.4rem; height: 2.4rem;
            border-radius: 0.4rem;
            border: 1px solid var(--surface-border);
            background: var(--body-bg);
            color: var(--text);
            cursor: pointer;
            flex-shrink: 0;
        }
        @media (max-width: 900px) { .menu-toggle { display: inline-flex; } }
        .content-header .btn-logout { padding: 0.38rem 0.7rem; font-size: 0.82rem; }
        .app-content {
            padding: 1.35rem clamp(1rem, 2.5vw, 2rem) 2.5rem;
            max-width: var(--content-max);
            width: 100%;
            margin: 0 auto;
            box-sizing: border-box;
        }
        .app-content--wide {
            max-width: 100%;
            width: 100%;
            margin: 0;
            padding: 1.1rem clamp(1rem, 2.5vw, 2rem) 2rem;
            box-sizing: border-box;
        }
        .app-content h1, .app-content--wide h1 { font-size: 1.5rem; font-weight: 700; margin: 0 0 0.35rem; letter-spacing: -0.02em; }
        .content-lead { color: var(--muted); font-size: 0.9rem; margin: 0 0 1.1rem; }
        .page-head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1.1rem; }
        .page-head h1 { margin: 0; }
        .card {
            background: var(--surface);
            border: 1px solid var(--surface-border);
            border-radius: 0.65rem;
            padding: 1.1rem 1.2rem;
            margin-bottom: 1rem;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }
        .card--table { padding: 0; overflow: hidden; }
        .table-scroll { overflow-x: auto; }
        .table-scroll table { margin: 0; }
        .muted { color: var(--muted); font-size: 0.875rem; }
        .btn {
            display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem;
            padding: 0.45rem 0.9rem; border-radius: 0.45rem; border: 1px solid var(--surface-border);
            background: var(--surface); color: var(--text); cursor: pointer; font-size: 0.875rem; font-weight: 500; font-family: inherit; text-decoration: none;
        }
        .btn:hover { background: #f8fafc; text-decoration: none; }
        @media (prefers-color-scheme: dark) { .btn:hover { background: #1e293b; } }
        .btn-primary {
            background: var(--accent); border-color: var(--accent-hover); color: #fff;
        }
        .btn-primary:hover { background: var(--accent-hover); color: #fff; }
        .btn-danger { background: #dc2626; border-color: #b91c1c; color: #fff; }
        .btn-danger:hover { background: #b91c1c; color: #fff; }
        label { display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.3rem; color: var(--text); }
        input, select, textarea {
            width: 100%; max-width: 100%; padding: 0.5rem 0.6rem; border-radius: 0.45rem;
            border: 1px solid var(--surface-border); background: var(--surface); color: var(--text); box-sizing: border-box; font-family: inherit; font-size: 0.9rem;
        }
        /* Bỏ outline mặc định (chồng lên border); chỉ đổi 1 lớp border khi focus */
        input:focus, select:focus, textarea:focus {
            outline: none;
            border-color: var(--accent);
        }
        @media (prefers-color-scheme: dark) {
            input, select, textarea { background: #020617; border-color: #334155; }
            input:focus, select:focus, textarea:focus {
                border-color: #818cf8;
            }
        }
        textarea { min-height: 10rem; font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 0.85rem; }
        .field { margin-bottom: 0.9rem; }
        .error { color: #dc2626; font-size: 0.8rem; margin-top: 0.25rem; }
        .flash {
            background: #ecfdf5; border: 1px solid #6ee7b7; color: #065f46; padding: 0.7rem 1rem; border-radius: 0.5rem; margin-bottom: 1rem; font-size: 0.875rem;
        }
        @media (prefers-color-scheme: dark) { .flash { background: #052e1b; border-color: #166534; color: #bbf7d0; } }
        table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
        th, td { text-align: left; padding: 0.55rem 0.6rem; border-bottom: 1px solid var(--surface-border); vertical-align: top; }
        th { font-weight: 600; color: var(--muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; }
        tbody tr:hover { background: rgba(99, 102, 241, 0.04); }
        @media (prefers-color-scheme: dark) { tbody tr:hover { background: rgba(99, 102, 241, 0.08); } }
        h2 { font-size: 1.05rem; font-weight: 600; margin: 0 0 0.5rem; }
        .row-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
        .sidebar-backdrop {
            display: none; position: fixed; inset: 0; z-index: 199; background: rgba(0,0,0,0.45);
        }
        @media (max-width: 900px) { .app--nav-open .sidebar-backdrop { display: block; } }
        .add-dropdown { display: inline-block; position: relative; z-index: 0; }
        .add-dropdown[open] { z-index: 400; }
        .add-dropdown[open] > summary.btn-primary { background: var(--accent-hover); }
        .add-dropdown__menu {
            position: absolute; left: 0; top: 100%; z-index: 1; margin-top: 0.2rem; min-width: 11.5rem;
            padding: 0.3rem; background: var(--surface); border: 1px solid var(--surface-border);
            border-radius: 0.45rem; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
        }
        @media (prefers-color-scheme: dark) { .add-dropdown__menu { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4); } }
        .add-dropdown__menu a {
            display: block; padding: 0.5rem 0.7rem; border-radius: 0.35rem; color: var(--text); text-decoration: none; font-size: 0.875rem;
        }
        .add-dropdown__menu a:hover { background: #f1f5f9; text-decoration: none; }
        @media (prefers-color-scheme: dark) { .add-dropdown__menu a:hover { background: #1e293b; } }
        .add-dropdown > summary { list-style: none; }
        .add-dropdown > summary::-webkit-details-marker { display: none; }
    </style>
    @stack('head')
</head>
<body>
    <div class="app" id="app-root">
        <div class="sidebar-backdrop" id="sidebar-backdrop" aria-hidden="true"></div>
        <aside class="sidebar" aria-label="Menu chính">
            <a class="sidebar__brand" href="{{ route('cms.dashboard') }}">Story CMS</a>
            <nav class="sidebar__nav" aria-label="CMS">
                <a class="nav-item" href="{{ route('cms.dashboard') }}" @if (request()->routeIs('cms.dashboard')) aria-current="page" @endif>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    Bảng điều khiển
                </a>
                <a class="nav-item" href="{{ route('cms.stories.index') }}" @if (request()->routeIs('cms.stories.*')) aria-current="page" @endif>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                    Truyện
                </a>
                <a class="nav-item" href="{{ route('cms.lexicons.index') }}" @if (request()->routeIs('cms.lexicons.*')) aria-current="page" @endif>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    Lexicon
                </a>
                <a class="nav-item" href="{{ route('cms.crawler-jobs.index') }}" @if (request()->routeIs('cms.crawler-jobs.*')) aria-current="page" @endif>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>
                    Crawler
                </a>
            </nav>
            <div class="sidebar__footer">
                <a class="nav-item" href="{{ url('/docs/api') }}" target="_blank" rel="noopener" style="margin: 0;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/></svg>
                    Tài liệu API
                </a>
            </div>
        </aside>
        <div class="app__main">
            <header class="content-header" role="banner">
                <div class="content-header__left">
                    <button type="button" class="menu-toggle" id="menu-toggle" aria-label="Mở menu" aria-controls="app-root" aria-expanded="false">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                    </button>
                    <span class="muted" style="font-size: 0.8rem; font-weight: 500; letter-spacing: 0.02em;">@yield('header_crumbs', 'Story CMS')</span>
                </div>
                <div class="content-header__right">
                    <span class="user-email" title="{{ auth()->user()->email }}">{{ auth()->user()->email }}</span>
                    <form action="{{ route('cms.logout') }}" method="post" style="display: inline; margin: 0;">
                        @csrf
                        <button type="submit" class="btn btn-logout">Đăng xuất</button>
                    </form>
                </div>
            </header>
            <div class="app-content @yield('content_class')">
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
            </div>
        </div>
    </div>
    <script>
    (function () {
        const root = document.getElementById('app-root');
        const back = document.getElementById('sidebar-backdrop');
        const btn = document.getElementById('menu-toggle');
        if (!root || !btn) return;
        function openNav() { root.classList.add('app--nav-open'); if (back) { back.setAttribute('aria-hidden', 'false'); } btn.setAttribute('aria-expanded', 'true'); }
        function closeNav() { root.classList.remove('app--nav-open'); if (back) { back.setAttribute('aria-hidden', 'true'); } btn.setAttribute('aria-expanded', 'false'); }
        function toggle() { if (root.classList.contains('app--nav-open')) closeNav(); else openNav(); }
        btn.addEventListener('click', function () { toggle(); });
        if (back) { back.addEventListener('click', function () { closeNav(); }); }
        document.querySelectorAll('.sidebar a[href]:not([target="_blank"])').forEach(function (a) {
            a.addEventListener('click', function () { if (window.matchMedia('(max-width: 900px)').matches) { closeNav(); } });
        });
    })();
    </script>
</body>
</html>

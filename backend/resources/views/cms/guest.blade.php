<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="utf-8">
    <script>
    (function () {
        try {
            var k = 'cms-theme', s = localStorage.getItem(k), mq = window.matchMedia('(prefers-color-scheme: dark)');
            if (s !== 'light' && s !== 'dark' && s !== 'system') { s = 'system'; }
            var eff = s === 'light' ? 'light' : s === 'dark' ? 'dark' : (mq.matches ? 'dark' : 'light');
            document.documentElement.classList.remove('theme-light', 'theme-dark');
            document.documentElement.classList.add('theme-' + eff);
            document.documentElement.dataset.themePref = s;
        } catch (e) {}
    })();
    </script>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Đăng nhập CMS — {{ config('app.name') }}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; }
        html.theme-light { color-scheme: light; }
        html.theme-dark { color-scheme: dark; }
        body {
            margin: 0;
            font-family: "DM Sans", ui-sans-serif, system-ui, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem 1rem;
            background: linear-gradient(150deg, #f8fafc 0%, #e2e8f0 45%, #cbd5e1 100%);
        }
        html.theme-dark body {
            background: linear-gradient(150deg, #0f172a 0%, #1e1b4b 45%, #312e81 100%);
        }
        .box {
            width: 100%;
            max-width: 24rem;
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 0.75rem;
            padding: 1.6rem 1.5rem 1.5rem;
            box-shadow: 0 20px 50px -12px rgba(15, 23, 42, 0.15);
        }
        html.theme-dark .box {
            background: #0f172a;
            border-color: #334155;
            box-shadow: 0 20px 50px -12px rgba(0, 0, 0, 0.45);
        }
        label { display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.3rem; color: #0f172a; }
        html.theme-dark label { color: #e2e8f0; }
        input { width: 100%; padding: 0.5rem 0.6rem; border-radius: 0.45rem; border: 1px solid #cbd5e1; box-sizing: border-box; font-size: 0.9rem; }
        html.theme-dark input { background: #020617; border-color: #475569; color: #f8fafc; }
        .field { margin-bottom: 0.9rem; }
        .btn { width: 100%; padding: 0.5rem; border-radius: 0.45rem; border: none; background: #6366f1; color: #fff; font-weight: 600; cursor: pointer; font-family: inherit; font-size: 0.9rem; }
        .btn:hover { background: #4f46e5; }
        .error { color: #dc2626; font-size: 0.8rem; margin-top: 0.25rem; }
        html.theme-dark .error { color: #f87171; }
        h1 { font-size: 1.25rem; font-weight: 700; margin: 0 0 1.1rem; letter-spacing: -0.02em; color: #0f172a; }
        html.theme-dark h1 { color: #f8fafc; }
        .chk { display: flex; align-items: center; gap: 0.4rem; font-size: 0.875rem; color: #334155; }
        html.theme-dark .chk { color: #cbd5e1; }
        html.theme-dark body { color: #f1f5f9; }
        .chk label { display: inline; margin-bottom: 0; font-weight: 500; }
        .chk input { width: auto; }
        .theme-picker {
            position: fixed;
            top: 0.85rem;
            right: 0.85rem;
            z-index: 10;
            display: inline-flex;
            border-radius: 0.45rem;
            border: 1px solid rgba(15, 23, 42, 0.12);
            overflow: hidden;
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(6px);
        }
        html.theme-dark .theme-picker {
            border-color: rgba(148, 163, 184, 0.25);
            background: rgba(15, 23, 42, 0.85);
        }
        .theme-picker__btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 2.35rem;
            height: 2.35rem;
            padding: 0;
            border: none;
            border-right: 1px solid rgba(15, 23, 42, 0.1);
            background: transparent;
            color: #64748b;
            cursor: pointer;
            font-family: inherit;
        }
        html.theme-dark .theme-picker__btn {
            border-right-color: rgba(148, 163, 184, 0.2);
            color: #94a3b8;
        }
        .theme-picker__btn:last-child { border-right: none; }
        .theme-picker__btn:hover { color: #0f172a; background: rgba(99, 102, 241, 0.1); }
        html.theme-dark .theme-picker__btn:hover { color: #e2e8f0; background: rgba(129, 140, 248, 0.15); }
        .theme-picker__btn[aria-pressed="true"] {
            color: #4f46e5;
            background: rgba(99, 102, 241, 0.12);
        }
        html.theme-dark .theme-picker__btn[aria-pressed="true"] {
            color: #a5b4fc;
            background: rgba(79, 70, 229, 0.25);
        }
        .theme-picker__btn:focus-visible { outline: 2px solid #6366f1; outline-offset: 2px; }
        .theme-picker__btn svg { width: 1rem; height: 1rem; }
    </style>
</head>
<body>
    <div class="theme-picker" role="group" aria-label="Chế độ giao diện">
        <button type="button" class="theme-picker__btn" data-theme-pick="light" title="Giao diện sáng" aria-pressed="false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
        </button>
        <button type="button" class="theme-picker__btn" data-theme-pick="system" title="Theo thiết bị" aria-pressed="false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
        </button>
        <button type="button" class="theme-picker__btn" data-theme-pick="dark" title="Giao diện tối" aria-pressed="false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
    </div>
    <div class="box">
        @yield('content')
    </div>
    <script>
    (function () {
        var STORAGE = 'cms-theme';
        function readPref() {
            try {
                var s = localStorage.getItem(STORAGE);
                if (s === 'light' || s === 'dark' || s === 'system') { return s; }
            } catch (e) {}
            return 'system';
        }
        function effective(p) {
            if (p === 'light') { return 'light'; }
            if (p === 'dark') { return 'dark'; }
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        function applyFromPref(p) {
            var e = effective(p);
            document.documentElement.classList.remove('theme-light', 'theme-dark');
            document.documentElement.classList.add('theme-' + e);
            document.documentElement.dataset.themePref = p;
            document.querySelectorAll('.theme-picker__btn').forEach(function (b) {
                b.setAttribute('aria-pressed', (b.getAttribute('data-theme-pick') === p) ? 'true' : 'false');
            });
        }
        function setPref(p) {
            try { localStorage.setItem(STORAGE, p); } catch (err) {}
            applyFromPref(p);
        }
        var mq = window.matchMedia('(prefers-color-scheme: dark)');
        if (mq.addEventListener) {
            mq.addEventListener('change', function () { if (readPref() === 'system') { applyFromPref('system'); } });
        } else if (mq.addListener) {
            mq.addListener(function () { if (readPref() === 'system') { applyFromPref('system'); } });
        }
        document.querySelectorAll('.theme-picker__btn').forEach(function (btn) {
            btn.addEventListener('click', function () { setPref(btn.getAttribute('data-theme-pick') || 'system'); });
        });
        applyFromPref(readPref());
    })();
    </script>
</body>
</html>

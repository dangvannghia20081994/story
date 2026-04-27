{{-- Toast dùng chung CMS: window.cmsToast(message, { variant?, durationMs?, position? }) --}}
<style>
    .cms-toast-stack {
        position: fixed;
        z-index: 600;
        display: flex;
        gap: 0.45rem;
        max-width: min(22rem, calc(100vw - 2rem));
        pointer-events: none;
    }
    .cms-toast-stack--top-right {
        top: max(1rem, env(safe-area-inset-top, 0px));
        right: max(1rem, env(safe-area-inset-right, 0px));
        flex-direction: column;
        align-items: flex-end;
    }
    .cms-toast-stack--top-left {
        top: max(1rem, env(safe-area-inset-top, 0px));
        left: max(1rem, env(safe-area-inset-left, 0px));
        flex-direction: column;
        align-items: flex-start;
    }
    .cms-toast-stack--bottom-right {
        bottom: max(1rem, env(safe-area-inset-bottom, 0px));
        right: max(1rem, env(safe-area-inset-right, 0px));
        flex-direction: column-reverse;
        align-items: flex-end;
    }
    .cms-toast-stack--bottom-left {
        bottom: max(1rem, env(safe-area-inset-bottom, 0px));
        left: max(1rem, env(safe-area-inset-left, 0px));
        flex-direction: column-reverse;
        align-items: flex-start;
    }
    .cms-toast {
        pointer-events: auto;
        margin: 0;
        padding: 0.65rem 1rem;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        line-height: 1.35;
        box-shadow: 0 10px 36px rgba(15, 23, 42, 0.14);
        border: 1px solid #6ee7b7;
        background: #ecfdf5;
        color: #065f46;
        transition: opacity 0.22s ease, transform 0.22s ease;
    }
    .cms-toast--error {
        border-color: #fecaca;
        background: #fef2f2;
        color: #991b1b;
    }
    .cms-toast--out { opacity: 0; }
    .cms-toast-stack--top-right .cms-toast--out,
    .cms-toast-stack--bottom-right .cms-toast--out { transform: translateX(0.75rem); }
    .cms-toast-stack--top-left .cms-toast--out,
    .cms-toast-stack--bottom-left .cms-toast--out { transform: translateX(-0.75rem); }
    html.theme-dark .cms-toast:not(.cms-toast--error) {
        border-color: #166534;
        background: #052e1b;
        color: #bbf7d0;
        box-shadow: 0 10px 36px rgba(0, 0, 0, 0.45);
    }
    html.theme-dark .cms-toast--error {
        border-color: #7f1d1d;
        background: #450a0a;
        color: #fecaca;
        box-shadow: 0 10px 36px rgba(0, 0, 0, 0.45);
    }
</style>
<script>
window.__CMS_TOAST__ = @json([
    'position' => config('cms.toast.position'),
    'durationMs' => (int) config('cms.toast.duration_ms'),
]);
(function () {
    var CFG = window.__CMS_TOAST__ || { position: 'top-right', durationMs: 3000 };
    var POS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    function normPos(p) {
        p = String(p || '').trim();
        return POS.indexOf(p) >= 0 ? p : 'top-right';
    }
    function normDuration(ms, fallback) {
        if (typeof ms !== 'number' || ms < 0 || isNaN(ms)) {
            ms = fallback;
        }
        return Math.min(120000, Math.max(300, ms));
    }
    function getStack(position) {
        var id = 'cms-toast-stack';
        var el = document.getElementById(id);
        if (!el) {
            el = document.createElement('div');
            el.id = id;
            el.setAttribute('aria-live', 'polite');
            document.body.appendChild(el);
        }
        position = normPos(position);
        el.className = 'cms-toast-stack cms-toast-stack--' + position;
        return el;
    }
    // cmsToast(message, opts?: { variant: 'success'|'error', durationMs?: number, position?: string })
    window.cmsToast = function (message, opts) {
        opts = opts || {};
        if (!message) {
            return;
        }
        var variant = opts.variant === 'error' ? 'error' : 'success';
        var fallbackMs = typeof CFG.durationMs === 'number' ? CFG.durationMs : 3000;
        var durationMs = normDuration(opts.durationMs, fallbackMs);
        var position = opts.position != null && opts.position !== '' ? opts.position : CFG.position;
        var stack = getStack(position);
        var t = document.createElement('div');
        t.className = 'cms-toast' + (variant === 'error' ? ' cms-toast--error' : '');
        t.setAttribute('role', 'status');
        t.textContent = message;
        stack.insertBefore(t, stack.firstChild);
        setTimeout(function () {
            t.classList.add('cms-toast--out');
            setTimeout(function () {
                t.remove();
                if (!stack.firstChild) {
                    stack.remove();
                }
            }, 240);
        }, durationMs);
    };
})();
</script>

{{-- Dùng chung cho trang con của một truyện (chương, nhân vật, …) --}}
<style>
    .cms-story-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; margin-bottom: 1rem; }
    .cms-story-row-actions {
        display: flex;
        flex-wrap: nowrap;
        align-items: center;
        justify-content: flex-end;
        gap: 0.4rem;
        white-space: nowrap;
    }
    .cms-story-row-actions form {
        display: inline-flex;
        margin: 0;
        align-items: center;
        flex-shrink: 0;
    }
    .icon-btn {
        display: inline-flex; align-items: center; justify-content: center; width: 2.1rem; height: 2.1rem; padding: 0;
        border-radius: 0.4rem; border: 1px solid var(--surface-border); background: var(--surface); color: var(--text);
        cursor: pointer; text-decoration: none; line-height: 0; box-sizing: border-box;
    }
    .icon-btn:hover:not(:disabled) { background: #f1f5f9; color: #6366f1; border-color: #c7d2fe; }
    html.theme-dark .icon-btn:hover:not(:disabled) { background: #1e293b; color: #a5b4fc; border-color: #475569; }
    .icon-btn svg { width: 1.05rem; height: 1.05rem; flex-shrink: 0; }
    .icon-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .icon-btn--danger { border-color: #fecaca; color: #dc2626; background: #fef2f2; }
    html.theme-dark .icon-btn--danger { border-color: #7f1d1d; color: #fca5a5; background: rgba(63, 15, 15, 0.35); }
    .icon-btn--danger:hover:not(:disabled) { background: #fee2e2; color: #b91c1c; border-color: #f87171; }
    html.theme-dark .icon-btn--danger:hover:not(:disabled) { background: #450a0a; }
    .th-actions {
        width: 1%;
        white-space: nowrap;
        text-align: right;
        text-transform: none;
        letter-spacing: 0.04em;
        font-size: 0.7rem;
        color: var(--muted);
    }
</style>

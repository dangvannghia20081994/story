    <style>
        .bulk-hero { margin-bottom: 0.5rem; }
        .bulk-hero a { color: var(--accent); font-size: 0.875rem; }
        .bulk-tbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; }
        .sheet-outer { margin-top: 0.25rem; }
        .bulk-grid-card { background: var(--body-bg) !important; box-shadow: none !important; border: 1px solid var(--surface-border) !important; }
        .bulk-hot {
            --ht-border: #cbd5e1;
            --ht-header-bg2: #312e81;
            --ht-header-bg1: #1e1b4b;
            --ht-rowhead-bg: #e2e8f0;
            --ht-rowhead-fg: #64748b;
            --ht-cell-odd: #f8fafc;
            --ht-cell-even: #f1f5f9;
            --ht-cursor: #6366f1;
            --ht-font-size: 0.88rem;
            width: 100%;
            min-height: 20rem;
            max-height: calc(100vh - 13rem);
            border-radius: 0.4rem;
            overflow: hidden;
        }
        html.theme-dark .bulk-hot {
            --ht-border: #334155;
            --ht-header-bg1: #0f172a;
            --ht-header-bg2: #1e1b4b;
            --ht-rowhead-bg: #0f172a;
            --ht-rowhead-fg: #94a3b8;
            --ht-cell-odd: #0f172a;
            --ht-cell-even: #1e293b;
            --ht-cursor: #818cf8;
        }
        .bulk-hot .handsontable { font-family: "DM Sans", ui-sans-serif, system-ui, sans-serif; color: var(--text); }
        .bulk-hot .wtHider,
        .bulk-hot .wtSpreader,
        .bulk-hot .ht_master .wtHolder { background: var(--body-bg) !important; }
        .bulk-hot .htCore thead th {
            background: linear-gradient(180deg, var(--ht-header-bg2) 0%, var(--ht-header-bg1) 100%) !important;
            color: #e0e7ff !important;
            font-weight: 600;
            font-size: 0.7rem;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            border-color: #4338ca !important;
        }
        html.theme-dark .bulk-hot .htCore thead th { border-color: #3730a3 !important; }
        .bulk-hot .htCore tbody th,
        .bulk-hot tr td.rowHeader { background: var(--ht-rowhead-bg) !important; color: var(--ht-rowhead-fg) !important; border-color: var(--ht-border) !important; }
        .bulk-hot .htCore td {
            color: var(--text) !important;
            border-color: var(--ht-border) !important;
            background: var(--ht-cell-odd) !important;
        }
        .bulk-hot .htCore tr:nth-child(even) td { background: var(--ht-cell-even) !important; }
        .bulk-hot .htCore td.current, .bulk-hot .htCore td.highlight {
            background-color: rgba(99, 102, 241, 0.14) !important;
        }
        html.theme-dark .bulk-hot .htCore td.current, html.theme-dark .bulk-hot .htCore td.highlight {
            background-color: rgba(129, 140, 248, 0.22) !important;
        }
        .bulk-hot .wtBorder { background-color: var(--ht-cursor) !important; }
        .bulk-hot .handsontableInput,
        .bulk-hot .handsontableInputHolder {
            color: var(--text) !important;
            background: var(--surface) !important;
            border: 1px solid var(--accent) !important;
        }
        .htListbox, .htContextMenu, .htMenu, .htDropdownMenu, .htFiltersMenuHolder {
            background: #e2e8f0 !important;
            color: #0f172a !important;
            border: 1px solid #cbd5e1 !important;
            box-shadow: 0 8px 24px rgba(15, 23, 42, 0.15) !important;
        }
        html.theme-dark .htListbox, html.theme-dark .htContextMenu, html.theme-dark .htMenu, html.theme-dark .htDropdownMenu, html.theme-dark .htFiltersMenuHolder {
            background: #1e293b !important;
            color: #e2e8f0 !important;
            border-color: #334155 !important;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5) !important;
        }
        .htListbox tr td, .htListbox table td, .htListbox tr th {
            color: #0f172a !important;
            background: #f1f5f9 !important;
            border-color: #cbd5e1 !important;
        }
        .htListbox tr:hover td, .htListbox tr.ht__highlight td, .htListbox tr.ht__active td, .htListbox tr.ht__current td,
        .htListbox tr.ht__highlight th, .htListbox tr.ht__active th, .htListbox tr.ht__current th {
            background: #c7d2fe !important;
            color: #1e1b4b !important;
        }
        html.theme-dark .htListbox tr td, html.theme-dark .htListbox table td, html.theme-dark .htListbox tr th {
            color: #e2e8f0 !important;
            background: #0f172a !important;
            border-color: #334155 !important;
        }
        html.theme-dark .htListbox tr:hover td, html.theme-dark .htListbox tr.ht__highlight td, html.theme-dark .htListbox tr.ht__active td, html.theme-dark .htListbox tr.ht__current td,
        html.theme-dark .htListbox tr.ht__highlight th, html.theme-dark .htListbox tr.ht__active th, html.theme-dark .htListbox tr.ht__current th {
            background: #4f46e5 !important;
            color: #eef2ff !important;
        }
        .htListbox.ht__active, .htListbox .ht__active, .htListbox .current {
            color: inherit !important;
        }
        .htContextMenu table td, .htMenu tr td, .htDropdownMenu tr td, .htFiltersMenuValue label {
            color: var(--text) !important;
            border-color: var(--surface-border) !important;
        }
        .htContextMenu tr td, .htMenu tr td, .htDropdownMenu tr:hover td { background: var(--surface) !important; }
        .htContextMenu tr:hover td, .htMenu tr.ht__highlight, .htDropdownMenu tr:hover { background: #f1f5f9 !important; }
        html.theme-dark .htContextMenu tr:hover td, html.theme-dark .htMenu tr.ht__highlight, html.theme-dark .htDropdownMenu tr:hover { background: #1e293b !important; }
        .bulk-hot select,
        .bulk-hot .handsontableInput.htSelect,
        #bulk-form select.htSelect, #chapters-bulk-form select.htSelect,
        .handsontable .htListbox,
        .handsontable select {
            color: #0f172a !important;
            background: #e8ecf4 !important;
            background-color: #e8ecf4 !important;
            border: 1px solid #94a3b8 !important;
        }
        .bulk-hot select:focus, .bulk-hot select:active,
        .handsontable select:focus, .handsontable select:hover {
            background: #f1f5f9 !important;
            background-color: #f1f5f9 !important;
            border-color: #6366f1 !important;
        }
        html.theme-dark .bulk-hot select, html.theme-dark .bulk-hot .handsontableInput.htSelect, html.theme-dark #bulk-form select.htSelect, html.theme-dark #chapters-bulk-form select.htSelect, html.theme-dark .handsontable select {
            color: #e2e8f0 !important;
            background: #1e293b !important;
            background-color: #1e293b !important;
            border-color: #64748b !important;
        }
        html.theme-dark .bulk-hot select:focus, html.theme-dark .bulk-hot select:active, html.theme-dark .handsontable select:focus, html.theme-dark .handsontable select:hover {
            background: #334155 !important;
            background-color: #334155 !important;
            border-color: #818cf8 !important;
        }
        .htListbox, .htListbox table { background: #e2e8f0 !important; }
        html.theme-dark .htListbox, html.theme-dark .htListbox table { background: #1e293b !important; }
        .sheet-form-footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; }
    </style>

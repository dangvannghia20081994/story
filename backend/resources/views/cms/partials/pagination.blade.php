@php
    /** @var \Illuminate\Contracts\Pagination\LengthAwarePaginator $paginator */
@endphp
@if ($paginator->hasPages())
    <p class="muted" style="margin-top: 1rem;">
        @if (! $paginator->onFirstPage())
            <a href="{{ $paginator->previousPageUrl() }}">← Trước</a>
            <span> · </span>
        @endif
        Trang {{ $paginator->currentPage() }} / {{ $paginator->lastPage() }}
        @if ($paginator->hasMorePages())
            <span> · </span>
            <a href="{{ $paginator->nextPageUrl() }}">Sau →</a>
        @endif
    </p>
@endif

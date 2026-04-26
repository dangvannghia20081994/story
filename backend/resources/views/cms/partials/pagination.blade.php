@php
    /** @var \Illuminate\Contracts\Pagination\LengthAwarePaginator $paginator */
@endphp
@if ($paginator->total() > 0)
    <p class="muted" style="margin-top: 1rem;">
        @if ($paginator->firstItem() !== null)
            Hiển thị {{ $paginator->firstItem() }}–{{ $paginator->lastItem() }} / {{ $paginator->total() }}
        @endif
        @if ($paginator->lastPage() > 1)
            <span> · </span>
            @if (! $paginator->onFirstPage())
                <a href="{{ $paginator->previousPageUrl() }}">← Trước</a>
                <span> · </span>
            @endif
            Trang {{ $paginator->currentPage() }} / {{ $paginator->lastPage() }}
            @if ($paginator->hasMorePages())
                <span> · </span>
                <a href="{{ $paginator->nextPageUrl() }}">Sau →</a>
            @endif
        @endif
    </p>
@endif

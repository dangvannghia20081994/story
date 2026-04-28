@php
    /** @var \Illuminate\Contracts\Pagination\LengthAwarePaginator $paginator */
    /** @var string $variant footer (mặc định) | toolbar — khoảng cách quanh khối phân trang */
    $variant = $variant ?? 'footer';
    $marginStyle = $variant === 'toolbar' ? 'margin: 0 0 0.65rem;' : 'margin-top: 1rem;';
@endphp
@if ($paginator->total() > 0)
    <p class="muted cms-pagination" style="{{ $marginStyle }}">
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

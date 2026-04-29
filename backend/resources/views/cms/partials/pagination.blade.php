@php
    /** @var \Illuminate\Contracts\Pagination\LengthAwarePaginator $paginator */
    /** @var string $variant footer (mặc định) | toolbar — khoảng cách quanh khối phân trang */
    $variant = $variant ?? 'footer';
    $marginStyle = $variant === 'toolbar' ? 'margin: 0 0 0.65rem;' : 'margin-top: 1rem;';
    $lastPage = max(1, (int) $paginator->lastPage());
    $currentPage = (int) $paginator->currentPage();
@endphp
@if ($paginator->total() > 0)
    <nav class="muted cms-pagination" style="{{ $marginStyle }}" role="navigation" aria-label="Phân trang">
        @if ($paginator->firstItem() !== null)
            <span>Hiển thị {{ $paginator->firstItem() }}–{{ $paginator->lastItem() }} / {{ $paginator->total() }}</span>
            <span aria-hidden="true"> · </span>
        @endif
        <span>Trang {{ $currentPage }} / {{ $lastPage }}</span>
        @if ($lastPage > 1)
            <span aria-hidden="true"> · </span>
            @if (! $paginator->onFirstPage())
                <a href="{{ $paginator->previousPageUrl() }}">← Trước</a>
                <span aria-hidden="true"> · </span>
            @endif
            @php
                $delta = 2;
                $from = max(1, $currentPage - $delta);
                $to = min($lastPage, $currentPage + $delta);
                if ($from > 1) {
                    $showLeftEllipsis = $from > 2;
                } else {
                    $showLeftEllipsis = false;
                }
                if ($to < $lastPage) {
                    $showRightEllipsis = $to < $lastPage - 1;
                } else {
                    $showRightEllipsis = false;
                }
            @endphp
            @if ($from > 1)
                <a href="{{ $paginator->url(1) }}">1</a>
                @if ($showLeftEllipsis)
                    <span aria-hidden="true"> … </span>
                @endif
            @endif
            @foreach ($paginator->getUrlRange($from, $to) as $page => $url)
                @if ($page === $currentPage)
                    <strong class="cms-pagination__current" style="font-weight: 600; color: var(--text);">{{ $page }}</strong>
                @else
                    <a href="{{ $url }}">{{ $page }}</a>
                @endif
                @if (! $loop->last)
                    <span aria-hidden="true"> </span>
                @endif
            @endforeach
            @if ($to < $lastPage)
                @if ($showRightEllipsis)
                    <span aria-hidden="true"> … </span>
                @endif
                <a href="{{ $paginator->url($lastPage) }}">{{ $lastPage }}</a>
            @endif
            @if ($paginator->hasMorePages())
                <span aria-hidden="true"> · </span>
                <a href="{{ $paginator->nextPageUrl() }}">Sau →</a>
            @endif
        @endif
    </nav>
@endif

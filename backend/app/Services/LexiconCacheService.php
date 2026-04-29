<?php

namespace App\Services;

use App\Models\Lexicon;
use Illuminate\Contracts\Cache\Repository;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Cache;

final class LexiconCacheService
{
    public function cacheKey(): string
    {
        return (string) config('lexicon.cache_key', 'lexicons.all_ordered');
    }

    /**
     * @return Collection<int, Lexicon>
     */
    public function allOrdered(): Collection
    {
        return $this->repository()->rememberForever($this->cacheKey(), function (): Collection {
            return Lexicon::query()
                ->orderByDesc('priority')
                ->orderBy('word')
                ->get();
        });
    }

    public function invalidate(): void
    {
        $this->repository()->forget($this->cacheKey());
    }

    public function findById(int $id): ?Lexicon
    {
        return $this->allOrdered()->firstWhere('id', $id);
    }

    /**
     * Phân trang danh sách (GET /api/lexicons) từ bản cache đã sắp xếp.
     *
     * @return LengthAwarePaginator<int, Lexicon>
     */
    public function paginateFromCache(Request $request, int $perPage): LengthAwarePaginator
    {
        $all = $this->allOrdered();
        $perPage = min(100, max(1, $perPage));
        $page = max(1, (int) $request->input('page', 1));
        $total = $all->count();
        $slice = $all->forPage($page, $perPage)->values();

        return new LengthAwarePaginator(
            $slice,
            $total,
            $perPage,
            $page,
            ['path' => $request->url(), 'query' => $request->query()]
        );
    }

    private function repository(): Repository
    {
        $store = config('lexicon.cache_store');

        return is_string($store) && $store !== ''
            ? Cache::store($store)
            : Cache::driver();
    }
}

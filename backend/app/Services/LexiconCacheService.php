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
    private const CACHE_GLOBAL = 'lexicons.global_ordered_v2';

    private function storyOrderedKey(int $storyId): string
    {
        return "lexicons.story.{$storyId}_ordered_v2";
    }

    private function repository(): Repository
    {
        $store = config('lexicon.cache_store');

        return is_string($store) && $store !== ''
            ? Cache::store($store)
            : Cache::driver();
    }

    /**
     * Lexicon dùng chung (không gắn truyện).
     *
     * @return Collection<int, Lexicon>
     */
    public function globalOrdered(): Collection
    {
        return $this->repository()->rememberForever(self::CACHE_GLOBAL, function (): Collection {
            return Lexicon::query()
                ->whereNull('story_id')
                ->orderByDesc('priority')
                ->orderBy('word')
                ->get();
        });
    }

    /**
     * Lexicon chỉ thuộc một truyện.
     *
     * @return Collection<int, Lexicon>
     */
    public function forStoryOrdered(int $storyId): Collection
    {
        return $this->repository()->rememberForever($this->storyOrderedKey($storyId), function () use ($storyId): Collection {
            return Lexicon::query()
                ->where('story_id', $storyId)
                ->orderByDesc('priority')
                ->orderBy('word')
                ->get();
        });
    }

    /**
     * Chung + riêng truyện, đã sắp xếp thống nhất (ưu tiên giảm, từ tăng).
     *
     * @return Collection<int, Lexicon>
     */
    public function mergedOrderedForStory(int $storyId): Collection
    {
        $merged = $this->globalOrdered()->concat($this->forStoryOrdered($storyId));

        return $merged
            ->sort(static function (Lexicon $a, Lexicon $b): int {
                if ($a->priority !== $b->priority) {
                    return $b->priority <=> $a->priority;
                }

                return strcmp((string) $a->word, (string) $b->word);
            })
            ->values();
    }

    public function invalidate(): void
    {
        $this->repository()->forget(self::CACHE_GLOBAL);
        $ids = Lexicon::query()->whereNotNull('story_id')->distinct()->pluck('story_id');
        foreach ($ids as $id) {
            $this->repository()->forget($this->storyOrderedKey((int) $id));
        }
    }

    public function findById(int $id): ?Lexicon
    {
        return Lexicon::query()->find($id);
    }

    /**
     * GET /api/lexicons — chỉ lexicon chung (CMS / công cụ).
     *
     * @return LengthAwarePaginator<int, Lexicon>
     */
    public function paginateGlobalFromCache(Request $request, int $perPage): LengthAwarePaginator
    {
        $all = $this->globalOrdered();
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

    /**
     * GET /api/stories/{story}/lexicons — chung + riêng truyện.
     *
     * @return LengthAwarePaginator<int, Lexicon>
     */
    public function paginateMergedForStory(Request $request, int $storyId, int $perPage): LengthAwarePaginator
    {
        $all = $this->mergedOrderedForStory($storyId);
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
}

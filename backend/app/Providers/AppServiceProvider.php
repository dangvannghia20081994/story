<?php

namespace App\Providers;

use App\Models\Chapter;
use App\Models\Character;
use App\Models\CrawlerJob;
use App\Models\Story;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('chapter-audio-stream', function (Request $request): Limit {
            $perMinute = (int) config('chapter_audio.stream_throttle_per_minute', 480);

            return Limit::perMinute(max(30, $perMinute))->by($request->ip());
        });

        Route::bind('story', function (string $value) {
            $bySlug = Story::query()->where('slug', $value)->first();
            if ($bySlug !== null) {
                return $bySlug;
            }
            if ($value !== '' && ctype_digit($value)) {
                return Story::query()->whereKey((int) $value)->firstOrFail();
            }

            abort(404);
        });

        Route::bind('chapter', function (string $value, $route) {
            $story = $route->parameter('story');
            if ($story instanceof Story) {
                return Chapter::query()
                    ->where('story_id', $story->id)
                    ->whereKey($value)
                    ->firstOrFail();
            }

            return Chapter::query()->whereKey($value)->firstOrFail();
        });

        Route::bind('character', function (string $value, $route) {
            $story = $route->parameter('story');
            if ($story instanceof Story) {
                return Character::query()
                    ->where('story_id', $story->id)
                    ->whereKey($value)
                    ->firstOrFail();
            }

            return Character::query()->whereKey($value)->firstOrFail();
        });

        Route::bind('crawlerJob', function (string $value): CrawlerJob {
            if ($value === '' || ! ctype_digit($value)) {
                abort(404);
            }
            $job = CrawlerJob::query()->find((int) $value);
            if ($job === null) {
                abort(404, sprintf(
                    'Không có crawler job #%s (đã xóa hoặc DB mới sau migrate:fresh). '
                    .'Nếu worker Python vẫn gọi API: xóa message cũ trên Redis (list %s) hoặc đẩy job id còn tồn tại.',
                    $value,
                    (string) config('crawler.redis_queue_list', 'crawler:queue')
                ));
            }

            return $job;
        });
    }
}

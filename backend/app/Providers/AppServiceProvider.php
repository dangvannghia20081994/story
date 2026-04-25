<?php

namespace App\Providers;

use App\Models\Chapter;
use App\Models\Character;
use App\Models\Story;
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
    }
}

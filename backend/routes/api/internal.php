<?php

use App\Http\Controllers\Api\Internal\Crawler\CrawlerJobController;
use App\Http\Controllers\Api\Internal\Tts\ChapterAudioController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API nội bộ (crawler, worker-tts, …)
|--------------------------------------------------------------------------
| Được nạp qua routes/api.php trong nhóm middleware `api`, prefix `/api`.
| Controllers: App\Http\Controllers\Api\Internal\Crawler\*, Internal\Tts\*
*/

Route::prefix('internal/crawler')->middleware('crawler.internal')->group(function (): void {
    Route::get('/jobs/{crawlerJob}', [CrawlerJobController::class, 'show']);
    Route::patch('/jobs/{crawlerJob}', [CrawlerJobController::class, 'updateJob']);
    Route::post('/jobs/{crawlerJob}/chapters', [CrawlerJobController::class, 'storeChapter']);
    Route::patch('/jobs/{crawlerJob}/status', [CrawlerJobController::class, 'updateStatus']);
});

Route::prefix('internal/tts')->middleware('worker.tts.internal')->group(function (): void {
    Route::post('/chapters/{chapter}/audio', [ChapterAudioController::class, 'store']);
});

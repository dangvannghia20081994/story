<?php

use App\Http\Controllers\Api\ChapterController;
use App\Http\Controllers\Api\CharacterController;
use App\Http\Controllers\Api\Internal\CrawlerInternalController;
use App\Http\Controllers\Api\LexiconController;
use App\Http\Controllers\Api\StoryController;
use Illuminate\Support\Facades\Route;

Route::get('/stories', [StoryController::class, 'index']);
Route::post('/stories', [StoryController::class, 'store']);
Route::get('/stories/{story}', [StoryController::class, 'show']);
Route::patch('/stories/{story}', [StoryController::class, 'update']);
Route::delete('/stories/{story}', [StoryController::class, 'destroy']);

Route::get('/stories/{story}/chapters', [ChapterController::class, 'index']);
Route::post('/stories/{story}/chapters', [ChapterController::class, 'store']);
Route::get('/stories/{story}/chapters/{chapter}', [ChapterController::class, 'show']);
Route::patch('/stories/{story}/chapters/{chapter}', [ChapterController::class, 'update']);
Route::delete('/stories/{story}/chapters/{chapter}', [ChapterController::class, 'destroy']);
Route::get('/stories/{story}/characters', [CharacterController::class, 'index']);
Route::post('/stories/{story}/characters', [CharacterController::class, 'store']);
Route::get('/stories/{story}/characters/{character}', [CharacterController::class, 'show']);
Route::patch('/stories/{story}/characters/{character}', [CharacterController::class, 'update']);
Route::delete('/stories/{story}/characters/{character}', [CharacterController::class, 'destroy']);

Route::get('/lexicons', [LexiconController::class, 'index']);
Route::post('/lexicons', [LexiconController::class, 'store']);
Route::get('/lexicons/{lexicon}', [LexiconController::class, 'show']);
Route::patch('/lexicons/{lexicon}', [LexiconController::class, 'update']);
Route::delete('/lexicons/{lexicon}', [LexiconController::class, 'destroy']);

Route::prefix('internal/crawler')->middleware('crawler.internal')->group(function (): void {
    Route::get('/jobs/{crawlerJob}', [CrawlerInternalController::class, 'show']);
    Route::post('/jobs/{crawlerJob}/chapters', [CrawlerInternalController::class, 'storeChapter']);
    Route::patch('/jobs/{crawlerJob}/status', [CrawlerInternalController::class, 'updateStatus']);
});

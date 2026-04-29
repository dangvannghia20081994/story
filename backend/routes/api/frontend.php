<?php

use App\Http\Controllers\Api\Frontend\ChapterAudioStreamController;
use App\Http\Controllers\Api\Frontend\ChapterController;
use App\Http\Controllers\Api\Frontend\CharacterController;
use App\Http\Controllers\Api\Frontend\LexiconController;
use App\Http\Controllers\Api\Frontend\StoryController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API công khai (frontend / ứng dụng đọc truyện)
|--------------------------------------------------------------------------
| Được nạp qua routes/api.php trong nhóm middleware `api`, prefix `/api`.
| Controllers: App\Http\Controllers\Api\Frontend\*
*/

Route::get('/stories', [StoryController::class, 'index']);
Route::post('/stories', [StoryController::class, 'store']);
Route::get('/stories/{story}', [StoryController::class, 'show']);
Route::patch('/stories/{story}', [StoryController::class, 'update']);
Route::delete('/stories/{story}', [StoryController::class, 'destroy']);

Route::get('/stories/{story}/chapters', [ChapterController::class, 'index']);
Route::post('/stories/{story}/chapters', [ChapterController::class, 'store']);
Route::get('/stories/{story}/chapters/{chapter}', [ChapterController::class, 'show']);

Route::get('/stories/{story}/chapters/{chapter_slug}/audio/stream', [ChapterAudioStreamController::class, 'streamForStoryChapterSlug'])
    ->middleware(['signed', 'throttle:chapter-audio-stream'])
    ->name('api.stories.chapters.audio.stream');

Route::get('/chapters/{chapter}/audio/stream', [ChapterAudioStreamController::class, 'stream'])
    ->middleware(['signed', 'throttle:chapter-audio-stream'])
    ->name('api.chapters.audio.stream');
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

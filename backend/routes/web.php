<?php

use App\Http\Controllers\Cms\AuthController;
use App\Http\Controllers\Cms\ChapterController as CmsChapterController;
use App\Http\Controllers\Cms\CharacterController as CmsCharacterController;
use App\Http\Controllers\Cms\CrawlerJobController;
use App\Http\Controllers\Cms\DashboardController;
use App\Http\Controllers\Cms\LexiconController as CmsLexiconController;
use App\Http\Controllers\Cms\StoryController as CmsStoryController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/login', static fn () => redirect()->route('cms.login'))->name('login');

Route::prefix('admin')->name('cms.')->group(function (): void {
    Route::get('login', [AuthController::class, 'showLoginForm'])->name('login');
    Route::post('login', [AuthController::class, 'login']);

    Route::middleware('auth')->post('logout', [AuthController::class, 'logout'])->name('logout');

    Route::middleware(['auth', 'cms.admin'])->group(function (): void {
        Route::get('/', DashboardController::class)->name('dashboard');

        Route::get('stories/bulk', [CmsStoryController::class, 'createBulk'])->name('stories.bulk');
        Route::post('stories/bulk', [CmsStoryController::class, 'storeBulk'])->name('stories.bulk.store');

        Route::resource('stories', CmsStoryController::class)->except(['show']);
        Route::post('stories/{story}/reindex-chapters', [CmsStoryController::class, 'reindexChapters'])->name('stories.reindex-chapters');

        Route::get('stories/{story}/chapters/bulk', [CmsChapterController::class, 'createBulk'])->name('stories.chapters.bulk');
        Route::post('stories/{story}/chapters/bulk', [CmsChapterController::class, 'storeBulk'])->name('stories.chapters.bulk.store');
        Route::get('stories/{story}/chapters/strip-content', [CmsChapterController::class, 'stripContentForm'])->name('stories.chapters.strip-content');
        Route::post('stories/{story}/chapters/strip-content', [CmsChapterController::class, 'stripContentStore'])->name('stories.chapters.strip-content.store');
        Route::post('stories/{story}/chapters/{chapter}/enqueue-tts', [CmsChapterController::class, 'enqueueWorkerTts'])->name('stories.chapters.enqueue-tts');
        Route::resource('stories.chapters', CmsChapterController::class)->except(['show']);

        Route::get('stories/{story}/characters/bulk', [CmsCharacterController::class, 'createBulk'])->name('stories.characters.bulk');
        Route::post('stories/{story}/characters/bulk', [CmsCharacterController::class, 'storeBulk'])->name('stories.characters.bulk.store');
        Route::resource('stories.characters', CmsCharacterController::class)->except(['show']);

        Route::get('lexicons/bulk', [CmsLexiconController::class, 'createBulk'])->name('lexicons.bulk');
        Route::post('lexicons/bulk', [CmsLexiconController::class, 'storeBulk'])->name('lexicons.bulk.store');
        Route::get('lexicons/from-chapter', [CmsLexiconController::class, 'createFromChapter'])->name('lexicons.from-chapter');
        Route::post('lexicons/from-chapter/extract', [CmsLexiconController::class, 'extractFromChapter'])->name('lexicons.from-chapter.extract');
        Route::get('lexicons/from-chapter/stories/{story}/chapters', [CmsLexiconController::class, 'jsonChaptersForStory'])->name('lexicons.from-chapter.chapters');
        Route::get('lexicons/from-chapter/stories/{story}/chapters/{chapter}/content', [CmsLexiconController::class, 'jsonChapterContent'])->name('lexicons.from-chapter.content');
        Route::resource('lexicons', CmsLexiconController::class)->except(['show']);

        Route::get('crawler-jobs', [CrawlerJobController::class, 'index'])->name('crawler-jobs.index');
        Route::get('crawler-jobs/create', [CrawlerJobController::class, 'create'])->name('crawler-jobs.create');
        Route::post('crawler-jobs', [CrawlerJobController::class, 'store'])->name('crawler-jobs.store');
        Route::get('crawler-jobs/{crawlerJob}/edit', [CrawlerJobController::class, 'edit'])->name('crawler-jobs.edit');
        Route::put('crawler-jobs/{crawlerJob}', [CrawlerJobController::class, 'update'])->name('crawler-jobs.update');
        Route::post('crawler-jobs/{crawlerJob}/resend', [CrawlerJobController::class, 'resend'])->name('crawler-jobs.resend');
    });
});

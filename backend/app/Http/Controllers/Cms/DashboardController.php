<?php

namespace App\Http\Controllers\Cms;

use App\Http\Controllers\Controller;
use App\Models\Chapter;
use App\Models\CrawlerJob;
use App\Models\Lexicon;
use App\Models\Story;
use Illuminate\View\View;

class DashboardController extends Controller
{
    public function __invoke(): View
    {
        $crawlerStatusCounts = CrawlerJob::query()
            ->selectRaw('status, COUNT(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status')
            ->map(static fn ($count): int => (int) $count)
            ->all();

        $recentStories = Story::query()
            ->select(['id', 'title', 'slug', 'serial_status', 'updated_at'])
            ->withCount(['chapters', 'characters'])
            ->latest('updated_at')
            ->limit(5)
            ->get();

        $recentChapters = Chapter::query()
            ->with(['story:id,title,slug'])
            ->latest('updated_at')
            ->limit(5)
            ->get();

        return view('cms.dashboard', [
            'storyCount' => Story::query()->count(),
            'chapterCount' => Chapter::query()->count(),
            'lexiconCount' => Lexicon::query()->count(),
            'crawlerJobCount' => CrawlerJob::query()->count(),
            'crawlerStatusCounts' => $crawlerStatusCounts,
            'storiesWithoutChaptersCount' => Story::query()->doesntHave('chapters')->count(),
            'chapterAudioCount' => Chapter::query()->whereNotNull('audio_multiple_path')->count(),
            'chapterTtsQueuedCount' => Chapter::query()->whereNotNull('tts_enqueued_at')->whereNull('audio_multiple_path')->count(),
            'recentStories' => $recentStories,
            'recentChapters' => $recentChapters,
        ]);
    }
}

<?php

namespace App\Http\Controllers\Cms;

use App\Http\Controllers\Controller;
use App\Models\Chapter;
use App\Models\Lexicon;
use App\Models\Story;
use Illuminate\View\View;

class DashboardController extends Controller
{
    public function __invoke(): View
    {
        return view('cms.dashboard', [
            'storyCount' => Story::query()->count(),
            'chapterCount' => Chapter::query()->count(),
            'lexiconCount' => Lexicon::query()->count(),
        ]);
    }
}

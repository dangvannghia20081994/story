<?php

namespace App\Http\Controllers\Cms;

use App\Http\Controllers\Controller;
use App\Http\Requests\Cms\StoreBulkStoriesRequest;
use App\Http\Requests\Cms\StoreStoryRequest;
use App\Http\Requests\Cms\UpdateStoryRequest;
use App\Models\Chapter;
use App\Models\Story;
use App\Services\StoryService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

/** Giao diện Blade /admin/stories. Danh sách JSON: {@see StoryApiController}. */
class StoryController extends Controller
{
    public function __construct(
        private readonly StoryService $storyService,
    ) {}

    public function index(Request $request): View
    {
        $q = trim((string) $request->query('q', ''));
        $genre = $this->storyService->normalizeCmsGenreFilter($request->query('genre'));

        $stories = $this->storyService
            ->paginateCmsStoryList($q, $genre, 20)
            ->withQueryString();

        return view('cms.stories.index', compact('stories', 'q', 'genre'));
    }

    public function create(): View
    {
        return view('cms.stories.create');
    }

    public function createBulk(): View
    {
        return view('cms.stories.bulk');
    }

    public function store(StoreStoryRequest $request): RedirectResponse
    {
        $this->storyService->createFromCmsValidated($request->validated());

        return redirect()->route('cms.stories.index')->with('status', 'Đã tạo truyện.');
    }

    public function storeBulk(StoreBulkStoriesRequest $request): RedirectResponse
    {
        $rows = $request->validated('stories');

        DB::transaction(function () use ($rows): void {
            foreach ($rows as $row) {
                $slug = $row['slug'] ?? null;
                if ($slug === '') {
                    $slug = null;
                }
                Story::query()->create([
                    'title' => $row['title'],
                    'slug' => $slug,
                    'description' => $row['description'] ?? null,
                    'genres' => $row['genres'] ?? [],
                    'serial_status' => $row['serial_status'] ?? 'ongoing',
                ]);
            }
        });

        $n = count($rows);

        return redirect()->route('cms.stories.index')->with('status', "Đã tạo {$n} truyện.");
    }

    public function edit(Story $story): View
    {
        return view('cms.stories.edit', compact('story'));
    }

    public function update(UpdateStoryRequest $request, Story $story): RedirectResponse
    {
        $this->storyService->updateFromCmsValidated($story, $request->validated());

        return redirect()->route('cms.stories.index')->with('status', 'Đã cập nhật truyện.');
    }

    public function destroy(Story $story): RedirectResponse
    {
        $story->delete();

        return redirect()->route('cms.stories.index')->with('status', 'Đã xóa truyện.');
    }

    public function reindexChapters(Story $story): RedirectResponse
    {
        Chapter::reindexChapterNumbersFromTitlesForStory($story);

        return redirect()
            ->back()
            ->with('status', 'Đánh lại thứ tự các chương');
    }
}

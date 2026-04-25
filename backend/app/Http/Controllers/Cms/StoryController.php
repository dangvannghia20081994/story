<?php

namespace App\Http\Controllers\Cms;

use App\Http\Controllers\Controller;
use App\Http\Requests\Cms\StoreStoryRequest;
use App\Http\Requests\Cms\UpdateStoryRequest;
use App\Models\Chapter;
use App\Models\Story;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\View\View;

class StoryController extends Controller
{
    public function index(): View
    {
        $stories = Story::query()
            ->withCount(['chapters', 'characters'])
            ->orderByDesc('id')
            ->paginate(20)
            ->withQueryString();

        return view('cms.stories.index', compact('stories'));
    }

    public function create(): View
    {
        return view('cms.stories.create');
    }

    public function store(StoreStoryRequest $request): RedirectResponse
    {
        $data = $request->validated();

        DB::transaction(function () use ($data): void {
            $slug = $data['slug'] ?? null;
            if ($slug === '') {
                $slug = null;
            }
            $story = Story::query()->create([
                'title' => $data['title'],
                'slug' => $slug,
                'description' => $data['description'] ?? null,
                'genre' => $data['genre'] ?? null,
            ]);

            if (! empty($data['first_chapter_title']) && ! empty($data['first_chapter_content'])) {
                $story->chapters()->create([
                    'title' => $data['first_chapter_title'],
                    'content' => $data['first_chapter_content'],
                    'status' => Chapter::STATUS_PENDING,
                ]);
            }
        });

        return redirect()->route('cms.stories.index')->with('status', 'Đã tạo truyện.');
    }

    public function edit(Story $story): View
    {
        return view('cms.stories.edit', compact('story'));
    }

    public function update(UpdateStoryRequest $request, Story $story): RedirectResponse
    {
        $data = $request->validated();

        if (array_key_exists('slug', $data) && ($data['slug'] === null || $data['slug'] === '')) {
            $data['slug'] = Str::slug($story->title).'-'.$story->id;
        }

        $story->fill($data)->save();

        return redirect()->route('cms.stories.index')->with('status', 'Đã cập nhật truyện.');
    }

    public function destroy(Story $story): RedirectResponse
    {
        $story->delete();

        return redirect()->route('cms.stories.index')->with('status', 'Đã xóa truyện.');
    }
}

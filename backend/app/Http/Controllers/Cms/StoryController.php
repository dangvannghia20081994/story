<?php

namespace App\Http\Controllers\Cms;

use App\Http\Controllers\Controller;
use App\Http\Requests\Cms\StoreBulkStoriesRequest;
use App\Http\Requests\Cms\StoreStoryRequest;
use App\Http\Requests\Cms\UpdateStoryRequest;
use App\Models\Story;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\View\View;

class StoryController extends Controller
{
    public function index(Request $request): View
    {
        $q = trim((string) $request->query('q', ''));

        $genreParam = $request->query('genre');
        $genre = '';
        if (is_string($genreParam) && $genreParam !== '') {
            $g = trim($genreParam);
            if (in_array($g, Story::GENRES, true)) {
                $genre = $g;
            }
        }

        $stories = Story::query()
            ->withCount(['chapters', 'characters'])
            ->when(
                $q !== '',
                static function ($query) use ($q) {
                    $like = '%'.addcslashes($q, '%_\\').'%';
                    $query->where('title', 'like', $like);
                }
            )
            ->when(
                $genre !== '',
                static fn ($query) => $query->where('genre', $genre)
            )
            ->orderByDesc('id')
            ->paginate(20)
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
                'serial_status' => $data['serial_status'] ?? 'ongoing',
            ]);

            if (! empty($data['first_chapter_title']) && ! empty($data['first_chapter_content'])) {
                $story->chapters()->create([
                    'title' => $data['first_chapter_title'],
                    'content' => $data['first_chapter_content'],
                ]);
            }
        });

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
                    'genre' => $row['genre'] ?? null,
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

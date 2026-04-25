<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Chapter;
use App\Models\Story;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class StoryController extends Controller
{
    public function index(): JsonResponse
    {
        $paginator = Story::query()
            ->withCount('chapters')
            ->orderByDesc('id')
            ->paginate(20);

        return response()->json($paginator);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', Rule::unique('stories', 'slug')],
            'description' => ['nullable', 'string', 'max:10000'],
            'genre' => ['nullable', 'string', Rule::in(Story::GENRES)],
            'first_chapter' => ['nullable', 'array'],
            'first_chapter.title' => ['required_with:first_chapter', 'string', 'max:255'],
            'first_chapter.content' => ['required_with:first_chapter', 'string'],
        ]);

        $story = DB::transaction(function () use ($data) {
            $slug = $data['slug'] ?? null;
            $story = Story::query()->create([
                'title' => $data['title'],
                'slug' => $slug,
                'description' => $data['description'] ?? null,
                'genre' => $data['genre'] ?? null,
            ]);

            if (! empty($data['first_chapter'])) {
                $story->chapters()->create([
                    'title' => $data['first_chapter']['title'],
                    'content' => $data['first_chapter']['content'],
                    'status' => Chapter::STATUS_PENDING,
                ]);
            }

            return $story->fresh();
        });

        return response()->json($story->loadCount('chapters'), 201);
    }

    public function show(Story $story): JsonResponse
    {
        $story->load(['chapters' => fn ($q) => $q->orderBy('id')]);
        $story->loadCount('characters');

        $chapters = $story->chapters->map(fn (Chapter $c) => array_merge($c->toArray(), [
            'audio_url' => $c->publicAudioUrl(),
        ]));

        return response()->json([
            'data' => array_merge($story->toArray(), [
                'chapters' => $chapters,
            ]),
        ]);
    }

    public function update(Request $request, Story $story): JsonResponse
    {
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', Rule::unique('stories', 'slug')->ignore($story->id)],
            'description' => ['nullable', 'string', 'max:10000'],
            'genre' => ['nullable', 'string', Rule::in(Story::GENRES)],
        ]);

        if (array_key_exists('slug', $data) && ($data['slug'] === null || $data['slug'] === '')) {
            $data['slug'] = Str::slug($story->title).'-'.$story->id;
        }

        $story->fill($data)->save();

        return response()->json(['data' => $story->fresh()->loadCount('chapters')]);
    }

    public function destroy(Story $story): JsonResponse
    {
        $story->delete();

        return response()->json(null, 204);
    }
}

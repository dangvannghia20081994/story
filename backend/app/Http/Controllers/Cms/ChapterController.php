<?php

namespace App\Http\Controllers\Cms;

use App\Http\Controllers\Api\ChapterController as ApiChapterController;
use App\Http\Controllers\Controller;
use App\Http\Requests\Cms\StoreChapterRequest;
use App\Http\Requests\Cms\UpdateChapterRequest;
use App\Models\Chapter;
use App\Models\Story;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class ChapterController extends Controller
{
    public function index(Story $story): View
    {
        $chapters = $story->chapters()
            ->orderBy('id')
            ->paginate(30)
            ->withQueryString();

        return view('cms.chapters.index', compact('story', 'chapters'));
    }

    public function create(Story $story): View
    {
        return view('cms.chapters.create', compact('story'));
    }

    public function store(StoreChapterRequest $request, Story $story): RedirectResponse
    {
        $data = $request->validated();

        $story->chapters()->create([
            'title' => $data['title'],
            'content' => $data['content'],
            'status' => $data['status'] ?? Chapter::STATUS_PENDING,
        ]);

        return redirect()->route('cms.stories.chapters.index', $story)->with('status', 'Đã tạo chương.');
    }

    public function edit(Story $story, Chapter $chapter): View
    {
        $this->assertBelongs($story, $chapter);

        return view('cms.chapters.edit', compact('story', 'chapter'));
    }

    public function update(UpdateChapterRequest $request, Story $story, Chapter $chapter): RedirectResponse
    {
        $this->assertBelongs($story, $chapter);

        $chapter->fill($request->validated())->save();

        return redirect()->route('cms.stories.chapters.index', $story)->with('status', 'Đã cập nhật chương.');
    }

    public function destroy(Story $story, Chapter $chapter): RedirectResponse
    {
        $this->assertBelongs($story, $chapter);
        $chapter->delete();

        return redirect()->route('cms.stories.chapters.index', $story)->with('status', 'Đã xóa chương.');
    }

    public function queueTts(Request $request, Story $story, Chapter $chapter): RedirectResponse
    {
        $this->assertBelongs($story, $chapter);

        /** @var ApiChapterController $api */
        $api = app(ApiChapterController::class);
        $response = $api->queueTts($request, $story, $chapter);

        if ($response->getStatusCode() === 202) {
            return redirect()->back()->with('status', 'Đã xếp hàng TTS.');
        }

        $payload = json_decode($response->getContent(), true);

        return redirect()->back()->withErrors([
            'queue' => is_array($payload) && isset($payload['message']) ? (string) $payload['message'] : 'Không thể xếp hàng TTS.',
        ]);
    }

    private function assertBelongs(Story $story, Chapter $chapter): void
    {
        if ((int) $chapter->story_id !== (int) $story->id) {
            abort(404);
        }
    }
}

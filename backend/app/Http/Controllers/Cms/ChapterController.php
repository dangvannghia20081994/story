<?php

namespace App\Http\Controllers\Cms;

use App\Http\Controllers\Controller;
use App\Http\Requests\Cms\StoreBulkChaptersRequest;
use App\Http\Requests\Cms\StoreChapterRequest;
use App\Http\Requests\Cms\UpdateChapterRequest;
use App\Models\Chapter;
use App\Models\Story;
use App\Services\WorkerTtsQueue;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class ChapterController extends Controller
{
    public function index(Story $story): View
    {
        $chapters = $story->chapters()
            ->paginate(30)
            ->withQueryString();

        return view('cms.chapters.index', compact('story', 'chapters'));
    }

    public function create(Story $story): View
    {
        return view('cms.chapters.create', compact('story'));
    }

    public function createBulk(Story $story): View
    {
        return view('cms.chapters.bulk', compact('story'));
    }

    public function store(StoreChapterRequest $request, Story $story): RedirectResponse
    {
        $data = $request->validated();

        $outcome = Chapter::createOrUpdateByTitleForStory(
            $story,
            $data['title'],
            $data['content'],
            $data['chapter_number'] ?? null,
        );
        $status = $outcome['created']
            ? 'Đã tạo chương.'
            : 'Chương cùng tiêu đề đã tồn tại — đã cập nhật nội dung.';

        return redirect()->route('cms.stories.chapters.index', $story)->with('status', $status);
    }

    public function storeBulk(StoreBulkChaptersRequest $request, Story $story): RedirectResponse
    {
        $rows = $request->validated('chapters');

        DB::transaction(function () use ($rows, $story): void {
            foreach ($rows as $row) {
                Chapter::createOrUpdateByTitleForStory($story, $row['title'], $row['content']);
            }
        });

        $n = count($rows);

        return redirect()->route('cms.stories.chapters.index', $story)->with('status', "Đã xử lý {$n} dòng (trùng tiêu đề thì cập nhật nội dung).");
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

    public function enqueueWorkerTts(Request $request, Story $story, Chapter $chapter): RedirectResponse|JsonResponse
    {
        $this->assertBelongs($story, $chapter);

        $wantsJson = $request->expectsJson();

        if (! $chapter->canEnqueueWorkerTts()) {
            $msg = 'Không thể đưa chương vào hàng TTS: nội dung chương trống (sau khi bỏ HTML).';
            if ($wantsJson) {
                return response()->json(['message' => $msg], 422);
            }

            return back()->withErrors(['tts' => $msg]);
        }

        try {
            WorkerTtsQueue::push($chapter);
        } catch (\Throwable $e) {
            report($e);
            $msg = 'Không đẩy được job lên Redis (kiểm tra REDIS_* và worker worker_redis.py / ./run-dev.sh --with-worker).';
            if ($wantsJson) {
                return response()->json(['message' => $msg], 503);
            }

            return back()->withErrors(['tts' => $msg]);
        }

        $chapter->refresh();

        if ($wantsJson) {
            $badgeTitle = null;
            if ($chapter->cmsTtsStatusKey() === 'queued' && $chapter->tts_enqueued_at !== null) {
                $badgeTitle = 'Đã đẩy hàng lúc '.$chapter->tts_enqueued_at->timezone(config('app.timezone'))->format('d/m/Y H:i');
            }

            return response()->json([
                'message' => 'Đã đưa chương «'.$chapter->title.'» vào hàng TTS (Redis).',
                'tts' => [
                    'label' => $chapter->cmsTtsStatusLabel(),
                    'badge_class' => $chapter->cmsTtsBadgeClass(),
                    'title' => $badgeTitle,
                ],
            ]);
        }

        return back()->with('status', 'Đã đưa chương «'.$chapter->title.'» vào hàng TTS (Redis).');
    }

    private function assertBelongs(Story $story, Chapter $chapter): void
    {
        if ((int) $chapter->story_id !== (int) $story->id) {
            abort(404);
        }
    }
}

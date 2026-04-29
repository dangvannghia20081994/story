<?php

namespace App\Http\Controllers\Cms;

use App\Http\Controllers\Controller;
use App\Http\Requests\Cms\StoreBulkChaptersRequest;
use App\Http\Requests\Cms\StoreChapterRequest;
use App\Http\Requests\Cms\StripChapterContentRequest;
use App\Http\Requests\Cms\UpdateChapterRequest;
use App\Models\Chapter;
use App\Models\Story;
use App\Services\ChapterService;
use App\Services\WorkerTtsQueue;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class ChapterController extends Controller
{
    public function __construct(
        private readonly ChapterService $chapterService,
    ) {}

    public function index(Request $request, Story $story): View
    {
        $q = trim((string) $request->query('q', ''));
        $tts = trim((string) $request->query('tts', ''));
        $audio = trim((string) $request->query('audio', ''));
        $sort = trim((string) $request->query('sort', 'read_asc'));

        $allowedTts = ['', 'ready', 'queued', 'pending', 'no_text'];
        if (! in_array($tts, $allowedTts, true)) {
            $tts = '';
        }
        $allowedAudio = ['', '1', '0'];
        if (! in_array($audio, $allowedAudio, true)) {
            $audio = '';
        }
        $allowedSort = ['read_asc', 'read_desc', 'updated_desc', 'updated_asc', 'id_desc', 'id_asc'];
        if (! in_array($sort, $allowedSort, true)) {
            $sort = 'read_asc';
        }

        $query = $story->chapters()->reorder();

        if ($q !== '') {
            $like = '%'.addcslashes($q, '%_\\').'%';
            $query->where('title', 'like', $like);
        }

        if ($audio === '1') {
            $query->whereNotNull('audio_path')->where('audio_path', '!=', '');
        } elseif ($audio === '0') {
            $query->where(function ($sub): void {
                $sub->whereNull('audio_path')->orWhere('audio_path', '');
            });
        }

        if ($tts === 'ready') {
            $query->whereNotNull('audio_path')->where('audio_path', '!=', '');
        } elseif ($tts === 'queued') {
            $query->where(function ($sub): void {
                $sub->whereNull('audio_path')->orWhere('audio_path', '');
            })->whereNotNull('tts_enqueued_at');
        } elseif ($tts === 'pending') {
            $query->where(function ($sub): void {
                $sub->whereNull('audio_path')->orWhere('audio_path', '');
            })->whereNull('tts_enqueued_at')
                ->whereRaw('LENGTH(TRIM(COALESCE(content, ?))) > 0', ['']);
        } elseif ($tts === 'no_text') {
            $query->where(function ($sub): void {
                $sub->whereNull('audio_path')->orWhere('audio_path', '');
            })->where(function ($sub): void {
                $sub->whereNull('content')
                    ->orWhereRaw('LENGTH(TRIM(COALESCE(content, ?))) = 0', ['']);
            });
        }

        match ($sort) {
            'read_desc' => $query->chapterNumberSort('desc'),
            'updated_desc' => $query->orderByDesc('updated_at')->orderByDesc('id'),
            'updated_asc' => $query->orderBy('updated_at')->orderBy('id'),
            'id_desc' => $query->orderByDesc('id'),
            'id_asc' => $query->orderBy('id'),
            default => $query->chapterNumberSort('asc'),
        };

        $chapters = $query->paginate(30)->withQueryString();

        return view('cms.chapters.index', compact('story', 'chapters', 'q', 'tts', 'audio', 'sort'));
    }

    public function create(Story $story): View
    {
        return view('cms.chapters.create', compact('story'));
    }

    public function createBulk(Story $story): View
    {
        return view('cms.chapters.bulk', compact('story'));
    }

    public function stripContentForm(Story $story): View
    {
        return view('cms.chapters.strip-content', compact('story'));
    }

    public function stripContentStore(StripChapterContentRequest $request, Story $story): RedirectResponse
    {
        /** @var list<string> $phrases */
        $phrases = $request->validated('phrases');

        $chaptersUpdated = 0;
        $totalOccurrencesRemoved = 0;

        $story->chapters()
            ->select(['id', 'content'])
            ->orderBy('id')
            ->chunkById(50, function ($chapters) use ($phrases, &$chaptersUpdated, &$totalOccurrencesRemoved): void {
                foreach ($chapters as $chapter) {
                    $original = (string) $chapter->content;
                    $working = $original;
                    $removedHere = 0;

                    foreach ($phrases as $phrase) {
                        $removedHere += substr_count($working, $phrase);
                        $working = str_replace($phrase, '', $working);
                    }

                    $newContent = Story::sanitizeChapterContent($working);

                    if ($newContent !== $original) {
                        $chapter->content = $newContent;
                        $chapter->save();
                        $chaptersUpdated++;
                        $totalOccurrencesRemoved += $removedHere;
                    }
                }
            });

        $status = $chaptersUpdated === 0
            ? 'Không có chương nào thay đổi (không tìm thấy chuỗi đã nhập hoặc nội dung sau xử lý trùng với hiện tại).'
            : "Đã cập nhật {$chaptersUpdated} chương; đã gỡ {$totalOccurrencesRemoved} lần xuất hiện chuỗi (trước bước chuẩn hóa nội dung).";

        return redirect()->route('cms.stories.chapters.index', $story)->with('status', $status);
    }

    public function store(StoreChapterRequest $request, Story $story): RedirectResponse
    {
        $data = $request->validated();

        $outcome = $this->chapterService->createOrUpdateByTitle($story, [
            'title' => $data['title'],
            'content' => $data['content'],
            'chapter_number' => $data['chapter_number'] ?? null,
        ]);
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
                $this->chapterService->createOrUpdateByTitle($story, [
                    'title' => $row['title'],
                    'content' => $row['content'],
                ]);
            }
        });

        $n = count($rows);

        return redirect()->route('cms.stories.chapters.index', $story)->with('status', "Đã xử lý {$n} dòng (trùng tiêu đề thì cập nhật nội dung).");
    }

    public function edit(Story $story, Chapter $chapter): View
    {
        $this->chapterService->assertBelongsToStory($story, $chapter);

        return view('cms.chapters.edit', compact('story', 'chapter'));
    }

    public function update(UpdateChapterRequest $request, Story $story, Chapter $chapter): RedirectResponse
    {
        $this->chapterService->assertBelongsToStory($story, $chapter);

        $chapter->fill($request->validated())->save();

        return redirect()->route('cms.stories.chapters.index', $story)->with('status', 'Đã cập nhật chương.');
    }

    public function destroy(Story $story, Chapter $chapter): RedirectResponse
    {
        $this->chapterService->assertBelongsToStory($story, $chapter);
        $chapter->delete();

        return redirect()->route('cms.stories.chapters.index', $story)->with('status', 'Đã xóa chương.');
    }

    public function enqueueWorkerTts(Request $request, Story $story, Chapter $chapter): RedirectResponse|JsonResponse
    {
        $this->chapterService->assertBelongsToStory($story, $chapter);

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
}

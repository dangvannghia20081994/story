<?php

namespace App\Http\Controllers\Cms;

use App\Http\Controllers\Controller;
use App\Http\Requests\Cms\StoreBulkChaptersRequest;
use App\Http\Requests\Cms\StoreChapterRequest;
use App\Http\Requests\Cms\ReplaceChapterContentRequest;
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
        $analyzed = trim((string) $request->query('analyzed', ''));
        $sort = trim((string) $request->query('sort', 'read_asc'));

        $allowedTts = ['', 'ready', 'queued', 'pending', 'no_text'];
        if (! in_array($tts, $allowedTts, true)) {
            $tts = '';
        }
        $allowedAudio = ['', '1', '0'];
        if (! in_array($audio, $allowedAudio, true)) {
            $audio = '';
        }
        $allowedAnalyzed = ['', '1', '0'];
        if (! in_array($analyzed, $allowedAnalyzed, true)) {
            $analyzed = '';
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

        // Màn này chỉ xét audio_single_path (pipeline TTS 1 giọng hiện tại).
        // audio_multiple_path để dành phase "đa vai" sau.
        $hasAudio = function ($sub): void {
            $sub->whereNotNull('audio_single_path')->where('audio_single_path', '!=', '');
        };
        $noAudio = function ($sub): void {
            $sub->whereNull('audio_single_path')->orWhere('audio_single_path', '');
        };

        if ($audio === '1') {
            $query->where($hasAudio);
        } elseif ($audio === '0') {
            $query->where($noAudio);
        }

        if ($analyzed === '1') {
            $query->whereNotNull('content_segments')
                ->whereRaw("content_segments::text != '[]'");
        } elseif ($analyzed === '0') {
            $query->where(function ($sub): void {
                $sub->whereNull('content_segments')
                    ->orWhereRaw("content_segments::text = '[]'");
            });
        }

        if ($tts === 'ready') {
            $query->where($hasAudio);
        } elseif ($tts === 'queued') {
            $query->where($noAudio)->whereNotNull('tts_enqueued_at');
        } elseif ($tts === 'pending') {
            $query->where($noAudio)->whereNull('tts_enqueued_at')
                ->whereRaw('LENGTH(TRIM(COALESCE(content, ?))) > 0', ['']);
        } elseif ($tts === 'no_text') {
            $query->where($noAudio)->where(function ($sub): void {
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

        return view('cms.chapters.index', compact('story', 'chapters', 'q', 'tts', 'audio', 'analyzed', 'sort'));
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

    public function replaceContentForm(Story $story): View
    {
        return view('cms.chapters.replace-content', compact('story'));
    }

    public function replaceContentStore(ReplaceChapterContentRequest $request, Story $story): RedirectResponse
    {
        /** @var list<array{search: string, replacement: string}> $pairs */
        $pairs = $request->replacePairs();

        $chaptersUpdated = 0;
        $totalOccurrencesReplaced = 0;

        $story->chapters()
            ->select(['id', 'content', 'content_segments'])
            ->orderBy('id')
            ->chunkById(50, function ($chapters) use ($pairs, &$chaptersUpdated, &$totalOccurrencesReplaced): void {
                foreach ($chapters as $chapter) {
                    $original = (string) $chapter->content;
                    $working = $original;
                    $replacedHere = 0;

                    foreach ($pairs as $pair) {
                        $count = substr_count($working, $pair['search']);
                        if ($count > 0) {
                            $replacedHere += $count;
                            $working = str_replace($pair['search'], $pair['replacement'], $working);
                        }
                    }

                    $newContent = Story::sanitizeChapterContent($working);

                    // Replace trong content_segments (array of {speaker, text}) với cùng rules.
                    $segments = $chapter->content_segments;
                    $newSegments = null;
                    if (is_array($segments) && count($segments) > 0) {
                        $newSegments = array_map(function (mixed $seg) use ($pairs): mixed {
                            if (! is_array($seg) || ! array_key_exists('text', $seg)) {
                                return $seg;
                            }
                            $text = (string) $seg['text'];
                            foreach ($pairs as $pair) {
                                $text = str_replace($pair['search'], $pair['replacement'], $text);
                            }
                            $seg['text'] = $text;

                            return $seg;
                        }, $segments);
                    }

                    $dirty = $newContent !== $original
                        || ($newSegments !== null && $newSegments !== $segments);

                    if ($dirty) {
                        $chapter->content = $newContent;
                        if ($newSegments !== null) {
                            $chapter->content_segments = $newSegments;
                        }
                        $chapter->save();
                        $chaptersUpdated++;
                        $totalOccurrencesReplaced += $replacedHere;
                    }
                }
            });

        $status = $chaptersUpdated === 0
            ? 'Không có chương nào thay đổi (không tìm thấy chuỗi tìm hoặc nội dung sau xử lý trùng với hiện tại).'
            : "Đã cập nhật {$chaptersUpdated} chương; đã thay {$totalOccurrencesReplaced} lần xuất hiện (trước bước chuẩn hóa nội dung).";

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

        $nav = Chapter::readNavigationFor($story, (int) $chapter->getKey());
        $prevChapter = $nav['prev'] ?? null;
        $nextChapter = $nav['next'] ?? null;

        return view('cms.chapters.edit', compact('story', 'chapter', 'prevChapter', 'nextChapter'));
    }

    public function update(UpdateChapterRequest $request, Story $story, Chapter $chapter): RedirectResponse
    {
        $this->chapterService->assertBelongsToStory($story, $chapter);

        $chapter->fill($request->validated())->save();

        return redirect()->route('cms.stories.chapters.index', $story)->with('status', 'Đã cập nhật chương.');
    }

    public function updateSpeakers(Request $request, Story $story, Chapter $chapter): RedirectResponse
    {
        $this->chapterService->assertBelongsToStory($story, $chapter);

        $segments = $chapter->content_segments;
        if (empty($segments)) {
            return back()->withErrors(['speakers' => 'Chương này chưa có content_segments.']);
        }

        $segmentCount = count($segments);

        // Danh sách speaker hợp lệ: narration, _unknown, + tên nhân vật của truyện
        $characters = $story->characters()->pluck('id', 'name')->toArray();
        $validSpeakers = array_merge(['narration', '_unknown'], array_keys($characters));

        $validated = $request->validate([
            'speakers' => ['required', 'array', "size:{$segmentCount}"],
            'speakers.*' => ['required', 'string', 'in:'.implode(',', $validSpeakers)],
        ]);

        $newSegments = [];
        foreach ($segments as $i => $seg) {
            $speaker = $validated['speakers'][$i];
            $charId = null;
            if ($speaker !== 'narration' && $speaker !== '_unknown') {
                $charId = $characters[$speaker] ?? null;
            }

            $newSegments[] = [
                'speaker' => $speaker,
                'text' => $seg['text'],
                'character_id' => $charId,
            ];
        }

        $chapter->content_segments = $newSegments;
        $chapter->save();

        return back()->with('status', "Đã cập nhật speaker cho {$segmentCount} segment.");
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

        $voiceId = trim((string) $request->input('voice_id', 'capcut:BV074_streaming'));
        if ($voiceId === '' || ! preg_match('/^(\d+|edge:[A-Za-z0-9_-]+|capcut:[A-Za-z0-9_]+)$/', $voiceId)) {
            $voiceId = 'capcut:BV074_streaming';
        }

        try {
            WorkerTtsQueue::push($chapter, null, $voiceId);
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
            $badgeTitle = $chapter->tts_enqueued_at !== null
                ? 'Đã đẩy hàng lúc '.$chapter->tts_enqueued_at->timezone(config('app.timezone'))->format('d/m/Y H:i')
                : null;

            // Vừa đẩy job → luôn báo "Đang xử lý" (kể cả khi đang ghi đè audio cũ).
            return response()->json([
                'message' => 'Đã đưa chương «'.$chapter->title.'» vào hàng TTS (Redis).',
                'tts' => [
                    'label' => 'Đang xử lý',
                    'badge_class' => 'cms-badge--job-processing',
                    'title' => $badgeTitle,
                ],
            ]);
        }

        return back()->with('status', 'Đã đưa chương «'.$chapter->title.'» vào hàng TTS (Redis).');
    }
}

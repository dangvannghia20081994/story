<?php

namespace App\Http\Controllers\Api\Internal\Crawler;

use App\Http\Controllers\Controller;
use App\Models\CrawlerJob;
use App\Models\Story;
use App\Services\CrawlerJobService;
use Dedoc\Scramble\Attributes\Group;
use Dedoc\Scramble\Attributes\HeaderParameter;
use Dedoc\Scramble\Attributes\Response;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[Group('Internal · Crawler', weight: 5)]
#[HeaderParameter('X-Crawler-Token', 'Token khớp biến môi trường CRAWLER_INTERNAL_TOKEN.', required: true, type: 'string')]
class CrawlerJobController extends Controller
{
    public function __construct(
        private readonly CrawlerJobService $crawlerJobService,
    ) {}

    public function show(CrawlerJob $crawlerJob): JsonResponse
    {
        $chapterStart = max(1, (int) ($crawlerJob->chapter_start ?? 1));

        return response()->json([
            'data' => [
                'id' => $crawlerJob->id,
                'source_url' => $crawlerJob->source_url,
                'chapter_links_selector' => $crawlerJob->chapter_links_selector,
                'chapter_list_next_page_selector' => $crawlerJob->chapter_list_next_page_selector,
                'chapter_title_selector' => $crawlerJob->chapter_title_selector,
                'chapter_content_selector' => $crawlerJob->chapter_content_selector,
                'story_id' => $crawlerJob->story_id,
                'new_story_title' => $crawlerJob->new_story_title,
                'story_title_selector' => $crawlerJob->story_title_selector,
                'chapter_start' => $chapterStart,
                'max_chapters' => $crawlerJob->max_chapters,
                'delay_seconds' => $crawlerJob->delay_seconds,
                'chapter_fetch_concurrency' => $crawlerJob->chapter_fetch_concurrency,
                'status' => $crawlerJob->status,
                'chapters_imported' => $crawlerJob->chapters_imported,
            ],
        ]);
    }

    #[Response(201, description: 'Chương mới được ghi nhận (tăng chapters_imported nếu tạo mới).', type: 'array<string, mixed>')]
    #[Response(200, description: 'Chương trùng tiêu đề — chỉ cập nhật nội dung, không tăng chapters_imported.', type: 'array<string, mixed>')]
    public function storeChapter(Request $request, CrawlerJob $crawlerJob): JsonResponse
    {
        if (in_array($crawlerJob->status, [CrawlerJob::STATUS_COMPLETED, CrawlerJob::STATUS_FAILED], true)) {
            abort(422, 'Job is finished.');
        }

        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'content' => ['required', 'string'],
        ]);

        $content = Story::sanitizeChapterContent($data['content']);

        $outcome = $this->crawlerJobService->storeChapter($crawlerJob, $data['title'], $content);

        $crawlerJob->refresh();

        $chapter = $outcome['chapter'];
        $created = $outcome['created'];

        return response()->json([
            'data' => [
                'chapters_imported' => $crawlerJob->chapters_imported,
                'story_id' => $crawlerJob->story_id,
                'chapter_id' => $chapter?->id,
                'chapter_created' => $created,
            ],
        ], $created ? 201 : 200);
    }

    /**
     * Worker gọi trước chương đầu: ghi tiêu đề truyện mới lấy từ trang nguồn (selector).
     */
    public function updateJob(Request $request, CrawlerJob $crawlerJob): JsonResponse
    {
        if (in_array($crawlerJob->status, [CrawlerJob::STATUS_COMPLETED, CrawlerJob::STATUS_FAILED], true)) {
            abort(422, 'Job is finished.');
        }

        $data = $request->validate([
            'new_story_title' => ['required', 'string', 'max:255'],
        ]);

        if ($crawlerJob->story_id !== null) {
            abort(422, 'Truyện đã gán — không cập nhật tiêu đề qua job.');
        }

        if (trim((string) ($crawlerJob->new_story_title ?? '')) !== '') {
            abort(422, 'Tiêu đề truyện đã có trên job.');
        }

        $crawlerJob->update(['new_story_title' => $data['new_story_title']]);

        return response()->json([
            'data' => [
                'new_story_title' => $crawlerJob->new_story_title,
            ],
        ]);
    }

    public function updateStatus(Request $request, CrawlerJob $crawlerJob): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'string', 'in:processing,completed,failed'],
            'message' => ['nullable', 'string', 'max:10000'],
        ]);

        $crawlerJob->status = $data['status'];
        if ($data['status'] === CrawlerJob::STATUS_FAILED) {
            $crawlerJob->last_error = $data['message'] ?? 'Unknown error';
        } elseif ($data['status'] === CrawlerJob::STATUS_COMPLETED) {
            $crawlerJob->last_error = null;
        } elseif ($data['status'] === CrawlerJob::STATUS_PROCESSING) {
            $crawlerJob->last_error = null;
        }

        $crawlerJob->save();

        return response()->json([
            'data' => [
                'status' => $crawlerJob->status,
                'last_error' => $crawlerJob->last_error,
            ],
        ]);
    }
}

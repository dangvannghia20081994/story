<?php

namespace App\Http\Controllers\Api\Frontend;

use App\Http\Controllers\Controller;
use App\Models\Chapter;
use App\Models\Story;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ChapterAudioStreamController extends Controller
{
    /**
     * Stream theo story slug + segment chương (slug ưu tiên, fallback id nếu segment là số).
     */
    public function streamForStoryChapterSlug(Request $request, Story $story, string $chapter_slug): BinaryFileResponse|Response
    {
        $chapter = $this->resolveChapterForStorySegment($story, $chapter_slug);

        return $this->stream($request, $chapter);
    }

    /**
     * Phát file audio chương qua URL có chữ ký thời hạn (disk private hoặc legacy public).
     *
     * Sau: thêm $this->authorize('listen', $chapter) khi có trả phí / đăng nhập.
     */
    public function stream(Request $request, Chapter $chapter): BinaryFileResponse|Response
    {
        $resolved = $chapter->resolveAudioFileAbsolutePath();
        if ($resolved === null) {
            abort(404);
        }

        $headers = [
            'Content-Type' => $this->mimeForExtension($resolved['extension']),
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ];

        return response()->file($resolved['absolute'], $headers);
    }

    private function resolveChapterForStorySegment(Story $story, string $chapter_slug): Chapter
    {
        $segment = trim($chapter_slug);
        if ($segment === '') {
            abort(404);
        }

        $bySlug = $story->chapters()->where('slug', $segment)->first();
        if ($bySlug !== null) {
            return $bySlug;
        }

        if (ctype_digit($segment)) {
            $byId = $story->chapters()->where('id', (int) $segment)->first();
            if ($byId !== null) {
                return $byId;
            }
        }

        abort(404);
    }

    /**
     * @return non-empty-string
     */
    private function mimeForExtension(string $extension): string
    {
        return match (strtolower($extension)) {
            'mp3', 'mpeg' => 'audio/mpeg',
            'm4a', 'mp4', 'm4b' => 'audio/mp4',
            'wav' => 'audio/wav',
            'ogg' => 'audio/ogg',
            'webm' => 'audio/webm',
            default => 'application/octet-stream',
        };
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Chapter;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ChapterAudioStreamController extends Controller
{
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

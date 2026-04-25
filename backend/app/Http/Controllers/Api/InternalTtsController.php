<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Chapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\File\UploadedFile;

class InternalTtsController extends Controller
{
    public function complete(Request $request): JsonResponse
    {
        if ($request->hasFile('audio')) {
            return $this->completeWithUploadedAudio($request);
        }

        return $this->completeFromJson($request);
    }

    /**
     * Worker gửi file MP3 (multipart); Laravel lưu `storage/app/public` qua disk `public`.
     */
    private function completeWithUploadedAudio(Request $request): JsonResponse
    {
        $data = $request->validate([
            'chapter_id' => ['required', 'integer', 'exists:chapters,id'],
            'story_id' => ['required', 'integer', 'exists:stories,id'],
            'status' => ['required', 'string', 'in:completed,ready'],
            'duration' => ['nullable', 'integer', 'min:0'],
            'audio' => ['required', 'file', 'max:51200'],
        ]);

        $chapter = Chapter::query()->findOrFail($data['chapter_id']);

        if ((int) $chapter->story_id !== (int) $data['story_id']) {
            return response()->json(['message' => 'chapter_id does not belong to story_id.'], 422);
        }

        $relativePath = sprintf(
            'stories/%d/chapters/%d/audio.mp3',
            (int) $data['story_id'],
            (int) $data['chapter_id']
        );

        $disk = Storage::disk('public');
        /** @var UploadedFile $upload */
        $upload = $request->file('audio');
        $realPath = $upload->getRealPath();
        if ($realPath === false) {
            Log::warning('tts-complete multipart: cannot resolve upload real path', [
                'story_id' => $data['story_id'],
                'chapter_id' => $data['chapter_id'],
                'original_name' => $upload->getClientOriginalName(),
            ]);

            return response()->json(['message' => 'Could not read uploaded audio.'], 422);
        }

        $stream = fopen($realPath, 'r');
        if ($stream === false) {
            Log::warning('tts-complete multipart: fopen failed', [
                'story_id' => $data['story_id'],
                'chapter_id' => $data['chapter_id'],
            ]);

            return response()->json(['message' => 'Could not read uploaded audio.'], 422);
        }
        try {
            $disk->put($relativePath, $stream);
        } finally {
            fclose($stream);
        }

        $storedBytes = $disk->exists($relativePath) ? $disk->size($relativePath) : 0;
        Log::info('tts-complete multipart: audio saved', [
            'story_id' => $data['story_id'],
            'chapter_id' => $data['chapter_id'],
            'relative_path' => $relativePath,
            'upload_reported_bytes' => $upload->getSize(),
            'stored_bytes' => $storedBytes,
            'client_mime' => $upload->getClientMimeType(),
            'duration' => $data['duration'] ?? null,
        ]);

        $chapter->forceFill([
            'status' => Chapter::STATUS_COMPLETED,
            'audio_path' => $relativePath,
            'error_message' => null,
            'duration' => $data['duration'] ?? $chapter->duration,
        ])->save();

        return $this->ttsCompleteResponse($chapter);
    }

    /**
     * JSON: failed (bắt buộc) hoặc completed với `audio_path` đã có sẵn trên disk (tương thích cũ).
     */
    private function completeFromJson(Request $request): JsonResponse
    {
        $data = $request->validate([
            'chapter_id' => ['required', 'integer', 'exists:chapters,id'],
            'story_id' => ['required', 'integer', 'exists:stories,id'],
            'status' => ['required', 'string', 'in:completed,failed,ready'],
            'audio_path' => ['nullable', 'string', 'max:1024'],
            'error' => ['nullable', 'string', 'max:5000'],
            'duration' => ['nullable', 'integer', 'min:0'],
        ]);

        $normalized = $data['status'] === 'ready' ? 'completed' : $data['status'];

        if ($normalized === 'completed' && empty($data['audio_path'])) {
            return response()->json(['message' => 'audio_path is required when status is completed (or send multipart field `audio`).'], 422);
        }

        if (! empty($data['audio_path']) && Str::contains($data['audio_path'], ['..', "\0"])) {
            return response()->json(['message' => 'Invalid audio_path.'], 422);
        }

        $chapter = Chapter::query()->findOrFail($data['chapter_id']);

        if ((int) $chapter->story_id !== (int) $data['story_id']) {
            return response()->json(['message' => 'chapter_id does not belong to story_id.'], 422);
        }

        $disk = Storage::disk('public');
        $relativePath = null;

        if ($normalized === 'completed' && ! empty($data['audio_path'])) {
            $relativePath = $this->normalizePublicDiskRelativePath($data['audio_path']);

            if (! $disk->exists($relativePath)) {
                $payload = [
                    'message' => 'Audio file not found on storage disk `public`.',
                    'hint' => 'Worker có thể gửi multipart với field `audio` để Laravel lưu file; hoặc ghi sẵn vào `storage/app/public` rồi gửi `audio_path` tương đối (ví dụ `stories/1/chapters/2/audio.mp3`). Chạy `php artisan storage:link` cho URL `/storage/...`.',
                ];
                if (config('app.debug')) {
                    $payload['normalized_path'] = $relativePath;
                    $payload['absolute_expected'] = $disk->path($relativePath);
                }

                return response()->json($payload, 422);
            }
        }

        $chapter->forceFill([
            'status' => $normalized === 'completed' ? Chapter::STATUS_COMPLETED : Chapter::STATUS_FAILED,
            'audio_path' => $normalized === 'completed' ? $relativePath : $chapter->audio_path,
            'error_message' => $normalized === 'failed' ? ($data['error'] ?? 'Unknown error') : null,
            'duration' => $data['duration'] ?? $chapter->duration,
        ])->save();

        if ($normalized === 'failed') {
            Log::info('tts-complete json: chapter failed', [
                'story_id' => $data['story_id'],
                'chapter_id' => $data['chapter_id'],
                'error_preview' => Str::limit($data['error'] ?? '', 200),
            ]);
        } elseif ($normalized === 'completed' && $relativePath !== null) {
            $bytes = $disk->exists($relativePath) ? $disk->size($relativePath) : 0;
            Log::info('tts-complete json: completed using existing path', [
                'story_id' => $data['story_id'],
                'chapter_id' => $data['chapter_id'],
                'relative_path' => $relativePath,
                'file_bytes' => $bytes,
            ]);
        }

        return $this->ttsCompleteResponse($chapter);
    }

    private function ttsCompleteResponse(Chapter $chapter): JsonResponse
    {
        $fresh = $chapter->fresh();

        return response()->json([
            'message' => 'Updated.',
            'data' => array_merge($fresh->toArray(), [
                'audio_url' => $fresh->publicAudioUrl(),
            ]),
        ]);
    }

    /**
     * Chuẩn hóa đường dẫn tương đối trên disk `public` (storage/app/public).
     */
    private function normalizePublicDiskRelativePath(string $path): string
    {
        $path = trim(str_replace('\\', '/', $path));
        $path = ltrim($path, '/');

        foreach (['public/', 'storage/app/public/', 'storage/'] as $prefix) {
            if (str_starts_with($path, $prefix)) {
                $path = substr($path, strlen($prefix));
                break;
            }
        }

        $root = realpath(storage_path('app/public'));
        if ($root !== false) {
            $rootNorm = rtrim(str_replace('\\', '/', $root), '/');
            $candidate = str_replace('\\', '/', $path);
            if (str_starts_with($candidate, $rootNorm.'/')) {
                $path = substr($candidate, strlen($rootNorm) + 1);
            }
        }

        return ltrim($path, '/');
    }
}

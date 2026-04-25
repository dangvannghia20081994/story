<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Chapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class InternalTtsController extends Controller
{
    public function complete(Request $request): JsonResponse
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
            return response()->json(['message' => 'audio_path is required when status is completed.'], 422);
        }

        if (! empty($data['audio_path']) && Str::contains($data['audio_path'], ['..', "\0"])) {
            return response()->json(['message' => 'Invalid audio_path.'], 422);
        }

        $chapter = Chapter::query()->findOrFail($data['chapter_id']);

        if ((int) $chapter->story_id !== (int) $data['story_id']) {
            return response()->json(['message' => 'chapter_id does not belong to story_id.'], 422);
        }

        if ($normalized === 'completed' && ! Storage::disk('public')->exists($data['audio_path'])) {
            return response()->json(['message' => 'Audio file not found on storage disk.'], 422);
        }

        $chapter->forceFill([
            'status' => $normalized === 'completed' ? Chapter::STATUS_COMPLETED : Chapter::STATUS_FAILED,
            'audio_path' => $normalized === 'completed' ? $data['audio_path'] : $chapter->audio_path,
            'error_message' => $normalized === 'failed' ? ($data['error'] ?? 'Unknown error') : null,
            'duration' => $data['duration'] ?? $chapter->duration,
        ])->save();

        return response()->json([
            'message' => 'Updated.',
            'data' => array_merge($chapter->fresh()->toArray(), [
                'audio_url' => $chapter->publicAudioUrl(),
            ]),
        ]);
    }
}

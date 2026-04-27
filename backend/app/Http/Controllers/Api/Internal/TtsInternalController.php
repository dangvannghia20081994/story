<?php

namespace App\Http\Controllers\Api\Internal;

use App\Http\Controllers\Controller;
use App\Models\Chapter;
use Dedoc\Scramble\Attributes\Group;
use Dedoc\Scramble\Attributes\HeaderParameter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

#[Group('Internal · TTS', weight: 6)]
#[HeaderParameter('X-Worker-Tts-Token', 'Token khớp biến môi trường WORKER_TTS_INTERNAL_TOKEN.', required: true, type: 'string')]
class TtsInternalController extends Controller
{
    /**
     * Worker TTS upload file âm thanh chương (WAV/MP3), lưu disk public và cập nhật DB.
     */
    public function storeChapterAudio(Request $request, Chapter $chapter): JsonResponse
    {
        $data = $request->validate([
            'audio' => ['required', 'file', 'mimes:wav,mp3', 'max:102400'],
            'duration' => ['nullable', 'integer', 'min:0', 'max:2147483647'],
        ]);

        if ($chapter->audio_path !== null && $chapter->audio_path !== '') {
            Storage::disk('public')->delete($chapter->audio_path);
        }

        $uploaded = $data['audio'];
        $extension = strtolower((string) $uploaded->getClientOriginalExtension()) ?: 'wav';
        if (! in_array($extension, ['wav', 'mp3'], true)) {
            $extension = 'wav';
        }

        $dir = 'chapters/'.$chapter->id;
        $filename = 'audio.'.$extension;
        $path = $uploaded->storeAs($dir, $filename, 'public');

        $duration = (int) ($data['duration'] ?? 0);
        Chapter::query()->whereKey($chapter->getKey())->update([
            'audio_path' => $path,
            'duration' => $duration,
            'tts_enqueued_at' => null,
            'updated_at' => now(),
        ]);
        $fresh = $chapter->fresh();

        return response()->json([
            'data' => [
                'chapter_id' => $fresh->id,
                'audio_path' => $fresh->audio_path,
                'audio_url' => $fresh->publicAudioUrl(),
                'duration' => $fresh->duration,
            ],
        ], 201);
    }
}

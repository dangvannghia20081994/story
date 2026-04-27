<?php

namespace App\Http\Controllers\Api\Internal;

use App\Http\Controllers\Controller;
use App\Models\Chapter;
use Dedoc\Scramble\Attributes\Group;
use Dedoc\Scramble\Attributes\HeaderParameter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

#[Group('Internal · TTS', weight: 6)]
#[HeaderParameter('X-Worker-Tts-Token', 'Token khớp biến môi trường WORKER_TTS_INTERNAL_TOKEN.', required: true, type: 'string')]
class TtsInternalController extends Controller
{
    /**
     * Worker TTS upload file âm thanh chương (WAV/MP3/M4A), lưu disk public và cập nhật DB.
     */
    public function storeChapterAudio(Request $request, Chapter $chapter): JsonResponse
    {
        $ctx = [
            'chapter_id' => $chapter->id,
            'story_id' => $chapter->story_id,
        ];

        Log::info('worker_tts.upload.begin', array_merge($ctx, [
            'has_file_audio' => $request->hasFile('audio'),
            'request_keys' => array_keys($request->all()),
            'content_length' => $request->header('Content-Length'),
            'content_type' => $request->header('Content-Type'),
            'has_token_header' => $request->hasHeader('X-Worker-Tts-Token'),
        ]));

        try {
            if ($request->has('duration') && ($request->input('duration') === '' || $request->input('duration') === null)) {
                $request->merge(['duration' => null]);
            }

            $maxKb = max(1024, (int) config('worker_tts.max_audio_upload_kb', 512 * 1024));
            $allowedExt = config('worker_tts.upload_audio_extensions', ['wav', 'mp3', 'm4a']);
            $allowedExt = array_values(array_filter(array_map('strtolower', $allowedExt)));
            if ($allowedExt === []) {
                $allowedExt = ['wav', 'mp3', 'm4a'];
            }

            $data = $request->validate([
                'audio' => [
                    'required',
                    'file',
                    'max:'.$maxKb,
                    function (string $attribute, mixed $value, \Closure $fail) use ($allowedExt): void {
                        if (! $value instanceof UploadedFile) {
                            $fail('Phải là file upload hợp lệ.');

                            return;
                        }
                        $ext = strtolower((string) $value->getClientOriginalExtension());
                        if (! in_array($ext, $allowedExt, true)) {
                            $fail('Định dạng file không được phép (cấu hình worker_tts.upload_audio_extensions).');
                        }
                    },
                ],
                'duration' => ['nullable', 'integer', 'min:0', 'max:2147483647'],
            ]);

            /** @var UploadedFile $uploaded */
            $uploaded = $data['audio'];
            Log::info('worker_tts.upload.validated', array_merge($ctx, [
                'client_original_name' => $uploaded->getClientOriginalName(),
                'size_bytes' => $uploaded->getSize(),
                'mime_client' => $uploaded->getClientMimeType(),
                'mime_guess' => $uploaded->getMimeType(),
                'extension' => $uploaded->getClientOriginalExtension(),
                'max_upload_kb' => $maxKb,
            ]));

            if ($chapter->audio_path !== null && $chapter->audio_path !== '') {
                Storage::disk('public')->delete($chapter->audio_path);
                Log::info('worker_tts.upload.removed_previous_file', array_merge($ctx, ['path' => $chapter->audio_path]));
            }

            $extension = strtolower((string) $uploaded->getClientOriginalExtension()) ?: 'wav';
            if (! in_array($extension, $allowedExt, true)) {
                $extension = in_array('wav', $allowedExt, true) ? 'wav' : $allowedExt[0];
            }

            $dir = 'stories/'.$chapter->story_id.'/chapters/'.$chapter->id;
            $filename = 'audio.'.$extension;
            $path = $uploaded->storeAs($dir, $filename, 'public');

            if (! is_string($path) || $path === '') {
                Log::error('worker_tts.upload.store_as_failed', array_merge($ctx, [
                    'dir' => $dir,
                    'filename' => $filename,
                    'disk_root' => (string) config('filesystems.disks.public.root'),
                ]));

                return response()->json([
                    'message' => 'Không ghi được file âm thanh lên disk public (quyền ghi storage/app/public hoặc disk).',
                ], 500);
            }

            Log::info('worker_tts.upload.file_written', array_merge($ctx, ['relative_path' => $path]));

            $duration = (int) ($data['duration'] ?? 0);
            Chapter::query()->whereKey($chapter->getKey())->update([
                'audio_path' => $path,
                'duration' => $duration,
                'tts_enqueued_at' => null,
                'updated_at' => now(),
            ]);

            $fresh = $chapter->fresh();
            Log::info('worker_tts.upload.done', array_merge($ctx, [
                'audio_path' => $fresh->audio_path,
                'duration' => $fresh->duration,
            ]));

            return response()->json([
                'data' => [
                    'chapter_id' => $fresh->id,
                    'audio_path' => $fresh->audio_path,
                    'audio_url' => $fresh->publicAudioUrl(),
                    'duration' => $fresh->duration,
                ],
            ], 201);
        } catch (ValidationException $e) {
            $audio = $request->file('audio');
            Log::warning('worker_tts.upload.validation_failed', array_merge($ctx, [
                'errors' => $e->errors(),
                'has_file_audio' => $request->hasFile('audio'),
                'php_upload_error' => $audio instanceof UploadedFile ? $audio->getError() : null,
                'php_upload_error_message' => $audio instanceof UploadedFile ? $audio->getErrorMessage() : null,
            ]));
            throw $e;
        } catch (\Throwable $e) {
            report($e);
            Log::error('worker_tts.upload.exception', array_merge($ctx, [
                'exception' => $e::class,
                'message' => $e->getMessage(),
            ]));

            throw $e;
        }
    }
}

<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Redis list — RPUSH từ backend, BLPOP từ worker-tts (JSON)
    |--------------------------------------------------------------------------
    */
    'redis_queue_list' => env('WORKER_TTS_REDIS_QUEUE', 'story:tts:queue'),

    /*
    |--------------------------------------------------------------------------
    | Token API nội bộ (header X-Worker-Tts-Token)
    |--------------------------------------------------------------------------
    */
    'internal_token' => env('WORKER_TTS_INTERNAL_TOKEN', ''),

    /*
    |--------------------------------------------------------------------------
    | Giới hạn upload WAV/MP3 từ worker-tts (đơn vị: kilobyte, giống rule File::max)
    |--------------------------------------------------------------------------
    */
    'max_audio_upload_kb' => (int) env('WORKER_TTS_MAX_AUDIO_UPLOAD_KB', 512 * 1024),

    /*
    |--------------------------------------------------------------------------
    | Phần mở rộng file upload từ worker-tts (multipart field `audio`)
    |--------------------------------------------------------------------------
    |
    | CSV, ví dụ: wav,mp3,m4a
    |
    */
    'upload_audio_extensions' => array_values(array_filter(array_map(
        static fn (string $e): string => strtolower(trim($e)),
        explode(',', (string) env('WORKER_TTS_UPLOAD_EXTENSIONS', 'wav,mp3,m4a')),
    ))),

];

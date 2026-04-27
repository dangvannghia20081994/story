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

];

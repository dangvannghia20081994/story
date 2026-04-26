<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Redis list cho worker crawl (Python) — RPUSH / BLPOP
    |--------------------------------------------------------------------------
    */
    'redis_queue_list' => env('CRAWLER_REDIS_QUEUE', 'crawler:queue'),

    /*
    |--------------------------------------------------------------------------
    | Token gọi API nội bộ (header X-Crawler-Token)
    |--------------------------------------------------------------------------
    */
    'internal_token' => env('CRAWLER_INTERNAL_TOKEN', ''),

];

<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Lexicon list cache (Redis / default cache store)
    |--------------------------------------------------------------------------
    | Danh sách đã sắp xếp được cache; khi Lexicon saved/deleted cache bị xóa và tải lại lần sau.
    | Để dùng Redis khi CACHE_STORE khác: đặt LEXICON_CACHE_STORE=redis
    */

    'cache_key' => env('LEXICON_CACHE_KEY', 'lexicons.all_ordered'),

    'cache_store' => env('LEXICON_CACHE_STORE'),

];

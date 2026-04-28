<?php

return [

    /*
    |--------------------------------------------------------------------------
    | TTL for signed audio stream URLs (API / JSON)
    |--------------------------------------------------------------------------
    |
    | Client nhận URL đầy đủ có chữ ký; hết hạn phải gọi API lại để lấy URL mới.
    | Sau này gắn auth / trả phí có thể rút ngắn TTL.
    |
    */
    'signed_url_ttl_minutes' => max(1, (int) env('CHAPTER_AUDIO_SIGNED_URL_TTL_MINUTES', 30)),

    /*
    |--------------------------------------------------------------------------
    | Disk lưu file mới từ worker TTS
    |--------------------------------------------------------------------------
    |
    | Dùng disk `local` (storage/app/private). File cũ trên disk `public` vẫn
    | được phục vụ qua stream cho đến khi migrate / upload lại.
    |
    */
    'storage_disk' => env('CHAPTER_AUDIO_STORAGE_DISK', 'local'),

    /*
    |--------------------------------------------------------------------------
    | Giới hạn GET stream (Range / seek tạo nhiều request)
    |--------------------------------------------------------------------------
    */
    'stream_throttle_per_minute' => max(30, (int) env('CHAPTER_AUDIO_STREAM_THROTTLE_PER_MINUTE', 480)),

];

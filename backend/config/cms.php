<?php

$allowedPositions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
$position = (string) env('CMS_TOAST_POSITION', 'top-right');
if (! in_array($position, $allowedPositions, true)) {
    $position = 'top-right';
}

$durationMs = (int) env('CMS_TOAST_DURATION_MS', 3000);
$durationMs = max(300, min(120_000, $durationMs));

return [

    /*
    |--------------------------------------------------------------------------
    | Toast CMS (JavaScript window.cmsToast)
    |--------------------------------------------------------------------------
    | Vị trí: top-left | top-right | bottom-left | bottom-right
    | Thời gian hiển thị (ms) trước khi tự ẩn — có thể ghi đè từng lần gọi cmsToast(..., { durationMs }).
    */
    'toast' => [
        'position' => $position,
        'duration_ms' => $durationMs,
    ],

];

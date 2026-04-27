<?php

$defaultOrigins = implode(',', array_filter([
    env('FRONTEND_URL', 'http://localhost:3000'),
    'http://localhost:8090',
    'http://127.0.0.1:8090',
    'http://localhost:8081',
    'http://127.0.0.1:8081',
]));

$allowedOrigins = array_values(array_filter(array_map(
    static fn (string $origin): string => trim($origin),
    explode(',', (string) env('CORS_ALLOWED_ORIGINS', $defaultOrigins))
)));

/** Expo web / Metro: trình duyệt dùng localhost hoặc 127.0.0.1 với cổng bất kỳ — khác origin với story.test. */
$localOriginPatterns = [];
if (env('APP_ENV') === 'local' || filter_var(env('CORS_ALLOW_LOCALHOST_PATTERN', false), FILTER_VALIDATE_BOOL)) {
    $localOriginPatterns[] = '#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#';
}

return [

    'paths' => ['api/*', 'storage/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => $allowedOrigins,

    'allowed_origins_patterns' => $localOriginPatterns,

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];

<?php

use App\Http\Controllers\Cms\StoryApiController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API JSON cho CMS (session + admin)
|--------------------------------------------------------------------------
| Prefix: /api/cms — middleware: web, auth, cms.admin (đăng ký trong bootstrap/app.php).
| Stories JSON: App\Http\Controllers\Cms\StoryApiController
| Giao diện Blade CMS vẫn dùng routes/web.php.
*/

Route::get('/ping', static fn () => response()->json([
    'ok' => true,
    'message' => 'CMS API reachable',
]));

Route::get('/stories', [StoryApiController::class, 'index']);

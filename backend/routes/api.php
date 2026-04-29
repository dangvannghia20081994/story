<?php

/*
|--------------------------------------------------------------------------
| API routes
|--------------------------------------------------------------------------
| Laravel bọc file này bằng middleware `api` và prefix `/api`.
| - routes/api/frontend.php → App\Http\Controllers\Api\Frontend\*
| - routes/api/internal.php → App\Http\Controllers\Api\Internal\*\*
| - routes/api/cms.php → bootstrap `then` prefix api/cms (JSON CMS, vd. Cms\StoryApiController)
*/

require __DIR__.'/api/frontend.php';
require __DIR__.'/api/internal.php';

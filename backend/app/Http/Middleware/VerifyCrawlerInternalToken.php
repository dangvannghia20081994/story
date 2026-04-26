<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyCrawlerInternalToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $expected = (string) config('crawler.internal_token', '');
        if ($expected === '') {
            abort(503, 'CRAWLER_INTERNAL_TOKEN is not configured.');
        }

        $given = (string) $request->header('X-Crawler-Token', '');
        if ($given === '' || ! hash_equals($expected, $given)) {
            abort(401, 'Invalid crawler token.');
        }

        return $next($request);
    }
}

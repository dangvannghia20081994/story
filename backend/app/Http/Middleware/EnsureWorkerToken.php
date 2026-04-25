<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureWorkerToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $expected = config('services.worker.internal_token');
        if (! is_string($expected) || $expected === '') {
            abort(503, 'Worker token not configured.');
        }

        $token = $request->bearerToken() ?? $request->header('X-Worker-Token');
        if (! hash_equals($expected, (string) $token)) {
            abort(401, 'Invalid worker token.');
        }

        return $next($request);
    }
}

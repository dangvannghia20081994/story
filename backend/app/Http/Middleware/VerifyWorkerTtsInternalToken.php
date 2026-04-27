<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyWorkerTtsInternalToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $expected = (string) config('worker_tts.internal_token', '');
        if ($expected === '') {
            abort(503, 'WORKER_TTS_INTERNAL_TOKEN is not configured.');
        }

        $given = (string) $request->header('X-Worker-Tts-Token', '');
        if ($given === '' || ! hash_equals($expected, $given)) {
            abort(401, 'Invalid worker TTS token.');
        }

        return $next($request);
    }
}

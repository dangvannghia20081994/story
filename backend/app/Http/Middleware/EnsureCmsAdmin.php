<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureCmsAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user === null || ! $user->is_admin) {
            abort(403, 'CMS: chỉ tài khoản quản trị.');
        }

        return $next($request);
    }
}

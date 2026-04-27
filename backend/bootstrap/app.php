<?php

use App\Http\Middleware\EnsureCmsAdmin;
use App\Http\Middleware\VerifyCrawlerInternalToken;
use App\Http\Middleware\VerifyWorkerTtsInternalToken;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'cms.admin' => EnsureCmsAdmin::class,
            'crawler.internal' => VerifyCrawlerInternalToken::class,
            'worker.tts.internal' => VerifyWorkerTtsInternalToken::class,
        ]);
        $middleware->redirectGuestsTo(fn () => route('cms.login'));
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();

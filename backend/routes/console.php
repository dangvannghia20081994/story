<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Str;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('crawler:internal-token {--show : Chỉ in giá trị token (không kèm tên biến)}', function (): void {
    $token = Str::random(48);
    if ($this->option('show')) {
        $this->line($token);

        return;
    }

    $this->warn('Chưa ghi file .env tự động — bạn copy dòng dưới vào backend/.env và crawler/.env (cùng giá trị), rồi chạy lại PHP và worker.');
    $this->newLine();
    $this->line('CRAWLER_INTERNAL_TOKEN='.$token);
    $this->newLine();
})->purpose('Sinh CRAWLER_INTERNAL_TOKEN cho API nội bộ crawler và worker Python');

Artisan::command('worker-tts:internal-token {--show : Chỉ in giá trị token (không kèm tên biến)}', function (): void {
    $token = Str::random(48);
    if ($this->option('show')) {
        $this->line($token);

        return;
    }

    $this->warn('Chưa ghi file .env tự động — copy dòng dưới vào backend/.env và worker-tts/.env (cùng giá trị).');
    $this->newLine();
    $this->line('WORKER_TTS_INTERNAL_TOKEN='.$token);
    $this->newLine();
})->purpose('Sinh WORKER_TTS_INTERNAL_TOKEN cho API nội bộ TTS và worker-tts');

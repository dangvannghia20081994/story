<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\TextPreprocessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PreprocessController extends Controller
{
    public function __construct(
        private TextPreprocessService $textPreprocess,
    ) {}

    /**
     * Xem trước văn bản sau khi áp dụng lexicon (ROADMAP — làm sạch trước khi gửi worker).
     */
    public function preview(Request $request): JsonResponse
    {
        $data = $request->validate([
            'text' => ['required', 'string', 'max:500000'],
        ]);

        return response()->json([
            'data' => [
                'original' => $data['text'],
                'processed' => $this->textPreprocess->apply($data['text']),
            ],
        ]);
    }
}

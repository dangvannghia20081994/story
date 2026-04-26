<?php

return [

    /**
     * Dịch vụ TTS cho CMS (chọn voice nhân vật). Hiện có: vieneu.
     * Sau này thêm Coqui: đặt TTS_SERVICE=coqui và điền khối voices.coqui (khớp worker).
     */
    'service' => strtolower((string) env('TTS_SERVICE', 'vieneu')),

    'default_voice_id' => env('TTS_DEFAULT_VOICE_ID'),

    'narrator_character_name' => env('TTS_NARRATOR_CHARACTER_NAME', 'Người kể'),

    /**
     * Voice theo từng dịch vụ: key = mã lưu DB / queue; value = nhãn CMS.
     *
     * @var array<string, array<string, string>>
     */
    'voices' => [
        'vieneu' => [
            '1' => 'Bích Ngọc (nữ — miền Bắc)',
            '2' => 'Phạm Tuyên (nam — miền Bắc)',
            '3' => 'Thục Đoan (nữ — miền Nam)',
            '4' => 'Xuân Vĩnh (nam — miền Nam)',
        ],
        // Khi tích hợp worker Coqui — bỏ comment và thêm map voice_id => nhãn:
        // 'coqui' => [
        //     'example_model_id' => 'Ví dụ',
        // ],
    ],
];

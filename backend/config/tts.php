<?php

return [

    'default_voice_id' => env('TTS_DEFAULT_VOICE_ID', 'vi-VN-HoaiMyNeural'),

    'narrator_character_name' => env('TTS_NARRATOR_CHARACTER_NAME', 'Người kể'),

    /**
     * Danh sách voice_id cho CMS (select) + Rule::in Form Request.
     * Key = giá trị lưu DB; value = nhãn hiển thị.
     * Azure/Edge: vi-VN-* — FPT: tên voice API v5 (khi worker dùng FPT).
     *
     * @var array<string, string>
     */
    'voices' => [
        'vi-VN-HoaiMyNeural' => 'Azure — Hoài My (nữ, mặc định)',
        'vi-VN-NamMinhNeural' => 'Azure — Nam Minh (nam)',
        'vi-VN-ThanhDatNeural' => 'Azure — Thành Đạt (nam)',
        'banmai' => 'FPT — Ban Mai',
        'lannhi' => 'FPT — Lan Nhi',
        'leminh' => 'FPT — Lê Minh',
        'myan' => 'FPT — Mỹ An',
        'thuminh' => 'FPT — Thu Minh',
        'giahuy' => 'FPT — Gia Huy',
        'linhsan' => 'FPT — Linh San',
        'ngoclam' => 'FPT — Ngọc Lam',
        'minhquang' => 'FPT — Minh Quang',
    ],
];

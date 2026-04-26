<?php

return [

    /**
     * Dịch vụ TTS đang dùng cho CMS (chọn voice nhân vật): azure | fpt.
     * Đặt qua .env TTS_SERVICE — đổi giá trị sẽ đổi cả danh sách voice trong form.
     */
    'service' => strtolower((string) env('TTS_SERVICE', 'fpt')),

    /**
     * Voice mặc định khi tạo nhân vật: phải là key trong nhóm voices[TTS_SERVICE].
     * Để trống = dùng mục đầu tiên trong nhóm đó (theo thứ tự mảng bên dưới).
     */
    'default_voice_id' => env('TTS_DEFAULT_VOICE_ID'),

    'narrator_character_name' => env('TTS_NARRATOR_CHARACTER_NAME', 'Người kể'),

    /**
     * Voice theo từng dịch vụ: key = mã lưu DB / gửi API; value = nhãn CMS.
     *
     * @var array<string, array<string, string>>
     */
    'voices' => [
        'azure' => [
            'vi-VN-HoaiMyNeural' => 'Hoài My (nữ)',
            'vi-VN-NamMinhNeural' => 'Nam Minh (nam)',
            'vi-VN-ThanhDatNeural' => 'Thành Đạt (nam)',
        ],
        'fpt' => [
            'banmai' => 'Ban Mai',
            'lannhi' => 'Lan Nhi',
            'leminh' => 'Lê Minh',
            'myan' => 'Mỹ An',
            'thuminh' => 'Thu Minh',
            'giahuy' => 'Gia Huy',
            'linhsan' => 'Linh San',
            'ngoclam' => 'Ngọc Lam',
            'minhquang' => 'Minh Quang',
        ],
    ],
];

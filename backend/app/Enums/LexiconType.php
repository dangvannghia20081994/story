<?php

namespace App\Enums;

/**
 * Loại mục lexicon (tiền xử lý văn bản) — giá trị lưu DB.
 * Khác với thể loại truyện (genre).
 */
enum LexiconType: string
{
    case Pronunciation = 'pronunciation';
    case Name = 'name';
    case Filter = 'filter';

    public function label(): string
    {
        return match ($this) {
            self::Pronunciation => 'Phiên âm (cách đọc)',
            self::Name => 'Tên riêng',
            self::Filter => 'Lọc / thay từ',
        };
    }

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }
}

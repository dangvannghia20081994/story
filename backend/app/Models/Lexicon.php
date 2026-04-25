<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Lexicon extends Model
{
    public const TYPE_PRONUNCIATION = 'pronunciation';

    public const TYPE_NAME = 'name';

    public const TYPE_FILTER = 'filter';

    protected $fillable = [
        'word',
        'replacement',
        'type',
        'priority',
    ];

    protected function casts(): array
    {
        return [
            'priority' => 'integer',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }
}

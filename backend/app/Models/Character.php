<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Character extends Model
{
    protected $fillable = [
        'story_id',
        'name',
        'voice_id',
        'pitch',
        'rate',
    ];

    protected function casts(): array
    {
        return [
            'pitch' => 'float',
            'rate' => 'float',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function story(): BelongsTo
    {
        return $this->belongsTo(Story::class);
    }
}

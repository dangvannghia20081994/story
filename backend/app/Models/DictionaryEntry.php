<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DictionaryEntry extends Model
{
    protected $fillable = [
        'word',
        'ipa',
        'notes',
    ];
}

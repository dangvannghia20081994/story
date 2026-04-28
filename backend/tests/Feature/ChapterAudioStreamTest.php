<?php

namespace Tests\Feature;

use App\Models\Chapter;
use App\Models\Story;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class ChapterAudioStreamTest extends TestCase
{
    use RefreshDatabase;

    public function test_unsigned_stream_request_is_rejected(): void
    {
        $story = Story::query()->create(['title' => 'T', 'slug' => 't-audio']);
        $chapter = Chapter::query()->create([
            'story_id' => $story->id,
            'title' => 'C1',
            'content' => 'x',
            'audio_path' => 'stories/'.$story->id.'/chapters/1/audio.mp3',
        ]);

        $this->get('/api/chapters/'.$chapter->id.'/audio/stream')
            ->assertForbidden();
    }

    public function test_signed_stream_returns_file_when_audio_exists_on_private_disk(): void
    {
        $story = Story::query()->create(['title' => 'T2', 'slug' => 't-audio-2']);
        $chapter = Chapter::query()->create([
            'story_id' => $story->id,
            'title' => 'C1',
            'content' => 'x',
            'audio_path' => null,
        ]);

        $relative = 'stories/'.$story->id.'/chapters/'.$chapter->id.'/audio.mp3';
        Storage::disk('local')->makeDirectory(dirname($relative));
        Storage::disk('local')->put($relative, str_repeat("\0", 64));
        $chapter->update(['audio_path' => $relative]);

        $signed = URL::temporarySignedRoute(
            'api.chapters.audio.stream',
            now()->addMinutes(5),
            ['chapter' => $chapter->id],
        );

        $path = (string) parse_url($signed, PHP_URL_PATH);
        $query = (string) parse_url($signed, PHP_URL_QUERY);

        $this->get($path.'?'.$query)
            ->assertOk()
            ->assertHeader('Content-Type', 'audio/mpeg');
    }
}

<?php

namespace App\Http\Controllers\Cms;

use App\Enums\LexiconType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Cms\StoreBulkLexiconsRequest;
use App\Http\Requests\Cms\StoreLexiconRequest;
use App\Http\Requests\Cms\UpdateLexiconRequest;
use App\Models\Chapter;
use App\Models\Lexicon;
use App\Models\Story;
use App\Services\LexiconWordExtractor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class LexiconController extends Controller
{
    public function index(Request $request): View
    {
        $q = trim((string) $request->query('q', ''));
        $typeRaw = $request->query('type', '');
        $typeFilter = is_string($typeRaw) ? trim($typeRaw) : '';
        if ($typeFilter !== '' && ! in_array($typeFilter, LexiconType::values(), true)) {
            $typeFilter = '';
        }

        $lexicons = Lexicon::query()
            ->when(
                $q !== '',
                static function ($query) use ($q) {
                    $like = '%'.addcslashes($q, '%_\\').'%';
                    $query->where(static function ($q2) use ($like) {
                        $q2->where('word', 'like', $like)
                            ->orWhere('replacement', 'like', $like);
                    });
                }
            )
            ->when($typeFilter !== '', static function ($query) use ($typeFilter) {
                $query->where('type', $typeFilter);
            })
            ->orderByDesc('priority')
            ->orderBy('word')
            ->paginate(50)
            ->withQueryString();

        return view('cms.lexicons.index', compact('lexicons', 'q', 'typeFilter'));
    }

    public function create(): View
    {
        return view('cms.lexicons.create', [
            'lexiconTypes' => LexiconType::cases(),
        ]);
    }

    public function createBulk(): View
    {
        return view('cms.lexicons.bulk');
    }

    public function createFromChapter(): View
    {
        $stories = Story::query()->orderBy('title')->get(['id', 'title']);

        return view('cms.lexicons.from-chapter', [
            'stories' => $stories,
            'lexiconTypes' => LexiconType::cases(),
            'draftRows' => null,
            'prefillContent' => old('content', ''),
            'extractMeta' => null,
        ]);
    }

    public function extractFromChapter(Request $request): View|RedirectResponse
    {
        $validated = $request->validate([
            'content' => ['required', 'string', 'max:800000'],
            'min_length' => ['nullable', 'integer', 'min:1', 'max:50'],
            'default_type' => ['required', 'string', Rule::in(LexiconType::values())],
            'skip_existing' => ['nullable', 'boolean'],
            'prefill_replacement_as_word' => ['nullable', 'boolean'],
        ]);

        $min = max(1, min(50, (int) ($validated['min_length'] ?? 2)));
        $type = $validated['default_type'];
        $tokens = LexiconWordExtractor::uniqueTokens($validated['content'], $min);

        if ($request->boolean('skip_existing') && $tokens !== []) {
            $existing = Lexicon::query()
                ->where('type', $type)
                ->whereIn('word', $tokens)
                ->pluck('word')
                ->all();
            $lower = array_map(static fn (string $w): string => mb_strtolower($w), $existing);
            $lowerSet = array_fill_keys($lower, true);
            $tokens = array_values(array_filter(
                $tokens,
                static fn (string $w): bool => ! isset($lowerSet[mb_strtolower($w)])
            ));
        }

        $maxRows = 1000;
        $truncated = false;
        if (count($tokens) > $maxRows) {
            $tokens = array_slice($tokens, 0, $maxRows);
            $truncated = true;
        }

        if ($tokens === []) {
            return redirect()
                ->route('cms.lexicons.from-chapter')
                ->withInput($request->only('content', 'min_length', 'default_type', 'skip_existing', 'prefill_replacement_as_word'))
                ->with('status', 'Không trích được từ nào — thử giảm độ dài tối thiểu hoặc bỏ «Bỏ qua từ đã có».');
        }

        $prefillSame = $request->boolean('prefill_replacement_as_word');

        $draftRows = [];
        foreach ($tokens as $w) {
            $draftRows[] = [
                'word' => $w,
                'replacement' => $prefillSame ? $w : '',
                'type' => $type,
                'priority' => 0,
            ];
        }

        $stories = Story::query()->orderBy('title')->get(['id', 'title']);

        return view('cms.lexicons.from-chapter', [
            'stories' => $stories,
            'lexiconTypes' => LexiconType::cases(),
            'draftRows' => $draftRows,
            'prefillContent' => $validated['content'],
            'extractMeta' => [
                'min_length' => $min,
                'default_type' => $type,
                'skip_existing' => $request->boolean('skip_existing'),
                'prefill_replacement_as_word' => $prefillSame,
                'truncated' => $truncated,
                'count' => count($draftRows),
            ],
        ]);
    }

    public function jsonChaptersForStory(Story $story): JsonResponse
    {
        $rows = $story->chapters()->get(['id', 'title', 'slug']);

        return response()->json($rows);
    }

    public function jsonChapterContent(Story $story, Chapter $chapter): JsonResponse
    {
        if ((int) $chapter->story_id !== (int) $story->id) {
            abort(404);
        }

        return response()->json([
            'content' => $chapter->content,
            'title' => $chapter->title,
        ]);
    }

    public function store(StoreLexiconRequest $request): RedirectResponse
    {
        Lexicon::query()->create($request->validated());

        return redirect()->route('cms.lexicons.index')->with('status', 'Đã tạo lexicon.');
    }

    public function storeBulk(StoreBulkLexiconsRequest $request): RedirectResponse
    {
        $rows = $request->validated('lexicons');

        DB::transaction(function () use ($rows): void {
            foreach ($rows as $row) {
                Lexicon::query()->create([
                    'word' => $row['word'],
                    'replacement' => $row['replacement'],
                    'type' => $row['type'],
                    'priority' => $row['priority'] ?? 0,
                ]);
            }
        });

        $n = count($rows);

        return redirect()->route('cms.lexicons.index')->with('status', "Đã tạo {$n} mục lexicon.");
    }

    public function edit(Lexicon $lexicon): View
    {
        return view('cms.lexicons.edit', [
            'lexicon' => $lexicon,
            'lexiconTypes' => LexiconType::cases(),
        ]);
    }

    public function update(UpdateLexiconRequest $request, Lexicon $lexicon): RedirectResponse
    {
        $lexicon->fill($request->validated())->save();

        return redirect()->route('cms.lexicons.index')->with('status', 'Đã cập nhật lexicon.');
    }

    public function destroy(Lexicon $lexicon): RedirectResponse
    {
        $lexicon->delete();

        return redirect()->route('cms.lexicons.index')->with('status', 'Đã xóa lexicon.');
    }
}

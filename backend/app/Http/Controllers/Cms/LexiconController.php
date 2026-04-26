<?php

namespace App\Http\Controllers\Cms;

use App\Enums\LexiconType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Cms\StoreBulkLexiconsRequest;
use App\Http\Requests\Cms\StoreLexiconRequest;
use App\Http\Requests\Cms\UpdateLexiconRequest;
use App\Models\Lexicon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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

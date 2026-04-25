<?php

namespace App\Http\Controllers\Cms;

use App\Http\Controllers\Controller;
use App\Http\Requests\Cms\StoreLexiconRequest;
use App\Http\Requests\Cms\UpdateLexiconRequest;
use App\Models\Lexicon;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

class LexiconController extends Controller
{
    public function index(): View
    {
        $lexicons = Lexicon::query()
            ->orderByDesc('priority')
            ->orderBy('word')
            ->paginate(50)
            ->withQueryString();

        return view('cms.lexicons.index', compact('lexicons'));
    }

    public function create(): View
    {
        return view('cms.lexicons.create', [
            'types' => [
                Lexicon::TYPE_PRONUNCIATION,
                Lexicon::TYPE_NAME,
                Lexicon::TYPE_FILTER,
            ],
        ]);
    }

    public function store(StoreLexiconRequest $request): RedirectResponse
    {
        Lexicon::query()->create($request->validated());

        return redirect()->route('cms.lexicons.index')->with('status', 'Đã tạo lexicon.');
    }

    public function edit(Lexicon $lexicon): View
    {
        return view('cms.lexicons.edit', [
            'lexicon' => $lexicon,
            'types' => [
                Lexicon::TYPE_PRONUNCIATION,
                Lexicon::TYPE_NAME,
                Lexicon::TYPE_FILTER,
            ],
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

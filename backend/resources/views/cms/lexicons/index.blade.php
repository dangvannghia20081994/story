@extends('cms.layout')

@section('title', 'Lexicon')

@push('head')
    @include('cms.partials.icon-toolbar-styles')
    @include('cms.partials.cms-filter-bar-styles')
@endpush

@section('content')
    <div class="page-head" style="margin-bottom: 1rem; align-items: center;">
        <h1>Lexicon</h1>
        <div class="row-actions" style="margin: 0; display: flex; flex-wrap: nowrap; align-items: center; gap: 0.5rem; overflow: visible;">
            <a href="{{ route('cms.stories.index') }}" class="btn" style="flex-shrink: 0;">Truyện</a>
            <details class="add-dropdown" style="flex-shrink: 0;">
                <summary class="btn btn-primary" style="list-style: none;">Mục mới ▾</summary>
                <div class="add-dropdown__menu">
                    <a href="{{ route('cms.lexicons.create') }}">Thêm một mục</a>
                    <a href="{{ route('cms.lexicons.bulk') }}">Thêm nhiều mục</a>
                    <a href="{{ route('cms.lexicons.from-chapter') }}">Từ một chương</a>
                </div>
            </details>
        </div>
    </div>
    <p class="content-lead" style="margin-top: -0.25rem; margin-bottom: 0.75rem;">Từ cần thay, phiên âm, lọc theo ưu tiên.</p>
    <form class="stories-filter-bar stories-filter-bar--scroll" method="get" action="{{ url()->current() }}">
        <input
            type="search"
            id="q"
            name="q"
            class="stories-filter-bar__q"
            value="{{ $q ?? '' }}"
            placeholder="Tìm theo từ / thay thế"
            aria-label="Tìm theo từ hoặc cách thay thế"
            autocomplete="off"
        />
        <select id="lexicon-type-filter" class="stories-filter-bar__genre" name="type" aria-label="Lọc theo loại lexicon">
            <option value="" @selected(($typeFilter ?? '') === '')>Tất cả loại</option>
            @foreach (\App\Enums\LexiconType::cases() as $lt)
                <option value="{{ $lt->value }}" @selected(($typeFilter ?? '') === $lt->value)>{{ $lt->label() }}</option>
            @endforeach
        </select>
        <div class="stories-filter-bar__actions">
            <button type="submit" class="btn btn-primary">Lọc</button>
            @if (!empty($q) || ($typeFilter ?? '') !== '')
                <a href="{{ url()->current() }}" class="btn">Xóa lọc</a>
            @endif
        </div>
    </form>
    <div class="card card--table" style="padding: 0;">
        <div class="table-scroll">
            <table>
                <thead>
                    <tr>
                        <th>Từ</th>
                        <th>Thay thế</th>
                        <th>Loại</th>
                        <th>Ưu tiên</th>
                        <th class="th-actions">Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse ($lexicons as $lex)
                        <tr>
                            <td><strong style="font-weight: 500;">{{ $lex->word }}</strong></td>
                            <td>{{ $lex->replacement }}</td>
                            <td>{{ \App\Enums\LexiconType::tryFrom($lex->type)?->label() ?? $lex->type }}</td>
                            <td>{{ $lex->priority }}</td>
                            <td class="cms-story-row-actions">
                                <a class="icon-btn" href="{{ route('cms.lexicons.edit', $lex) }}" title="Sửa" aria-label="Sửa lexicon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                </a>
                                <form action="{{ route('cms.lexicons.destroy', $lex) }}" method="post" style="display:inline;" onsubmit="return confirm('Xóa mục lexicon này?');">
                                    @csrf
                                    @method('DELETE')
                                    <button type="submit" class="icon-btn icon-btn--danger" title="Xóa" aria-label="Xóa lexicon">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                    </button>
                                </form>
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="5" class="muted" style="padding: 1.5rem; text-align: center;">Chưa có lexicon. Dùng <strong>Mục mới</strong> ở trên (một hoặc nhiều).</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>
    @include('cms.partials.pagination', ['paginator' => $lexicons])
@endsection

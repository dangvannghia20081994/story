@extends('cms.guest')

@section('content')
    <h1>Đăng nhập CMS</h1>
    @if ($errors->any())
        <p class="error" style="margin-bottom: 0.75rem;">{{ $errors->first() }}</p>
    @endif
    <form method="post" action="{{ route('cms.login') }}">
        @csrf
        <div class="field">
            <label for="email">Email</label>
            <input id="email" type="email" name="email" value="{{ old('email') }}" required autocomplete="username">
        </div>
        <div class="field">
            <label for="password">Mật khẩu</label>
            <input id="password" type="password" name="password" required autocomplete="current-password">
        </div>
        <div class="field chk">
            <input id="remember" type="checkbox" name="remember" value="1">
            <label for="remember">Ghi nhớ mật khẩu</label>
        </div>
        <button type="submit" class="btn">Đăng nhập</button>
    </form>
@endsection

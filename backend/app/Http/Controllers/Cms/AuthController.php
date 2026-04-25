<?php

namespace App\Http\Controllers\Cms;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\View\View;

class AuthController extends Controller
{
    public function showLoginForm(): RedirectResponse|View
    {
        if (Auth::check() && Auth::user()->is_admin) {
            return redirect()->route('cms.dashboard');
        }

        return view('cms.auth.login');
    }

    public function login(Request $request): RedirectResponse
    {
        if (Auth::check() && Auth::user()->is_admin) {
            return redirect()->route('cms.dashboard');
        }

        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (! Auth::attempt($credentials, $request->boolean('remember'))) {
            return back()->withErrors(['email' => 'Thông tin đăng nhập không hợp lệ.'])->onlyInput('email');
        }

        $request->session()->regenerate();

        if (! Auth::user()->is_admin) {
            Auth::logout();

            return back()->withErrors(['email' => 'Tài khoản này không có quyền CMS.'])->onlyInput('email');
        }

        return redirect()->intended(route('cms.dashboard'));
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('cms.login');
    }
}

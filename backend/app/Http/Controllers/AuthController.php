<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Throwable;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        \Log::info('Login attempt', [
            'email' => $request->email,
            'password_length' => strlen($request->password),
        ]);

        $user = \App\Models\User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            \Log::warning('Login failed', ['email' => $request->email]);
            throw ValidationException::withMessages([
                'email' => ['The provided credentials do not match our records.'],
            ]);
        }

        if (!$user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['This account is inactive. Please contact your administrator.'],
            ]);
        }

        $token = $user->createToken('web')->plainTextToken;

        return response()->json(array_merge(
            $this->authenticatedUserPayload($user),
            ['token' => $token]
        ));
    }

    public function logout(Request $request)
    {
        $user = $request->user();

        if ($user && $user->currentAccessToken()) {
            $user->currentAccessToken()->delete();
        }

        return response()->noContent();
    }

    public function me(Request $request)
    {
        return response()->json($this->authenticatedUserPayload($request->user()));
    }

    protected function authenticatedUserPayload($user): array
    {
        if (!$user) {
            return ['user' => null];
        }

        try {
            $user->load('roles');
        } catch (Throwable $exception) {
            \Log::warning('Unable to load user roles during auth response', [
                'user_id' => $user->id,
                'error' => $exception->getMessage(),
            ]);
        }

        return ['user' => $user];
    }

}

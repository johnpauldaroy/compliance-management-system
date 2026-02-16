<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        \App\Models\User::observe(\App\Observers\AuditLogObserver::class);
        \App\Models\Agency::observe(\App\Observers\AuditLogObserver::class);
        \App\Models\Requirement::observe(\App\Observers\AuditLogObserver::class);
        \App\Models\RequirementAssignment::observe(\App\Observers\AuditLogObserver::class);
        \App\Models\Upload::observe(\App\Observers\AuditLogObserver::class);

        // Register authentication event listeners
        \Illuminate\Support\Facades\Event::listen(
            \Illuminate\Auth\Events\Login::class,
            \App\Listeners\LogAuthenticationEvents::class
        );
        \Illuminate\Support\Facades\Event::listen(
            \Illuminate\Auth\Events\Logout::class,
            \App\Listeners\LogAuthenticationEvents::class
        );
    }
}

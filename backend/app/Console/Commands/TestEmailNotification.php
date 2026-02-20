<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class TestEmailNotification extends Command
{
    protected $signature = 'notifications:test-email
        {to : Recipient email address}
        {--subject=CMS notification test : Subject line for the test email}';

    protected $description = 'Send a test notification email and print active mail configuration details';

    public function handle(): int
    {
        $to = (string) $this->argument('to');
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
            $this->error("Invalid email address: {$to}");
            return self::FAILURE;
        }

        $mailer = (string) config('mail.default');
        $fromAddress = (string) config('mail.from.address');
        $fromName = (string) config('mail.from.name');

        $this->line("Mailer: {$mailer}");
        $this->line("From: {$fromName} <{$fromAddress}>");

        if ($mailer === 'smtp') {
            $host = (string) config('mail.mailers.smtp.host');
            $port = (string) config('mail.mailers.smtp.port');
            $scheme = (string) (config('mail.mailers.smtp.scheme') ?: 'default');
            $usernameSet = !empty(config('mail.mailers.smtp.username')) ? 'yes' : 'no';
            $passwordSet = !empty(config('mail.mailers.smtp.password')) ? 'yes' : 'no';

            $this->line("SMTP host: {$host}:{$port}");
            $this->line("SMTP scheme: {$scheme}");
            $this->line("SMTP username set: {$usernameSet}");
            $this->line("SMTP password set: {$passwordSet}");
        } elseif (in_array($mailer, ['log', 'array'], true)) {
            $this->warn("Mailer '{$mailer}' will not deliver real emails.");
        }

        $subject = (string) $this->option('subject');
        $body = 'This is a test email from the Compliance Management System sent at ' . now()->toDateTimeString() . '.';

        try {
            Mail::raw($body, function ($message) use ($to, $subject) {
                $message->to($to)->subject($subject);
            });

            $this->info("Test email sent to {$to}.");
            return self::SUCCESS;
        } catch (\Throwable $e) {
            \Log::error('Failed to send test notification email', [
                'to' => $to,
                'mailer' => $mailer,
                'error' => $e->getMessage(),
            ]);

            $this->error('Failed to send test email: ' . $e->getMessage());
            return self::FAILURE;
        }
    }
}

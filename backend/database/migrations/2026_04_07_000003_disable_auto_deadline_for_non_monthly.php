<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        if (!DB::getSchemaBuilder()->hasTable('requirements')) {
            return;
        }

        DB::table('requirements')
            ->where('auto_deadline_enabled', true)
            ->where(function ($query) {
                $query->whereNull('frequency')
                    ->orWhereRaw('LOWER(frequency) NOT LIKE ?', ['%month%']);
            })
            ->update(['auto_deadline_enabled' => false]);
    }

    public function down(): void
    {
        // No-op: data normalization is not reversible.
    }
};

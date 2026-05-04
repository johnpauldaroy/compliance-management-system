<?php

namespace App\Console\Commands;

use App\Models\Upload;
use Carbon\Carbon;
use DateTimeInterface;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PDO;
use Throwable;

class BackupToGoogleDrive extends Command
{
    protected $signature = 'backup:google-drive
        {--target= : Override the configured Google Drive backup folder}
        {--skip-database : Skip the database SQL dump}
        {--skip-files : Skip configured file backups}';

    protected $description = 'Create a daily system backup in a local Google Drive sync folder';

    public function handle(): int
    {
        $targetRoot = $this->option('target') ?: Config::get('backups.google_drive.path');
        if (!$targetRoot) {
            $this->error('GOOGLE_DRIVE_BACKUP_PATH is not configured.');
            $this->line('Set it in backend/.env to the local Google Drive Desktop sync folder, not the browser sharing URL.');
            $this->line('Example: GOOGLE_DRIVE_BACKUP_PATH="G:\My Drive\Compliance CMS Backups"');
            return self::FAILURE;
        }

        $targetRoot = rtrim($targetRoot, "\\/");
        if (!File::isDirectory($targetRoot) && !File::makeDirectory($targetRoot, 0755, true)) {
            $this->error("Backup target does not exist and could not be created: {$targetRoot}");
            return self::FAILURE;
        }

        $backupName = Str::slug((string) config('app.name', 'compliance-cms'))
            . '-backup-' . now()->format('Y-m-d_His');
        $backupPath = $targetRoot . DIRECTORY_SEPARATOR . $backupName;

        File::makeDirectory($backupPath, 0755, true);

        try {
            if ($this->shouldIncludeDatabase()) {
                $this->dumpDatabase($backupPath . DIRECTORY_SEPARATOR . 'database');
            }

            if ($this->shouldIncludeFiles()) {
                $this->copyApprovedFiles($backupPath);
            }

            $this->writeManifest($backupPath);
            $this->pruneOldBackups($targetRoot);
        } catch (Throwable $e) {
            report($e);
            $this->error('Backup failed: ' . $e->getMessage());
            return self::FAILURE;
        }

        $this->info("Backup created: {$backupPath}");
        return self::SUCCESS;
    }

    private function shouldIncludeDatabase(): bool
    {
        return (bool) Config::get('backups.google_drive.include_database', true)
            && !$this->option('skip-database');
    }

    private function shouldIncludeFiles(): bool
    {
        return (bool) Config::get('backups.google_drive.include_files', true)
            && !$this->option('skip-files');
    }

    private function dumpDatabase(string $destination): void
    {
        File::makeDirectory($destination, 0755, true);

        $connectionName = DB::getDefaultConnection();
        $connection = DB::connection($connectionName);
        $config = $connection->getConfig();
        $driver = $config['driver'] ?? null;

        if ($driver === 'sqlite') {
            $database = $config['database'] ?? null;
            if (!$database || $database === ':memory:' || !File::exists($database)) {
                throw new \RuntimeException('SQLite database file could not be found.');
            }

            File::copy($database, $destination . DIRECTORY_SEPARATOR . 'database.sqlite');
            return;
        }

        if (!in_array($driver, ['mysql', 'mariadb'], true)) {
            throw new \RuntimeException("Database backups are not implemented for the {$driver} driver.");
        }

        $databaseName = $config['database'];
        $dumpPath = $destination . DIRECTORY_SEPARATOR . $databaseName . '.sql';
        $handle = fopen($dumpPath, 'wb');

        if (!$handle) {
            throw new \RuntimeException("Unable to write database dump: {$dumpPath}");
        }

        try {
            fwrite($handle, "-- Compliance Management System database backup\n");
            fwrite($handle, '-- Created at: ' . now()->toDateTimeString() . "\n\n");
            fwrite($handle, "SET FOREIGN_KEY_CHECKS=0;\n\n");

            foreach ($this->mysqlTables($databaseName) as $table) {
                $quotedTable = $this->quoteIdentifier($table);
                $createRow = (array) DB::selectOne("SHOW CREATE TABLE {$quotedTable}");
                $createSql = $createRow['Create Table'] ?? array_values($createRow)[1] ?? null;

                if (!$createSql) {
                    continue;
                }

                fwrite($handle, "DROP TABLE IF EXISTS {$quotedTable};\n");
                fwrite($handle, $createSql . ";\n\n");

            foreach ($connection->table($table)->cursor() as $row) {
                    $values = array_map(
                        fn ($value) => $this->quoteValue($connection->getPdo(), $value),
                        (array) $row
                    );

                    fwrite($handle, "INSERT INTO {$quotedTable} VALUES (" . implode(', ', $values) . ");\n");
                }

                fwrite($handle, "\n");
            }

            fwrite($handle, "SET FOREIGN_KEY_CHECKS=1;\n");
        } finally {
            fclose($handle);
        }
    }

    /**
     * @return array<int, string>
     */
    private function mysqlTables(string $databaseName): array
    {
        $rows = DB::select("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
        $nameColumn = 'Tables_in_' . $databaseName;

        return collect($rows)
            ->map(fn ($row) => (array) $row)
            ->map(fn ($row) => $row[$nameColumn] ?? reset($row))
            ->filter()
            ->values()
            ->all();
    }

    private function quoteIdentifier(string $identifier): string
    {
        return '`' . str_replace('`', '``', $identifier) . '`';
    }

    private function quoteValue(PDO $pdo, mixed $value): string
    {
        if ($value === null) {
            return 'NULL';
        }

        if (is_bool($value)) {
            return $value ? '1' : '0';
        }

        if (is_int($value) || is_float($value)) {
            return (string) $value;
        }

        return $pdo->quote((string) $value);
    }

    private function copyApprovedFiles(string $backupPath): void
    {
        $destinationRoot = $backupPath . DIRECTORY_SEPARATOR . 'files';
        $copied = 0;
        $missing = 0;

        $query = Upload::query()
            ->with(['requirement', 'assignment.user', 'uploader', 'submission']);

        if (Config::get('backups.google_drive.approved_only', true)) {
            $query->where('approval_status', 'APPROVED')
                ->whereHas('submission', fn ($query) => $query->where('approval_status', 'APPROVED'));
        }

        $query->chunkById(200, function ($uploads) use ($destinationRoot, &$copied, &$missing) {
                foreach ($uploads as $upload) {
                    if (!$upload->doc_file) {
                        continue;
                    }

                    $disk = Storage::disk(config('filesystems.default'));
                    if (!$disk->exists($upload->doc_file)) {
                        $missing++;
                        $this->warn("Missing approved file: {$upload->doc_file}");
                        continue;
                    }

                    $folder = $this->approvedUploadFolder($upload);
                    $destinationFolder = $destinationRoot . DIRECTORY_SEPARATOR . $folder;
                    File::ensureDirectoryExists($destinationFolder);

                    $filename = $this->approvedUploadFilename($upload);
                    $destination = $this->uniqueDestination(
                        $destinationFolder . DIRECTORY_SEPARATOR . $filename
                    );

                    $sourceStream = $disk->readStream($upload->doc_file);
                    if ($sourceStream === false) {
                        $missing++;
                        $this->warn("Unable to read approved file: {$upload->doc_file}");
                        continue;
                    }

                    $targetStream = fopen($destination, 'wb');
                    if ($targetStream === false) {
                        if (is_resource($sourceStream)) {
                            fclose($sourceStream);
                        }
                        throw new \RuntimeException("Unable to write approved file backup: {$destination}");
                    }

                    stream_copy_to_stream($sourceStream, $targetStream);
                    fclose($targetStream);
                    if (is_resource($sourceStream)) {
                        fclose($sourceStream);
                    }

                    $this->writeApprovedFileMetadata($upload, $destination);
                    $copied++;
                }
            });

        $this->info("Approved files copied: {$copied}");
        if ($missing > 0) {
            $this->warn("Approved file records missing from storage: {$missing}");
        }
    }

    private function writeManifest(string $backupPath): void
    {
        $manifest = [
            'created_at' => now()->toIso8601String(),
            'app_name' => config('app.name'),
            'app_url' => config('app.url'),
            'database_connection' => DB::getDefaultConnection(),
            'included_database' => $this->shouldIncludeDatabase(),
            'included_files' => $this->shouldIncludeFiles(),
            'approved_only' => Config::get('backups.google_drive.approved_only', true),
            'google_drive_folder_url' => Config::get('backups.google_drive.folder_url'),
            'folder_structure' => 'files/{requirement_req_id}/{pic_user_id}/{deadline}/',
        ];

        File::put(
            $backupPath . DIRECTORY_SEPARATOR . 'manifest.json',
            json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        );
    }

    private function approvedUploadFolder(Upload $upload): string
    {
        $requirementId = $upload->requirement?->req_id
            ?: 'REQ-' . ($upload->requirement_id ?: 'unknown');
        $picId = $upload->assignment?->user?->user_id
            ?: $upload->uploader?->user_id
            ?: $upload->uploader_email
            ?: 'PIC-unknown';
        $deadline = $this->dateString($upload->deadline_at_upload)
            ?: $this->dateString($upload->assignment?->deadline)
            ?: $this->dateString($upload->requirement?->deadline)
            ?: 'no-deadline';

        return implode(DIRECTORY_SEPARATOR, [
            $this->safeFolderName($requirementId),
            $this->safeFolderName($picId),
            $this->safeFolderName($deadline),
        ]);
    }

    private function approvedUploadFilename(Upload $upload): string
    {
        $name = $upload->original_file_name ?: basename((string) $upload->doc_file);
        $name = $this->safeFileName($name);

        return $upload->upload_id
            ? $this->safeFileName($upload->upload_id . '-' . $name)
            : $name;
    }

    private function writeApprovedFileMetadata(Upload $upload, string $destination): void
    {
        $metadata = [
            'upload_id' => $upload->upload_id,
            'submission_id' => $upload->submission?->submission_id,
            'requirement_id' => $upload->requirement?->req_id,
            'pic_user_id' => $upload->assignment?->user?->user_id ?: $upload->uploader?->user_id,
            'pic_name' => $upload->assignment?->user?->employee_name ?: $upload->uploader?->employee_name,
            'deadline' => $this->dateString($upload->deadline_at_upload),
            'approval_status' => $upload->approval_status,
            'approved_at' => $this->dateTimeString($upload->status_change_on),
            'original_file_name' => $upload->original_file_name,
            'source_storage_path' => $upload->doc_file,
        ];

        File::put(
            $destination . '.metadata.json',
            json_encode($metadata, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        );
    }

    private function uniqueDestination(string $path): string
    {
        if (!File::exists($path)) {
            return $path;
        }

        $directory = dirname($path);
        $extension = pathinfo($path, PATHINFO_EXTENSION);
        $filename = pathinfo($path, PATHINFO_FILENAME);

        for ($i = 2; $i < 1000; $i++) {
            $candidate = $directory . DIRECTORY_SEPARATOR . $filename . '-' . $i;
            if ($extension) {
                $candidate .= '.' . $extension;
            }

            if (!File::exists($candidate)) {
                return $candidate;
            }
        }

        throw new \RuntimeException("Unable to create unique backup filename for {$path}");
    }

    private function safeFolderName(string $value): string
    {
        $value = trim($value);
        $value = preg_replace('/[<>:"\/\\\\|?*\x00-\x1F]+/', '-', $value) ?: 'unknown';

        return trim($value, ". \t\n\r\0\x0B") ?: 'unknown';
    }

    private function safeFileName(string $value): string
    {
        return $this->safeFolderName($value);
    }

    private function dateString(mixed $value): ?string
    {
        if (!$value) {
            return null;
        }

        if ($value instanceof DateTimeInterface) {
            return $value->format('Y-m-d');
        }

        return Carbon::parse((string) $value)->toDateString();
    }

    private function dateTimeString(mixed $value): ?string
    {
        if (!$value) {
            return null;
        }

        if ($value instanceof DateTimeInterface) {
            return $value->format(DateTimeInterface::ATOM);
        }

        return Carbon::parse((string) $value)->toIso8601String();
    }

    private function pruneOldBackups(string $targetRoot): void
    {
        $retentionDays = (int) Config::get('backups.google_drive.retention_days', 30);
        if ($retentionDays <= 0) {
            return;
        }

        $cutoff = now()->subDays($retentionDays)->getTimestamp();
        $prefix = Str::slug((string) config('app.name', 'compliance-cms')) . '-backup-';

        foreach (File::directories($targetRoot) as $directory) {
            if (!str_starts_with(basename($directory), $prefix)) {
                continue;
            }

            if (File::lastModified($directory) < $cutoff) {
                File::deleteDirectory($directory);
            }
        }
    }
}

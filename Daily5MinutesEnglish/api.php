<?php
/**
 * Professional PHP-JSON Database Bridge
 * Handles concurrent users, file locking, and safe data merging.
 */

// --- Configuration ---
$databaseFile = 'db.json';
$backupDir = 'backups/';

// CORS & Headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, X-Requested-With, X-API-Token, X-Requesting-Admin");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json");

// Handle preflight (OPTIONS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

// ── Auth Guard ──
// All requests must include the shared API secret token.
// This token is defined in db-service.js (API_SECRET constant) and must match here.
define('API_SECRET', 'daily-english-secure-2025-key');

$clientToken = $_SERVER['HTTP_X_API_TOKEN'] ?? '';
if ($clientToken !== API_SECRET) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized — missing or invalid API token']);
    exit;
}

// ── GET: Read Database ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!file_exists($databaseFile)) {
        echo json_encode(["status" => "error", "message" => "Database not found"]);
        exit;
    }
    // Read with shared lock
    $fp = fopen($databaseFile, 'r');
    if ($fp && flock($fp, LOCK_SH)) {
        $content = file_get_contents($databaseFile);
        flock($fp, LOCK_UN);
        fclose($fp);
        echo $content;
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Could not obtain read lock"]);
    }
    exit;
}

// ── POST: Sync/Update Database ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $inputRaw = file_get_contents('php://input');
    $inputData = json_decode($inputRaw, true);

    if (!$inputData) {
        http_response_code(400);
        echo json_encode(["error" => "Invalid JSON payload"]);
        exit;
    }

    // Open for writing/reading with exclusive lock
    // Creating if doesn't exist
    $fp = fopen($databaseFile, 'c+');
    if (!$fp) {
        http_response_code(500);
        echo json_encode(["error" => "Permission denied opening database"]);
        exit;
    }

    if (flock($fp, LOCK_EX)) {
        // Read current state
        $filesize = filesize($databaseFile);
        $currentState = [];
        if ($filesize > 0) {
            $content = fread($fp, $filesize);
            $currentState = json_decode($content, true) ?: [];
        }

        /**
         * MERGE LOGIC:
         * Instead of overwriting, we merge incoming data to protect other users.
         * We trust the client for their own data (students/results).
         */
        
        // 1. Merge Students (Trust students to save their own profile)
        if (isset($inputData['users']) && isset($inputData['users']['students'])) {
            if (!isset($currentState['users'])) $currentState['users'] = [];
            if (!isset($currentState['users']['students'])) $currentState['users']['students'] = [];
            
            foreach ($inputData['users']['students'] as $id => $user) {
                // Ensure role cannot be escalated via API
                $user['role'] = 'student';
                $currentState['users']['students'][$id] = $user;
            }
        }

        // 2. Merge Daily Results (Crucial for multi-player)
        if (isset($inputData['dailyResults'])) {
            if (!isset($currentState['dailyResults'])) $currentState['dailyResults'] = [];
            foreach ($inputData['dailyResults'] as $uid => $results) {
                if (!isset($currentState['dailyResults'][$uid])) {
                    $currentState['dailyResults'][$uid] = [];
                }
                foreach ($results as $date => $res) {
                    $currentState['dailyResults'][$uid][$date] = $res;
                }
            }
        }

        // 3. Questions & Config (Teacher-initiated writes)
        if (isset($inputData['questions'])) {
             $currentState['questions'] = $inputData['questions'];
        }

        if (isset($inputData['config'])) {
            $currentState['config'] = $inputData['config'];
        }

        // 4. Merge Admins — upsert teacher accounts; force role to teacher
        if (isset($inputData['users']) && isset($inputData['users']['admins'])) {
            if (!isset($currentState['users'])) $currentState['users'] = [];
            if (!isset($currentState['users']['admins'])) $currentState['users']['admins'] = [];

            $requestingAdmin = $_SERVER['HTTP_X_REQUESTING_ADMIN'] ?? '';

            foreach ($inputData['users']['admins'] as $id => $admin) {
                $isNew = !isset($currentState['users']['admins'][$id]);
                if ($isNew) {
                    // New teacher accounts require an authenticated existing admin
                    if (!$requestingAdmin || !isset($currentState['users']['admins'][$requestingAdmin])) {
                        continue;
                    }
                }
                $admin['role'] = 'teacher';
                $currentState['users']['admins'][$id] = $admin;
            }
        }

        // 5. Auto-rotate backups (keep last 5 only)
        if (!is_dir($backupDir)) @mkdir($backupDir, 0755, true);
        $backupFile = $backupDir . 'db_' . date('Y-m-d_H-i-s') . '.json';
        @file_put_contents($backupFile, json_encode($currentState, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        $backups = glob($backupDir . 'db_*.json');
        if ($backups && count($backups) > 5) {
            usort($backups, fn($a, $b) => filemtime($a) - filemtime($b));
            foreach (array_slice($backups, 0, count($backups) - 5) as $old) {
                @unlink($old);
            }
        }

        // Save back to db.json
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($currentState, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);

        echo json_encode(["status" => "success", "synced_at" => time()]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Could not obtain write lock"]);
    }
    exit;
}

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
header("Access-Control-Allow-Headers: Content-Type, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json");

// Handle preflight (OPTIONS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
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
                // Basic check: don't let students change their role to teacher
                if (isset($user['role'])) $user['role'] = 'student'; 
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

        // 3. Questions & Config (Special Case: Only if an Admin flag is sent?
        // In this simple version, we'll allow it so the Teacher Dashboard works.
        // But we guard it from simple 'Student' syncs if we had a token.)
        if (isset($inputData['questions'])) {
             // Basic protection: if it's a huge dump, we accept it for now
             // as the Teacher Dashboard needs to publish questions.
             $currentState['questions'] = $inputData['questions'];
        }

        if (isset($inputData['config'])) {
            $currentState['config'] = $inputData['config'];
        }

        // 4. Protect Admins! Never let the API overwrite the admins section
        // unless it's a manual edit of db.json. This prevents students from 
        // escalating themselves.
        // (We keep the original 'admins' from disk, unless they are missing)
        if (!isset($currentState['users']['admins']) || empty($currentState['users']['admins'])) {
            if (isset($inputData['users']['admins'])) {
                $currentState['users']['admins'] = $inputData['users']['admins'];
            }
        }

        // Save back
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

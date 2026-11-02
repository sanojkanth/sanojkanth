<?php
/**
 * Settings API
 * GET  → Returns current settings (all authenticated users)
 * POST → Saves settings (Admin only)
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        getSettings();
        break;
    case 'POST':
        saveSettings();
        break;
    default:
        jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
}

/* ── GET all settings ──────────────────────────────────────────────────── */
function getSettings() {
    // Any authenticated user may read settings
    requireAuth();

    $db   = getDB();
    $stmt = $db->query("SELECT setting_key, setting_value FROM settings");
    $rows = $stmt->fetchAll();

    $settings = [];
    foreach ($rows as $row) {
        $settings[$row['setting_key']] = $row['setting_value'];
    }

    jsonResponse(['success' => true, 'data' => $settings]);
}

/* ── POST save settings (Admin only) ──────────────────────────────────── */
function saveSettings() {
    // Must be logged in
    $user = requireAuth();

    // Must be Admin role
    $role = strtolower($user['role'] ?? '');
    if ($role !== 'admin') {
        jsonResponse(['success' => false, 'error' => 'Access denied. Only Admin users can change system settings.'], 403);
    }

    $data = getRequestBody();
    if (empty($data)) {
        jsonResponse(['success' => false, 'error' => 'No settings data provided.'], 400);
    }

    $db   = getDB();
    $stmt = $db->prepare(
        "INSERT INTO settings (setting_key, setting_value) VALUES (:k, :v)
         ON DUPLICATE KEY UPDATE setting_value = :v2"
    );

    // Only allow recognised keys to be saved
    $allowedKeys = [
        'storeName', 'location', 'email', 'phone',
        'currency', 'taxRate', 'stockThreshold', 'expenseApprovalThreshold', 'invPrefix'
    ];

    foreach ($allowedKeys as $key) {
        if (array_key_exists($key, $data)) {
            $stmt->execute([
                'k'  => $key,
                'v'  => $data[$key],
                'v2' => $data[$key]
            ]);
        }
    }

    // Log activity
    $db->prepare(
        "INSERT INTO activity_logs (user, action, details, log_date, login_time, status)
         VALUES (:u, 'Update Settings', 'Admin updated system settings', :dt, :t, 'Closed')"
    )->execute([
        'u'  => $user['name'],
        'dt' => date('Y-m-d'),
        't'  => date('h:i:s A')
    ]);

    jsonResponse(['success' => true, 'message' => 'Settings saved successfully.']);
}
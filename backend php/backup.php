<?php
/**
 * Full System Backup & Restore API
 * GET  -> Export all managed tables as JSON payload
 * POST -> Restore full payload from a previous backup export
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            exportBackup();
            break;
        case 'POST':
            restoreBackup();
            break;
        default:
            jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
    }
} catch (Exception $e) {
    jsonResponse(['success' => false, 'error' => 'Backup error: ' . $e->getMessage()], 500);
}

// Export Backup
function exportBackup() {
    $user = requireAdminUser();
    $db = getDB();
    $tables = getManagedBackupTables();
    $payload = [
        'metadata' => [
            'app' => 'Central Hardwares',
            'version' => 1,
            'exported_at' => date('c'),
            'exported_by' => $user['name'] ?? 'Admin',
            'table_counts' => []
        ],
        'tables' => []
    ];

    foreach ($tables as $table) {
        $rows = $db->query("SELECT * FROM `{$table}`")->fetchAll();
        $payload['tables'][$table] = $rows;
        $payload['metadata']['table_counts'][$table] = count($rows);
    }

    logBackupAction($db, 'Export Backup', 'Downloaded full system backup.');
    jsonResponse(['success' => true, 'data' => $payload]);
}

// Restore Backup
function restoreBackup() {
    $user = requireAdminUser();
    $db = getDB();
    $body = getRequestBody();
    $backup = $body['backup'] ?? null;

    if (!is_array($backup) || !isset($backup['tables']) || !is_array($backup['tables'])) {
        jsonResponse(['success' => false, 'error' => 'Invalid backup payload.'], 400);
    }

    $insertOrder = getManagedBackupTables();
    $deleteOrder = array_reverse($insertOrder);
    $tableCounts = [];

    $db->beginTransaction();
    try {
        $db->exec("SET FOREIGN_KEY_CHECKS = 0");

        foreach ($deleteOrder as $table) {
            $db->exec("DELETE FROM `{$table}`");
        }

        foreach ($insertOrder as $table) {
            $rows = $backup['tables'][$table] ?? [];
            if (!is_array($rows)) {
                throw new RuntimeException("Invalid rows supplied for table {$table}.");
            }

            restoreTableRows($db, $table, $rows);
            $tableCounts[$table] = count($rows);
        }

        foreach (getAutoIncrementBackupTables() as $table) {
            resetTableAutoIncrement($db, $table);
        }

        $db->exec("SET FOREIGN_KEY_CHECKS = 1");
        $db->commit();
    } catch (Exception $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        try {
            $db->exec("SET FOREIGN_KEY_CHECKS = 1");
        } catch (Exception $ignored) {}
        throw $e;
    }

    logBackupAction($db, 'Restore Backup', 'Restored full system backup from uploaded file.');
    jsonResponse([
        'success' => true,
        'message' => 'System backup restored successfully.',
        'data' => [
            'restored_by' => $user['name'] ?? 'Admin',
            'restored_at' => date('c'),
            'table_counts' => $tableCounts
        ]
    ]);
}

// Restore Table Rows
function restoreTableRows($db, $table, $rows) {
    if (empty($rows)) {
        return;
    }

    $describeStmt = $db->query("DESCRIBE `{$table}`");
    $columns = array_column($describeStmt->fetchAll(), 'Field');
    $rowKeys = [];

    foreach ($rows as $row) {
        if (!is_array($row)) {
            throw new RuntimeException("Invalid row format in table {$table}.");
        }
        foreach (array_keys($row) as $key) {
            $rowKeys[$key] = true;
        }
    }

    $insertColumns = array_values(array_filter($columns, function ($column) use ($rowKeys) {
        return isset($rowKeys[$column]);
    }));

    if (empty($insertColumns)) {
        return;
    }

    $quotedColumns = '`' . implode('`, `', $insertColumns) . '`';
    $placeholders = implode(', ', array_fill(0, count($insertColumns), '?'));
    $stmt = $db->prepare("INSERT INTO `{$table}` ({$quotedColumns}) VALUES ({$placeholders})");

    foreach ($rows as $row) {
        $values = [];
        foreach ($insertColumns as $column) {
            $values[] = array_key_exists($column, $row) ? $row[$column] : null;
        }
        $stmt->execute($values);
    }
}

// Reset Table Auto Increment
function resetTableAutoIncrement($db, $table) {
    $maxId = (int)$db->query("SELECT COALESCE(MAX(id), 0) FROM `{$table}`")->fetchColumn();
    $nextId = max(1, $maxId + 1);
    $db->exec("ALTER TABLE `{$table}` AUTO_INCREMENT = {$nextId}");
}

// Get Managed Backup Tables
function getManagedBackupTables() {
    return [
        'users',
        'products',
        'customers',
        'suppliers',
        'orders',
        'order_items',
        'invoices',
        'invoice_items',
        'finance_income',
        'finance_expenses',
        'services',
        'warranties',
        'staff_members',
        'settings',
        'activity_logs'
    ];
}

// Get Auto Increment Backup Tables
function getAutoIncrementBackupTables() {
    return [
        'users',
        'products',
        'customers',
        'suppliers',
        'orders',
        'order_items',
        'invoice_items',
        'finance_income',
        'finance_expenses',
        'staff_members',
        'settings',
        'activity_logs'
    ];
}

// Require Admin User
function requireAdminUser() {
    $user = requireAuth();
    if (strtolower($user['role'] ?? '') !== 'admin') {
        jsonResponse(['success' => false, 'error' => 'Only Admin users can manage backups.'], 403);
    }
    return $user;
}

// Log Backup Action
function logBackupAction($db, $action, $details) {
    try {
        $user = $_SESSION['user']['name'] ?? 'System';
        $db->prepare("INSERT INTO activity_logs (user, action, details, log_date, login_time, status)
            VALUES (:user, :action, :details, :log_date, :login_time, 'Closed')")
           ->execute([
               'user' => $user,
               'action' => $action,
               'details' => $details,
               'log_date' => date('Y-m-d'),
               'login_time' => date('h:i:s A')
           ]);
    } catch (Exception $e) {
        error_log('Backup log failed: ' . $e->getMessage());
    }
}
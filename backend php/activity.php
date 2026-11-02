<?php
/**
 * Activity Logs API
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($method) {
    case 'GET':
        if ($action === 'stats') { getActivityStats(); }
        else { getAllActivity(); }
        break;
    case 'DELETE':
        clearActivity();
        break;
    default:
        jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
}

// Get All Activity
function getAllActivity() {
    $db = getDB();
    $search = $_GET['search'] ?? '';

    $sql = "SELECT * FROM activity_logs WHERE 1=1";
    $params = [];

    if ($search) {
        $sql .= " AND (user LIKE :s1 OR action LIKE :s2 OR details LIKE :s3 OR log_date LIKE :s4 OR status LIKE :s5)";
        $params['s1'] = "%$search%";
        $params['s2'] = "%$search%";
        $params['s3'] = "%$search%";
        $params['s4'] = "%$search%";
        $params['s5'] = "%$search%";
    }

    $sql .= " ORDER BY id DESC";
    
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $data = $stmt->fetchAll();

    foreach ($data as &$row) {
        if ($row['status'] === 'Active') {
            $created = strtotime($row['created_at']);
            $diffMinutes = max(0, round((time() - $created) / 60));
            $hours = floor($diffMinutes / 60);
            $mins = $diffMinutes % 60;
            $row['duration'] = $hours > 0 ? "{$hours}h {$mins}m" : "{$mins}m";
        }
    }

    jsonResponse(['success' => true, 'data' => $data]);
}

// Get Activity Stats
function getActivityStats() {
    $db = getDB();
    $today = date('Y-m-d');

    $active = $db->query("SELECT COUNT(*) FROM activity_logs WHERE status = 'Active'")->fetchColumn();
    
    $stmt = $db->prepare("SELECT COUNT(*) FROM activity_logs WHERE action IN ('User Login', 'Login') AND log_date = :d");
    $stmt->execute(['d' => $today]);
    $loginsToday = $stmt->fetchColumn();

    $total = $db->query("SELECT COUNT(*) FROM activity_logs")->fetchColumn();

    jsonResponse(['success' => true, 'data' => [
        'active' => (int)$active,
        'loginsToday' => (int)$loginsToday,
        'total' => (int)$total
    ]]);
}

// Clear Activity
function clearActivity() {
    $db = getDB();
    $db->query("TRUNCATE TABLE activity_logs");
    jsonResponse(['success' => true, 'message' => 'Activity logs cleared']);
}
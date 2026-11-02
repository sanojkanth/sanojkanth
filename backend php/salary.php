<?php
/**
 * Salary Calculation API
 * GET /api/salary.php - Get all staff salaries with calculations
 * GET /api/salary.php?staff_id=1 - Get specific staff salary
 * POST /api/salary.php?action=update-rates - Update hourly rates
 */
require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? 'list';
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($action) {
        case 'list':
            if ($method === 'GET') {
                listStaffSalaries();
            }
            break;
        case 'update-rates':
            if ($method === 'POST') {
                updateStaffRates();
            }
            break;
        case 'detail':
            if ($method === 'GET') {
                getStaffSalaryDetail();
            }
            break;
        default:
            jsonResponse(['success' => false, 'error' => 'Invalid action'], 400);
    }
} catch (Exception $e) {
    jsonResponse(['success' => false, 'error' => 'Server error: ' . $e->getMessage()], 500);
}

// List Staff Salaries
function listStaffSalaries() {
    $db = getDB();
    $staffId = $_GET['staff_id'] ?? null;

    try {
        // Add hourly_rate column to staff_members if it doesn't exist
        try {
            $db->exec("ALTER TABLE staff_members ADD COLUMN hourly_rate DECIMAL(10, 2) DEFAULT 500");
        } catch (Exception $e) {}

        // Get staff with calculated salaries
        $query = "
            SELECT 
                sm.id,
                sm.name,
                sm.role,
                sm.hourly_rate,
                sm.phone,
                sm.status,
                COUNT(DISTINCT al.log_date) as login_days,
                SUM(CASE 
                    WHEN al.duration LIKE '%h%m%' THEN 
                        (CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(al.duration, 'h', 1), ' ', -1) AS UNSIGNED) * 60 +
                         CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(al.duration, 'm', 1), 'h', -1) AS UNSIGNED)) / 60.0
                    WHEN al.duration LIKE '%h%' THEN
                        CAST(SUBSTRING_INDEX(al.duration, 'h', 1) AS UNSIGNED)
                    WHEN al.duration LIKE '%m%' THEN
                        CAST(SUBSTRING_INDEX(al.duration, 'm', 1) AS UNSIGNED) / 60.0
                    ELSE 0
                END) as total_hours,
                (sm.hourly_rate * SUM(CASE 
                    WHEN al.duration LIKE '%h%m%' THEN 
                        (CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(al.duration, 'h', 1), ' ', -1) AS UNSIGNED) * 60 +
                         CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(al.duration, 'm', 1), 'h', -1) AS UNSIGNED)) / 60.0
                    WHEN al.duration LIKE '%h%' THEN
                        CAST(SUBSTRING_INDEX(al.duration, 'h', 1) AS UNSIGNED)
                    WHEN al.duration LIKE '%m%' THEN
                        CAST(SUBSTRING_INDEX(al.duration, 'm', 1) AS UNSIGNED) / 60.0
                    ELSE 0
                END)) as total_salary
            FROM staff_members sm
            LEFT JOIN activity_logs al ON al.user = sm.name AND al.status = 'Closed'
        ";

        if ($staffId) {
            $query .= " WHERE sm.id = :staff_id";
        }

        $query .= " GROUP BY sm.id, sm.name, sm.role, sm.hourly_rate, sm.phone, sm.status
                   ORDER BY sm.role DESC, sm.name ASC";

        $stmt = $db->prepare($query);
        if ($staffId) {
            $stmt->execute(['staff_id' => $staffId]);
        } else {
            $stmt->execute();
        }

        $staffSalaries = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Get detailed logs for each staff
        foreach ($staffSalaries as &$staff) {
            $logsStmt = $db->prepare("
                SELECT 
                    log_date,
                    login_time,
                    logout_time,
                    duration,
                    status,
                    id
                FROM activity_logs 
                WHERE user = :user AND status = 'Closed'
                ORDER BY log_date DESC
            ");
            $logsStmt->execute(['user' => $staff['name']]);
            $staff['logs'] = $logsStmt->fetchAll(PDO::FETCH_ASSOC);
        }

        // Calculate totals
        $totalSalary = array_sum(array_map(function($s) { return floatval($s['total_salary'] ?? 0); }, $staffSalaries));
        $totalHours = array_sum(array_map(function($s) { return floatval($s['total_hours'] ?? 0); }, $staffSalaries));

        jsonResponse([
            'success' => true,
            'data' => [
                'staffs' => $staffSalaries,
                'meta' => [
                    'total_salary' => round($totalSalary, 2),
                    'total_hours' => round($totalHours, 2),
                    'staff_count' => count($staffSalaries),
                    'currency' => 'LKR'
                ]
            ]
        ]);
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'error' => 'Failed to fetch salary data: ' . $e->getMessage()], 500);
    }
}

// Get Staff Salary Detail
function getStaffSalaryDetail() {
    $db = getDB();
    $staffId = $_GET['staff_id'] ?? null;

    if (!$staffId) {
        jsonResponse(['success' => false, 'error' => 'Staff ID required'], 400);
        return;
    }

    try {
        // Get staff info
        $stmt = $db->prepare("SELECT * FROM staff_members WHERE id = :id");
        $stmt->execute(['id' => $staffId]);
        $staff = $stmt->fetch();

        if (!$staff) {
            jsonResponse(['success' => false, 'error' => 'Staff not found'], 404);
            return;
        }

        // Get activity logs for this staff
        $logsStmt = $db->prepare("
            SELECT 
                id,
                log_date,
                login_time,
                logout_time,
                duration,
                status,
                action,
                details
            FROM activity_logs 
            WHERE user = :user 
            ORDER BY log_date DESC, login_time DESC
        ");
        $logsStmt->execute(['user' => $staff['name']]);
        $logs = $logsStmt->fetchAll(PDO::FETCH_ASSOC);

        // Calculate totals
        $totalHours = 0;
        $closedLogs = [];

        foreach ($logs as $log) {
            if ($log['status'] === 'Closed' && preg_match('/(\d+)h\s*(\d+)m/', $log['duration'], $matches)) {
                $hours = intval($matches[1]);
                $minutes = intval($matches[2]);
                $totalHours += $hours + ($minutes / 60);
                $closedLogs[] = $log;
            }
        }

        $totalSalary = $totalHours * floatval($staff['hourly_rate'] ?? 500);

        jsonResponse([
            'success' => true,
            'data' => [
                'staff' => $staff,
                'total_hours' => round($totalHours, 2),
                'total_salary' => round($totalSalary, 2),
                'hourly_rate' => floatval($staff['hourly_rate'] ?? 500),
                'logs' => $closedLogs
            ]
        ]);
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'error' => 'Error fetching staff details: ' . $e->getMessage()], 500);
    }
}

// Update Staff Rates
function updateStaffRates() {
    // Check admin permission (optional but recommended)
    $data = getRequestBody();
    $updates = $data['updates'] ?? [];

    if (empty($updates) || !is_array($updates)) {
        jsonResponse(['success' => false, 'error' => 'Invalid updates format'], 400);
        return;
    }

    try {
        $db = getDB();
        $successCount = 0;

        foreach ($updates as $update) {
            $staffId = $update['staff_id'] ?? null;
            $hourlyRate = floatval($update['hourly_rate'] ?? 0);

            if (!$staffId || $hourlyRate <= 0) {
                continue;
            }

            $stmt = $db->prepare("UPDATE staff_members SET hourly_rate = :rate WHERE id = :id");
            $stmt->execute(['rate' => $hourlyRate, 'id' => $staffId]);
            $successCount += $stmt->rowCount();
        }

        jsonResponse(['success' => true, 'message' => "Updated $successCount staff hourly rates"]);
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'error' => 'Failed to update rates: ' . $e->getMessage()], 500);
    }
}
?>
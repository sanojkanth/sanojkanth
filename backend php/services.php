<?php
/**
 * Services, Warranties & Staff API
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$type = $_GET['type'] ?? ''; // 'service', 'warranty', 'staff'
$id = $_GET['id'] ?? null;
$action = $_GET['action'] ?? '';

try {
    switch ($method) {
        case 'GET':
            if ($action === 'stats') { getServiceStats(); }
            elseif ($action === 'performance') { getPerformanceMetrics(); }
            else { getAllData($type); }
            break;
        case 'POST':
            createData($type);
            break;
        case 'DELETE':
            deleteData($type, $id);
            break;
        default:
            jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
    }
} catch (Exception $e) {
    jsonResponse(['success' => false, 'error' => 'Server error: ' . $e->getMessage()], 500);
}

// Get All Data
function getAllData($type) {
    if (!$type) jsonResponse(['success' => false, 'error' => 'Type required'], 400);
    $db = getDB();
    $search = $_GET['search'] ?? '';

    if ($type === 'service') {
        $filter = $_GET['filter'] ?? 'all';
        $sql = "SELECT * FROM services WHERE 1=1";
        $params = [];
        if ($filter !== 'all') {
            $sql .= " AND (type = :f1 OR status = :f2 OR delivery = :f3)";
            $params['f1'] = $filter; $params['f2'] = $filter; $params['f3'] = $filter;
        }
        if ($search) {
            $sql .= " AND (id LIKE :s1 OR customer LIKE :s2 OR staff LIKE :s3 OR email LIKE :s4)";
            $params['s1'] = "%$search%"; $params['s2'] = "%$search%"; $params['s3'] = "%$search%"; $params['s4'] = "%$search%";
        }
        $sql .= " ORDER BY created_at DESC";
        $stmt = $db->prepare($sql); $stmt->execute($params);
        jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);

    } elseif ($type === 'warranty') {
        $sql = "SELECT * FROM warranties ORDER BY id DESC";
        $params = [];
        if ($search) {
            $sql .= " WHERE serial_number LIKE :s1 OR product LIKE :s2 OR customer LIKE :s3";
            $params['s1'] = "%$search%"; $params['s2'] = "%$search%"; $params['s3'] = "%$search%";
        }
        $stmt = $db->prepare($sql); $stmt->execute($params);
        jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);

    } elseif ($type === 'staff') {
        $sql = "SELECT * FROM staff_members";
        $stmt = $db->query($sql);
        jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
    }
}

// Create Data
function createData($type) {
    if (!$type) jsonResponse(['success' => false, 'error' => 'Type required'], 400);
    $data = getRequestBody();
    $db = getDB();

    if ($type === 'service') {
        $id = $data['id'] ?? null;
        if ($id) {
            $stmt = $db->prepare("UPDATE services SET customer = :customer, email = :email, type = :type, priority = :priority, status = :status, delivery = :delivery, staff = :staff, cost = :cost, phone = :phone, address = :address, eta = :eta, assigned_at = :assigned_at, en_route_at = :en_route_at, on_site_at = :on_site_at, completed_at = :completed_at, notes = :notes, rating = :rating WHERE id = :id");
            $stmt->execute([
                'id' => $id,
                'customer' => $data['customer'],
                'email' => $data['email'] ?? null,
                'type' => $data['type'] ?? 'Repair',
                'priority' => $data['priority'] ?? 'Medium',
                'status' => $data['status'] ?? 'Requested',
                'delivery' => $data['delivery'] ?? 'Pending',
                'staff' => $data['staff'] ?? 'Unassigned',
                'cost' => $data['cost'] ?? 0,
                'phone' => $data['phone'] ?? null,
                'address' => $data['address'] ?? null,
                'eta' => $data['eta'] ?? null,
                'assigned_at' => $data['assigned_at'] ?? null,
                'en_route_at' => $data['en_route_at'] ?? null,
                'on_site_at' => $data['on_site_at'] ?? null,
                'completed_at' => $data['completed_at'] ?? null,
                'notes' => $data['notes'] ?? null,
                'rating' => $data['rating'] ?? null
            ]);
            safeLogAction($db, 'Service', 'Updated service ' . $id);
            jsonResponse(['success' => true, 'id' => $id], 200);
            return;
        }

        $stmt = $db->query("SELECT id FROM services ORDER BY id DESC LIMIT 1");
        $last = $stmt->fetch();
        if ($last) {
            $num = (int)str_replace('SVC-', '', $last['id']);
            $id = 'SVC-' . ($num + 1);
        } else {
            $id = 'SVC-1001';
        }

        $stmt = $db->prepare("INSERT INTO services (id, customer, email, type, priority, status, delivery, staff, cost, phone, address, service_date, eta, assigned_at, en_route_at, on_site_at, completed_at, notes, rating) VALUES (:id, :customer, :email, :type, :priority, :status, :delivery, :staff, :cost, :phone, :address, :date, :eta, :assigned_at, :en_route_at, :on_site_at, :completed_at, :notes, :rating)");
        $stmt->execute([
            'id' => $id,
            'customer' => $data['customer'],
            'email' => $data['email'] ?? null,
            'type' => $data['type'] ?? 'Repair',
            'priority' => $data['priority'] ?? 'Medium',
            'status' => $data['status'] ?? 'Requested',
            'delivery' => $data['delivery'] ?? 'Pending',
            'staff' => $data['staff'] ?? 'Unassigned',
            'cost' => $data['cost'] ?? 0,
            'phone' => $data['phone'] ?? null,
            'address' => $data['address'] ?? null,
            'date' => $data['date'] ?? date('Y-m-d'),
            'eta' => $data['eta'] ?? null,
            'assigned_at' => $data['assigned_at'] ?? null,
            'en_route_at' => $data['en_route_at'] ?? null,
            'on_site_at' => $data['on_site_at'] ?? null,
            'completed_at' => $data['completed_at'] ?? null,
            'notes' => $data['notes'] ?? null,
            'rating' => $data['rating'] ?? null
        ]);
        safeLogAction($db, 'Service', 'Created service ' . $id);
        jsonResponse(['success' => true, 'id' => $id], 201);

    } elseif ($type === 'warranty') {
        $id = $data['id'] ?? null;
        if ($id) {
            $stmt = $db->prepare("UPDATE warranties SET serial_number = :sn, product = :product, customer = :customer, cycle = :cycle, next_service = :next, status = :status WHERE id = :id");
            $stmt->execute([
                'id' => $id,
                'sn' => $data['sn'],
                'product' => $data['product'],
                'customer' => $data['customer'],
                'cycle' => $data['cycle'] ?? '6 Months',
                'next' => $data['nextService'] ?? null,
                'status' => $data['status'] ?? 'Active'
            ]);
            safeLogAction($db, 'Warranty', 'Updated warranty ' . $id);
            jsonResponse(['success' => true, 'id' => $id], 200);
            return;
        }

        $id = 'WRN-' . rand(1000, 9999);
        $stmt = $db->prepare("INSERT INTO warranties (id, serial_number, product, customer, cycle, next_service, status) VALUES (:id, :sn, :product, :customer, :cycle, :next, :status)");
        $stmt->execute([
            'id' => $id,
            'sn' => $data['sn'],
            'product' => $data['product'],
            'customer' => $data['customer'],
            'cycle' => $data['cycle'] ?? '6 Months',
            'next' => $data['nextService'] ?? null,
            'status' => $data['status'] ?? 'Active'
        ]);
        safeLogAction($db, 'Warranty', 'Registered warranty ' . $id);
        jsonResponse(['success' => true, 'id' => $id], 201);

    } elseif ($type === 'staff') {
        $stmt = $db->prepare("INSERT INTO staff_members (name, role, phone, status, tasks) VALUES (:name, :role, :phone, :status, 0)");
        $stmt->execute([
            'name' => $data['name'],
            'role' => $data['role'] ?? 'Technician',
            'phone' => $data['phone'] ?? null,
            'status' => $data['status'] ?? 'Active'
        ]);
        safeLogAction($db, 'Staff', 'Added staff member ' . $data['name']);
        jsonResponse(['success' => true, 'id' => $db->lastInsertId()], 201);
    }
}



// Delete Data
function deleteData($type, $id) {
    if (!$type || !$id) jsonResponse(['success' => false, 'error' => 'Type and ID required'], 400);
    $db = getDB();

    if ($type === 'service') {
        $db->prepare("DELETE FROM services WHERE id = :id")->execute(['id' => $id]);
        safeLogAction($db, 'Service', 'Deleted service ' . $id);
    } elseif ($type === 'warranty') {
        $db->prepare("DELETE FROM warranties WHERE id = :id")->execute(['id' => $id]);
        safeLogAction($db, 'Warranty', 'Deleted warranty ' . $id);
    } elseif ($type === 'staff') {
        $db->prepare("DELETE FROM staff_members WHERE id = :id")->execute(['id' => $id]);
        safeLogAction($db, 'Staff', 'Deleted staff member ID ' . $id);
    }

    jsonResponse(['success' => true, 'message' => ucfirst($type) . ' deleted']);
}

// Get Service Stats
function getServiceStats() {
    $db = getDB();
    $repairs = (int)$db->query("SELECT COUNT(*) FROM services WHERE type = 'Repair' AND status = 'In Progress'")->fetchColumn();
    $deliveries = (int)$db->query("SELECT COUNT(*) FROM services WHERE delivery = 'Out for Delivery'")->fetchColumn();
    $completed = (int)$db->query("SELECT COUNT(*) FROM services WHERE status = 'Completed'")->fetchColumn();
    $pending = (int)$db->query("SELECT COUNT(*) FROM services WHERE status = 'Requested'")->fetchColumn();
    $revenue = (float)$db->query("SELECT SUM(cost) FROM services")->fetchColumn();

    // Performance additions
    $perf = $db->query("SELECT 
        AVG(ABS(TIMESTAMPDIFF(MINUTE, created_at, completed_at))) AS avg_minutes,
        AVG(rating) AS avg_rating 
        FROM services WHERE status = 'Completed'")->fetch();

    jsonResponse(['success' => true, 'data' => [
        'repairs' => $repairs,
        'deliveries' => $deliveries,
        'completed' => $completed,
        'pending' => $pending,
        'revenue' => $revenue,
        'avg_minutes' => $perf['avg_minutes'] ? round($perf['avg_minutes'], 1) : 0,
        'avg_rating' => $perf['avg_rating'] ? round($perf['avg_rating'], 1) : 0
    ]]);
}

// Get Performance Metrics
function getPerformanceMetrics() {
    $db = getDB();
    $summary = $db->query("SELECT COUNT(*) AS completed_jobs, AVG(TIMESTAMPDIFF(MINUTE, created_at, COALESCE(completed_at, updated_at))) AS avg_minutes, AVG(rating) AS avg_rating FROM services WHERE status = 'Completed'")->fetch();

    $rows = $db->query("SELECT staff, COUNT(*) AS completed_jobs, AVG(TIMESTAMPDIFF(MINUTE, created_at, COALESCE(completed_at, updated_at))) AS avg_minutes, AVG(rating) AS avg_rating FROM services WHERE status = 'Completed' AND staff != 'Unassigned' GROUP BY staff ORDER BY completed_jobs DESC")->fetchAll();

    jsonResponse(['success' => true, 'data' => [
        'summary' => [
            'completed_jobs' => (int)$summary['completed_jobs'],
            'avg_minutes' => $summary['avg_minutes'] ? round($summary['avg_minutes'], 1) : 0,
            'avg_rating' => $summary['avg_rating'] ? round($summary['avg_rating'], 1) : 0
        ],
        'staff' => $rows
    ]]);
}

// Safe Log Action
function safeLogAction($db, $action, $details) {
    try {
        $user = $_SESSION['user']['name'] ?? 'System';
        $db->prepare("INSERT INTO activity_logs (user, action, details, log_date, login_time, status) VALUES (:u, :a, :d, :dt, :t, 'Closed')")
           ->execute(['u' => $user, 'a' => $action, 'd' => $details, 'dt' => date('Y-m-d'), 't' => date('h:i:s A')]);
    } catch (Exception $e) {
        error_log('LogAction failed: ' . $e->getMessage());
    }
}
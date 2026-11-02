<?php
/**
 * Users API
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$action = $_GET['action'] ?? '';

try {
    switch ($method) {
        case 'GET':
            if ($action === 'stats') { getUserStats(); }
            elseif ($id) { getUser($id); }
            else { getAllUsers(); }
            break;
        case 'POST':
            createUser();
            break;
        case 'DELETE':
            deleteUser($id);
            break;
        default:
            jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
    }
} catch (Exception $e) {
    jsonResponse(['success' => false, 'error' => 'Server error: ' . $e->getMessage()], 500);
}

// Get All Users
function getAllUsers() {
    $db = getDB();
    $search = $_GET['search'] ?? '';
    $filter = $_GET['filter'] ?? 'All Roles';

    $sql = "SELECT id, username, email, phone, role, image, last_login, duration, created_at FROM users WHERE 1=1";
    $params = [];

    if ($filter !== 'All Roles' && in_array($filter, ['Admin', 'Staff'])) {
        $sql .= " AND role = :filter";
        $params['filter'] = $filter;
    }

    if ($search) {
        $sql .= " AND (username LIKE :s1 OR email LIKE :s2 OR role LIKE :s3)";
        $params['s1'] = "%$search%";
        $params['s2'] = "%$search%";
        $params['s3'] = "%$search%";
    }

    $sql .= " ORDER BY id DESC";
    
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $users = $stmt->fetchAll();

    foreach ($users as &$u) {
        $astmt = $db->prepare("SELECT created_at FROM activity_logs WHERE user = :uname AND status = 'Active' ORDER BY id DESC LIMIT 1");
        $astmt->execute(['uname' => $u['username']]);
        $activeLog = $astmt->fetch();
        if ($activeLog) {
            $created = strtotime($activeLog['created_at']);
            $diffMins = max(0, round((time() - $created) / 60));
            $h = floor($diffMins / 60);
            $m = $diffMins % 60;
            $u['duration'] = $h > 0 ? "{$h}h {$m}m (Active)" : "{$m}m (Active)";
        }
    }

    jsonResponse(['success' => true, 'data' => $users]);
}

// Get User
function getUser($id) {
    $db = getDB();
    $stmt = $db->prepare("SELECT id, username, email, phone, role, image, last_login, duration FROM users WHERE id = :id");
    $stmt->execute(['id' => $id]);
    $u = $stmt->fetch();
    if (!$u) jsonResponse(['success' => false, 'error' => 'Not found'], 404);
    jsonResponse(['success' => true, 'data' => $u]);
}

// Create User
function createUser() {
    // RBAC: Only Admin can create/update users
    if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'Admin') {
        jsonResponse(['success' => false, 'error' => 'Access denied. Admin privileges required.'], 403);
    }
    $data = getRequestBody();
    $db = getDB();
    $id = $data['id'] ?? null;

    if ($id) {
        if (!empty($data['email'])) {
            $stmt = $db->prepare("SELECT id FROM users WHERE email = :email AND id != :id");
            $stmt->execute(['email' => strtolower($data['email']), 'id' => $id]);
            if ($stmt->fetch()) jsonResponse(['success' => false, 'error' => 'Email already exists'], 409);
        }

        $fields = [
            'username' => $data['username'],
            'email' => strtolower($data['email']),
            'phone' => $data['phone'] ?? null,
            'role' => $data['role'] ?? 'Staff',
            'image' => $data['image'] ?? null,
            'id' => $id
        ];

        $sql = "UPDATE users SET username = :username, email = :email, phone = :phone, role = :role, image = :image";
        if (!empty($data['password'])) {
            $sql .= ", password = :password";
            $fields['password'] = password_hash($data['password'], PASSWORD_BCRYPT);
        }
        $sql .= " WHERE id = :id";

        $stmt = $db->prepare($sql);
        $stmt->execute($fields);
        safeLogAction($db, 'Update User', 'Updated user account: ' . $data['username']);
        jsonResponse(['success' => true, 'id' => $id, 'message' => 'User updated'], 200);
        return;
    }

    $stmt = $db->prepare("SELECT id FROM users WHERE email = :email");
    $stmt->execute(['email' => strtolower($data['email'])]);
    if ($stmt->fetch()) jsonResponse(['success' => false, 'error' => 'Email already exists'], 409);

    $pwd = password_hash($data['password'], PASSWORD_BCRYPT);
    $stmt = $db->prepare("INSERT INTO users (username, email, password, phone, role, image) VALUES (:u, :e, :p, :phone, :r, :i)");
    $stmt->execute([
        'u' => $data['username'],
        'e' => strtolower($data['email']),
        'p' => $pwd,
        'phone' => $data['phone'] ?? null,
        'r' => $data['role'] ?? 'Staff',
        'i' => $data['image'] ?? null
    ]);

    $newId = $db->lastInsertId();
    safeLogAction($db, 'Add User', 'Created user account: ' . $data['username']);
    jsonResponse(['success' => true, 'id' => $newId], 201);
}



// Delete User
function deleteUser($id) {
    // RBAC: Only Admin can delete users
    if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'Admin') {
        jsonResponse(['success' => false, 'error' => 'Access denied. Admin privileges required.'], 403);
    }
    if (!$id) jsonResponse(['success' => false, 'error' => 'ID required'], 400);
    $db = getDB();

    $stmt = $db->prepare("SELECT username FROM users WHERE id = :id");
    $stmt->execute(['id' => $id]);
    $u = $stmt->fetch();

    $db->prepare("DELETE FROM users WHERE id = :id")->execute(['id' => $id]);
    safeLogAction($db, 'Delete User', 'Deleted user account ' . ($u['username'] ?? $id));
    jsonResponse(['success' => true, 'message' => 'User deleted']);
}

// Get User Stats
function getUserStats() {
    $db = getDB();
    $total = $db->query("SELECT COUNT(*) FROM users")->fetchColumn();
    $admins = $db->query("SELECT COUNT(*) FROM users WHERE role = 'Admin'")->fetchColumn();
    $staff = $db->query("SELECT COUNT(*) FROM users WHERE role = 'Staff'")->fetchColumn();

    $active = 0;
    try {
        $active = $db->query("SELECT COUNT(*) FROM activity_logs WHERE status = 'Active' AND action IN ('User Login', 'Login')")->fetchColumn();
    } catch (Exception $e) {}

    jsonResponse(['success' => true, 'data' => [
        'total' => (int)$total,
        'admins' => (int)$admins,
        'staff' => (int)$staff,
        'activeNow' => (int)$active
    ]]);
}

/** Safe log — never crashes the main operation */
function safeLogAction($db, $action, $details) {
    try {
        $user = $_SESSION['user']['name'] ?? 'System';
        $db->prepare("INSERT INTO activity_logs (user, action, details, log_date, login_time, status) VALUES (:u, :a, :d, :dt, :t, 'Closed')")
           ->execute(['u' => $user, 'a' => $action, 'd' => $details, 'dt' => date('Y-m-d'), 't' => date('h:i:s A')]);
    } catch (Exception $e) {
        error_log('LogAction failed: ' . $e->getMessage());
    }
}
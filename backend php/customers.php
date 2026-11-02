<?php
/**
 * Customers API
 * GET    /api/customers.php              — List all customers
 * GET    /api/customers.php?id=1         — Get single customer
 * POST   /api/customers.php              — Create customer
 * DELETE /api/customers.php?id=1         — Delete customer
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$action = $_GET['action'] ?? '';

try {
    switch ($method) {
        case 'GET':
            if ($action === 'stats') {
                getCustomerStats();
            } elseif ($id) {
                getCustomer($id);
            } else {
                getAllCustomers();
            }
            break;
        case 'POST':
            createCustomer();
            break;
        case 'DELETE':
            deleteCustomer($id);
            break;
        default:
            jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
    }
} catch (Exception $e) {
    jsonResponse(['success' => false, 'error' => 'Server error: ' . $e->getMessage()], 500);
}

// Get All Customers
function getAllCustomers() {
    $db = getDB();
    $search = $_GET['search'] ?? '';
    $filter = $_GET['filter'] ?? 'all';

    $sql = "SELECT * FROM customers WHERE 1=1";
    $params = [];



    if ($search) {
        $sql .= " AND (name LIKE :s1 OR phone LIKE :s2 OR email LIKE :s3 OR address LIKE :s4 OR product LIKE :s5)";
        $params['s1'] = "%$search%";
        $params['s2'] = "%$search%";
        $params['s3'] = "%$search%";
        $params['s4'] = "%$search%";
        $params['s5'] = "%$search%";
    }

    $sql .= " ORDER BY id DESC";

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
}

// Get Customer
function getCustomer($id) {
    $db = getDB();
    $stmt = $db->prepare("SELECT * FROM customers WHERE id = :id");
    $stmt->execute(['id' => $id]);
    $customer = $stmt->fetch();
    if (!$customer) jsonResponse(['success' => false, 'error' => 'Not found'], 404);
    jsonResponse(['success' => true, 'data' => $customer]);
}

// Create Customer
function createCustomer() {
    $data = getRequestBody();
    $db = getDB();
    $id = $data['id'] ?? null;

    if ($id) {
        $stmt = $db->prepare("UPDATE customers SET name = :name, phone = :phone, email = :email, address = :address, product = :product, warranty = :warranty, buy_date = :buy_date WHERE id = :id");
        $stmt->execute([
            'id' => $id,
            'name' => $data['name'],
            'phone' => $data['phone'],
            'email' => $data['email'] ?? null,
            'address' => $data['address'] ?? null,
            'product' => $data['product'] ?? null,
            'warranty' => $data['warranty'] ?? null,
            'buy_date' => $data['buyDate'] ?? null
        ]);
        safeLogAction($db, 'Update Customer', 'Updated customer: ' . $data['name']);
        jsonResponse(['success' => true, 'id' => $id, 'message' => 'Customer updated'], 200);
        return;
    }

    $stmt = $db->prepare("INSERT INTO customers (name, phone, email, address, product, warranty, buy_date, points) VALUES (:name, :phone, :email, :address, :product, :warranty, :buy_date, 0)");
    $stmt->execute([
        'name' => $data['name'],
        'phone' => $data['phone'],
        'email' => $data['email'] ?? null,
        'address' => $data['address'] ?? null,
        'product' => $data['product'] ?? null,
        'warranty' => $data['warranty'] ?? null,
        'buy_date' => $data['buyDate'] ?? null
    ]);

    $newId = $db->lastInsertId();
    safeLogAction($db, 'Add Customer', 'Added customer: ' . $data['name']);
    jsonResponse(['success' => true, 'id' => $newId], 201);
}



// Delete Customer
function deleteCustomer($id) {
    // RBAC: Only Admin can delete customers
    if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'Admin') {
        jsonResponse(['success' => false, 'error' => 'Access denied. Admin privileges required.'], 403);
    }
    if (!$id) jsonResponse(['success' => false, 'error' => 'ID required'], 400);
    $db = getDB();

    $stmt = $db->prepare("SELECT name FROM customers WHERE id = :id");
    $stmt->execute(['id' => $id]);
    $c = $stmt->fetch();

    $db->prepare("DELETE FROM customers WHERE id = :id")->execute(['id' => $id]);

    safeLogAction($db, 'Delete Customer', 'Deleted customer: ' . ($c['name'] ?? $id));
    jsonResponse(['success' => true, 'message' => 'Customer deleted']);
}

// Get Customer Stats
function getCustomerStats() {
    $db = getDB();
    $total = $db->query("SELECT COUNT(*) FROM customers")->fetchColumn();


    $startOfMonth = date('Y-m-01');
    $stmt = $db->prepare("SELECT COUNT(*) FROM customers WHERE buy_date >= :d");
    $stmt->execute(['d' => $startOfMonth]);
    $newThisMonth = $stmt->fetchColumn();

    $today = date('Y-m-d');
    $stmt = $db->prepare("SELECT COUNT(*) FROM customers WHERE buy_date = :d");
    $stmt->execute(['d' => $today]);
    $activeToday = $stmt->fetchColumn();

    jsonResponse(['success' => true, 'data' => [
        'total' => (int)$total,

        'newThisMonth' => (int)$newThisMonth,
        'activeToday' => (int)$activeToday
    ]]);
}

/** Safe log — never crashes the main operation */
function safeLogAction($db, $action, $details) {
    try {
        $user = $_SESSION['user']['name'] ?? 'System';
        $db->prepare("INSERT INTO activity_logs (user, action, details, log_date, login_time, status) VALUES (:u, :a, :d, :dt, :t, 'Closed')")
           ->execute(['u' => $user, 'a' => $action, 'd' => $details, 'dt' => date('Y-m-d'), 't' => date('h:i:s A')]);
    } catch (Exception $e) {
        // Silently fail — logging should never break the main operation
        error_log('LogAction failed: ' . $e->getMessage());
    }
}
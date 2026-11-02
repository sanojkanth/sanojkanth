<?php
/**
 * Suppliers API
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

try {
    switch ($method) {
        case 'GET':
            if (isset($_GET['action']) && $_GET['action'] === 'stats') {
                getStats();
            } else if ($id) { 
                getSupplier($id); 
            } else { 
                getAllSuppliers(); 
            }
            break;
        case 'POST':
            createSupplier();
            break;
        case 'DELETE':
            deleteSupplier($id);
            break;
        default:
            jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
    }
} catch (Exception $e) {
    jsonResponse(['success' => false, 'error' => 'Server error: ' . $e->getMessage()], 500);
}

// Get All Suppliers
function getAllSuppliers() {
    $db = getDB();
    $search = $_GET['search'] ?? '';
    $filter = $_GET['filter'] ?? 'All';

    $sql = "SELECT * FROM suppliers WHERE 1=1";
    $params = [];

    if ($filter !== 'All' && in_array($filter, ['Wholesaler', 'Distributor', 'Manufacturer'])) {
        $sql .= " AND type = :filter";
        $params['filter'] = $filter;
    }

    if ($search) {
        $sql .= " AND (name LIKE :s1 OR email LIKE :s2 OR phone LIKE :s3 OR address LIKE :s4)";
        $params['s1'] = "%$search%";
        $params['s2'] = "%$search%";
        $params['s3'] = "%$search%";
        $params['s4'] = "%$search%";
    }

    $sql .= " ORDER BY id DESC";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
}

// Get Supplier
function getSupplier($id) {
    $db = getDB();
    $stmt = $db->prepare("SELECT * FROM suppliers WHERE id = :id");
    $stmt->execute(['id' => $id]);
    $sup = $stmt->fetch();
    if (!$sup) jsonResponse(['success' => false, 'error' => 'Not found'], 404);
    jsonResponse(['success' => true, 'data' => $sup]);
}

// Create Supplier
function createSupplier() {
    // RBAC: Only Admin can add/edit suppliers
    if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'Admin') {
        jsonResponse(['success' => false, 'error' => 'Access denied. Admin privileges required.'], 403);
    }
    $data = getRequestBody();
    $db = getDB();
    $id = $data['id'] ?? null;

    if ($id) {
        $stmt = $db->prepare("UPDATE suppliers SET name = :name, type = :type, phone = :phone, email = :email, address = :address, website = :website WHERE id = :id");
        $stmt->execute([
            'id' => $id,
            'name' => $data['name'],
            'type' => $data['type'] ?? 'Wholesaler',
            'phone' => $data['phone'] ?? null,
            'email' => $data['email'] ?? null,
            'address' => $data['address'] ?? null,
            'website' => $data['website'] ?? null
        ]);
        safeLogAction($db, 'Update Supplier', 'Updated supplier: ' . $data['name']);
        jsonResponse(['success' => true, 'id' => $id, 'message' => 'Supplier updated'], 200);
        return;
    }

    $stmt = $db->prepare("INSERT INTO suppliers (name, type, phone, email, address, website) VALUES (:name, :type, :phone, :email, :address, :website)");
    $stmt->execute([
        'name' => $data['name'],
        'type' => $data['type'] ?? 'Wholesaler',
        'phone' => $data['phone'] ?? null,
        'email' => $data['email'] ?? null,
        'address' => $data['address'] ?? null,
        'website' => $data['website'] ?? null
    ]);
    $newId = $db->lastInsertId();
    safeLogAction($db, 'Add Supplier', 'Added supplier: ' . $data['name']);
    jsonResponse(['success' => true, 'id' => $newId], 201);
}



// Delete Supplier
function deleteSupplier($id) {
    // RBAC: Only Admin can delete suppliers
    if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'Admin') {
        jsonResponse(['success' => false, 'error' => 'Access denied. Admin privileges required.'], 403);
    }
    if (!$id) jsonResponse(['success' => false, 'error' => 'ID required'], 400);
    $db = getDB();
    $stmt = $db->prepare("SELECT name FROM suppliers WHERE id = :id");
    $stmt->execute(['id' => $id]);
    $s = $stmt->fetch();
    $db->prepare("DELETE FROM suppliers WHERE id = :id")->execute(['id' => $id]);
    safeLogAction($db, 'Delete Supplier', 'Deleted supplier: ' . ($s['name'] ?? $id));
    jsonResponse(['success' => true, 'message' => 'Supplier deleted']);
}

// Get Stats
function getStats() {
    $db = getDB();
    $total = $db->query("SELECT COUNT(*) FROM suppliers")->fetchColumn();
    $mfg = $db->query("SELECT COUNT(*) FROM suppliers WHERE type = 'Manufacturer'")->fetchColumn();
    $whole = $db->query("SELECT COUNT(*) FROM suppliers WHERE type = 'Wholesaler'")->fetchColumn();
    $dist = $db->query("SELECT COUNT(*) FROM suppliers WHERE type = 'Distributor'")->fetchColumn();

    jsonResponse(['success' => true, 'data' => [
        'total' => (int)$total,
        'manufacturers' => (int)$mfg,
        'wholesalers' => (int)$whole,
        'distributors' => (int)$dist
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
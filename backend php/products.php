<?php
/**
 * Products / Inventory API
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$id = $_GET['id'] ?? null;

try {
    error_log("API REQUEST: " . $method . " " . $_SERVER['REQUEST_URI']);
    switch ($method) {
        case 'GET':
            if ($action === 'stats') {
                getStats();
            } elseif ($id) {
                getProduct($id);
            } else {
                getAllProducts();
            }
            break;
        case 'POST':
            createProduct();
            break;
        case 'DELETE':
            deleteProduct($id);
            break;
        default:
            jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
    }
} catch (Exception $e) {
    jsonResponse(['success' => false, 'error' => 'Server error: ' . $e->getMessage()], 500);
}

// Get All Products
function getAllProducts() {
    $db = getDB();
    $search = $_GET['search'] ?? '';
    $filter = $_GET['filter'] ?? 'all';
    $sort = $_GET['sort'] ?? 'id';
    $order = $_GET['order'] ?? 'asc';
    $threshold = 15;

    $stmt = $db->query("SELECT setting_value FROM settings WHERE setting_key = 'stockThreshold'");
    $row = $stmt->fetch();
    if ($row) $threshold = (int)$row['setting_value'];

    $sql = "SELECT * FROM products WHERE 1=1";
    $params = [];

    if ($filter === 'in-stock') {
        $sql .= " AND stock > :threshold";
        $params['threshold'] = $threshold;
    } elseif ($filter === 'low-stock') {
        $sql .= " AND stock > 0 AND stock <= :threshold";
        $params['threshold'] = $threshold;
    } elseif ($filter === 'out-of-stock') {
        $sql .= " AND stock = 0";
    }

    if ($search) {
        $sql .= " AND (name LIKE :search OR category LIKE :search2 OR id LIKE :search3)";
        $params['search'] = "%$search%";
        $params['search2'] = "%$search%";
        $params['search3'] = "%$search%";
    }

    $allowed_sort = ['id', 'name', 'category', 'price', 'stock', 'cost'];
    $sort = in_array($sort, $allowed_sort) ? $sort : 'id';
    $order = strtoupper($order) === 'DESC' ? 'DESC' : 'ASC';
    $sql .= " ORDER BY $sort $order";

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $products = $stmt->fetchAll();

    jsonResponse(['success' => true, 'data' => $products]);
}

// Get Product
function getProduct($id) {
    $db = getDB();
    $stmt = $db->prepare("SELECT * FROM products WHERE id = :id");
    $stmt->execute(['id' => $id]);
    $product = $stmt->fetch();
    if (!$product) jsonResponse(['success' => false, 'error' => 'Product not found'], 404);
    jsonResponse(['success' => true, 'data' => $product]);
}

// Create Product
function createProduct() {
    $data = getRequestBody();
    $db = getDB();
    
    // Check if we are updating (providing numeric ID) or creating (no ID)
    $id = isset($data['id']) && (is_numeric($data['id']) && (int)$data['id'] > 0) ? (int)$data['id'] : null;
    $stock = isset($data['stock']) ? (int)$data['stock'] : 0;
    
    if (!$id && $stock <= 0) {
        jsonResponse(['success' => false, 'error' => 'Initial Stock Level must be a positive value (greater than zero)'], 400);
        return;
    } elseif ($id && $stock < 0) {
        jsonResponse(['success' => false, 'error' => 'Stock level cannot be negative'], 400);
        return;
    }

    try {
        if ($id) {
            // Check if product exists before update
            $checkStmt = $db->prepare("SELECT id FROM products WHERE id = :id");
            $checkStmt->execute(['id' => $id]);
            if (!$checkStmt->fetch()) {
                jsonResponse(['success' => false, 'error' => 'Product #'. $id .' not found for update'], 404);
                return;
            }

            $sql = "UPDATE products SET name = :name, category = :category, price = :price, cost = :cost, stock = :stock, image = :image WHERE id = :id";
            $stmt = $db->prepare($sql);
            $stmt->execute([
                'id' => $id,
                'name' => $data['name'] ?? 'Unnamed',
                'category' => $data['category'] ?? 'General',
                'price' => $data['price'] ?? 0,
                'cost' => $data['cost'] ?? 0,
                'stock' => $data['stock'] ?? 0,
                'image' => $data['image'] ?? ''
            ]);

            safeLogAction($db, 'Update Product', 'Updated product: ' . ($data['name'] ?? 'Unnamed') . ' (ID: ' . $id . ')');
            jsonResponse(['success' => true, 'id' => $id, 'message' => 'Product updated'], 200);
            return;
        }

        // If reach here and $data['id'] was provided but was not numeric or > 0, we should probably warn
        if (isset($data['id']) && $data['id'] !== null && $data['id'] !== '' && $data['id'] !== 0) {
             // Invalid ID format but ID was passed
             error_log("Product save with invalid ID: " . var_export($data['id'], true));
        }

        // CREATE NEW PRODUCT SECTION (If $id is null)
        $stmt = $db->prepare("INSERT INTO products (name, category, price, cost, stock, sold, image) VALUES (:name, :category, :price, :cost, :stock, 0, :image)");
        $stmt->execute([
            'name' => $data['name'] ?? 'Unnamed',
            'category' => $data['category'] ?? 'General',
            'price' => $data['price'] ?? 0,
            'cost' => $data['cost'] ?? 0,
            'stock' => $data['stock'] ?? 0,
            'image' => $data['image'] ?? ''
        ]);
        $newId = $db->lastInsertId();
        
        // Verify insert worked
        $verify = $db->prepare("SELECT count(*) FROM products WHERE id = :id");
        $verify->execute(['id' => $newId]);
        if ($verify->fetchColumn() == 0) {
            error_log("VERIFY FAILED: Product ID $newId not found right after insert!");
            jsonResponse(['success' => false, 'error' => 'Product was not stored in database after execution'], 500);
        } else {
             error_log("VERIFY SUCCESS: Product ID $newId confirmed in database.");
        }
        $id = $newId;
    } catch (PDOException $e) {
        error_log("INSERT PRODUCT FAILED: " . $e->getMessage());
        jsonResponse(['success' => false, 'error' => 'Database error: ' . $e->getMessage()], 500);
    }
    safeLogAction($db, 'Add Product', 'Added new product: ' . $data['name']);
    jsonResponse(['success' => true, 'id' => $id, 'message' => 'Product created'], 201);
}



// Delete Product
function deleteProduct($id) {
    // RBAC: Only Admin can delete products
    if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'Admin') {
        jsonResponse(['success' => false, 'error' => 'Access denied. Admin privileges required.'], 403);
    }
    if (!$id) jsonResponse(['success' => false, 'error' => 'ID required'], 400);
    $db = getDB();

    $stmt = $db->prepare("SELECT name FROM products WHERE id = :id");
    $stmt->execute(['id' => $id]);
    $product = $stmt->fetch();

    $stmt = $db->prepare("DELETE FROM products WHERE id = :id");
    $stmt->execute(['id' => $id]);

    safeLogAction($db, 'Delete Product', 'Deleted product: ' . ($product['name'] ?? $id));
    jsonResponse(['success' => true, 'message' => 'Product deleted']);
}

// Get Stats
function getStats() {
    $db = getDB();
    $threshold = 15;

    $stmt = $db->query("SELECT setting_value FROM settings WHERE setting_key = 'stockThreshold'");
    $row = $stmt->fetch();
    if ($row) $threshold = (int)$row['setting_value'];

    $total = $db->query("SELECT COUNT(*) FROM products")->fetchColumn();
    $lowStock = $db->prepare("SELECT COUNT(*) FROM products WHERE stock > 0 AND stock <= :t");
    $lowStock->execute(['t' => $threshold]);
    $lowStockCount = $lowStock->fetchColumn();

    $outOfStock = $db->query("SELECT COUNT(*) FROM products WHERE stock = 0")->fetchColumn();

    $stmt = $db->query("SELECT SUM(price * stock) as market_value, SUM(cost * stock) as cost_value FROM products");
    $values = $stmt->fetch();

    $stmt = $db->prepare("SELECT id, name, stock, category FROM products WHERE stock <= :t ORDER BY stock ASC LIMIT 10");
    $stmt->execute(['t' => $threshold]);
    $lowStockProducts = $stmt->fetchAll();

    jsonResponse(['success' => true, 'data' => [
        'total' => (int)$total,
        'lowStock' => (int)$lowStockCount,
        'outOfStock' => (int)$outOfStock,
        'marketValue' => (float)($values['market_value'] ?? 0),
        'costValue' => (float)($values['cost_value'] ?? 0),
        'lowStockProducts' => $lowStockProducts
    ]]);
}

/** Safe log — never crashes the main operation */
function safeLogAction($db, $action, $details) {
    try {
        $user = $_SESSION['user']['name'] ?? 'System';
        $stmt = $db->prepare("INSERT INTO activity_logs (user, action, details, log_date, login_time, status) VALUES (:user, :action, :details, :date, :time, 'Closed')");
        $stmt->execute([
            'user' => $user,
            'action' => $action,
            'details' => $details,
            'date' => date('Y-m-d'),
            'time' => date('h:i:s A')
        ]);
    } catch (Exception $e) {
        error_log('LogAction failed: ' . $e->getMessage());
    }
}
<?php
/**
 * Orders API (Supplier Purchase Orders)
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$action = $_GET['action'] ?? '';

try {
    switch ($method) {
        case 'GET':
            if ($action === 'stats') { getOrderStats(); }
            elseif ($id) { getOrder($id); }
            else { getAllOrders(); }
            break;
        case 'POST':
            if ($action === 'receive') {
                receiveOrder($id);
            } else {
                createOrder();
            }
            break;
        case 'DELETE':
            deleteOrder($id);
            break;
        default:
            jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
    }
} catch (Exception $e) {
    jsonResponse(['success' => false, 'error' => 'Server error: ' . $e->getMessage()], 500);
}

// Get All Orders
function getAllOrders() {
    $db = getDB();
    $search = $_GET['search'] ?? '';
    $filter = $_GET['filter'] ?? 'All';

    $sql = "SELECT * FROM orders WHERE 1=1";
    $params = [];

    if ($filter !== 'All' && in_array($filter, ['Pending', 'Ordered', 'Completed', 'Cancelled'])) {
        $sql .= " AND status = :filter";
        $params['filter'] = $filter;
    }

    if ($search) {
        $sql .= " AND (supplier LIKE :s1 OR id LIKE :s2 OR status LIKE :s3)";
        $params['s1'] = "%$search%";
        $params['s2'] = "%$search%";
        $params['s3'] = "%$search%";
    }

    $sql .= " ORDER BY id DESC";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $orders = $stmt->fetchAll();

    // Attach items to each order
    foreach ($orders as &$order) {
        $stmt2 = $db->prepare("SELECT * FROM order_items WHERE order_id = :oid");
        $stmt2->execute(['oid' => $order['id']]);
        $order['items'] = $stmt2->fetchAll();
    }

    jsonResponse(['success' => true, 'data' => $orders]);
}

// Get Order
function getOrder($id) {
    $db = getDB();
    $stmt = $db->prepare("SELECT * FROM orders WHERE id = :id");
    $stmt->execute(['id' => $id]);
    $order = $stmt->fetch();
    if (!$order) jsonResponse(['success' => false, 'error' => 'Not found'], 404);

    $stmt2 = $db->prepare("SELECT * FROM order_items WHERE order_id = :oid");
    $stmt2->execute(['oid' => $id]);
    $order['items'] = $stmt2->fetchAll();

    jsonResponse(['success' => true, 'data' => $order]);
}

// Create Order
function createOrder() {
    $data = getRequestBody();
    $db = getDB();

    $id = $data['id'] ?? null;
    $status = $data['status'] ?? 'Pending';
    
    if ($id) {
        $stmt = $db->prepare("UPDATE orders SET supplier = :supplier, order_date = :date, expected_delivery_date = :expected_delivery_date, total = :total, status = :status WHERE id = :id");
        $stmt->execute([
            'id' => $id,
            'supplier' => $data['supplier'] ?? null,
            'date' => $data['date'] ?? date('Y-m-d'),
            'expected_delivery_date' => $data['expected_delivery_date'] ?? null,
            'total' => $data['total'] ?? 0,
            'status' => $status
        ]);
        $orderId = $id;
        
        // Delete existing items to replace them
        $db->prepare("DELETE FROM order_items WHERE order_id = :id")->execute(['id' => $orderId]);
    } else {
        $stmt = $db->prepare("INSERT INTO orders (supplier, order_date, expected_delivery_date, total, status, stock_updated) VALUES (:supplier, :date, :expected_delivery_date, :total, :status, :stock_updated)");
        $stmt->execute([
            'supplier' => $data['supplier'] ?? null,
            'date' => $data['date'] ?? date('Y-m-d'),
            'expected_delivery_date' => $data['expected_delivery_date'] ?? null,
            'total' => $data['total'] ?? 0,
            'status' => $status,
            'stock_updated' => $status === 'Completed' ? 1 : 0
        ]);
        $orderId = $db->lastInsertId();
    }

    // Insert items
    if (!empty($data['items'])) {
        $stmtItem = $db->prepare("INSERT INTO order_items (order_id, product_id, product_name, qty, price, total) VALUES (:oid, :pid, :name, :qty, :price, :total)");
        foreach ($data['items'] as $item) {
            $stmtItem->execute([
                'oid' => $orderId,
                'pid' => $item['productId'] ?? null,
                'name' => $item['name'],
                'qty' => $item['qty'],
                'price' => $item['price'],
                'total' => ($item['qty'] * $item['price'])
            ]);
        }
    }

    // If completed, process stock replenishment
    if ($status === 'Completed') {
        processCompletedOrder($db, $orderId, $data);
    }

    safeLogAction($db, 'Create Order', 'Created order #' . $orderId);
    jsonResponse(['success' => true, 'id' => $orderId], 201);
}



// Delete Order
function deleteOrder($id) {
    if (!$id) jsonResponse(['success' => false, 'error' => 'ID required'], 400);
    $db = getDB();
    $db->prepare("DELETE FROM orders WHERE id = :id")->execute(['id' => $id]);
    safeLogAction($db, 'Delete Order', 'Deleted order #' . $id);
    jsonResponse(['success' => true, 'message' => 'Order deleted']);
}

// Process Completed Order
function processCompletedOrder($db, $orderId, $data) {
    if (empty($data['items'])) return;

    foreach ($data['items'] as $item) {
        $pid = $item['productId'] ?? null;
        $qty = (int)($item['qty'] ?? 0);

        if ($pid) {
            $db->prepare("UPDATE products SET stock = stock + :qty WHERE id = :pid")
               ->execute(['qty' => $qty, 'pid' => $pid]);
        }
    }

    $db->prepare("UPDATE orders SET status = 'Completed', stock_updated = 1, received_at = NOW() WHERE id = :id")
       ->execute(['id' => $orderId]);

    // Add expense record
    $db->prepare("INSERT INTO finance_expenses (expense_date, category, description, quantity, amount, ref_order) VALUES (:date, 'COGS', :desc, :qty, :amount, :oid)")
       ->execute([
           'date' => $data['date'] ?? date('Y-m-d'),
           'desc' => 'Supplier Order #' . $orderId . ' - ' . ($data['supplier'] ?? 'Unknown'),
           'qty' => count($data['items']),
           'amount' => $data['total'] ?? 0,
           'oid' => $orderId
       ]);

    safeLogAction($db, 'System', 'Stock replenished for Order #' . $orderId);
}

// Receive Order
function receiveOrder($id) {
    if (!$id) jsonResponse(['success' => false, 'error' => 'ID required'], 400);
    $db = getDB();

    $stmt = $db->prepare("SELECT * FROM orders WHERE id = :id");
    $stmt->execute(['id' => $id]);
    $order = $stmt->fetch();
    if (!$order) jsonResponse(['success' => false, 'error' => 'Order not found'], 404);
    if ((int)($order['stock_updated'] ?? 0) === 1) {
        jsonResponse(['success' => false, 'error' => 'Stock already received for this order'], 409);
    }
    if (($order['status'] ?? '') === 'Cancelled') {
        jsonResponse(['success' => false, 'error' => 'Cancelled orders cannot be received'], 400);
    }

    $stmtItems = $db->prepare("SELECT * FROM order_items WHERE order_id = :oid");
    $stmtItems->execute(['oid' => $id]);
    $items = $stmtItems->fetchAll();

    processCompletedOrder($db, $id, [
        'date' => $order['order_date'],
        'supplier' => $order['supplier'],
        'total' => $order['total'],
        'items' => array_map(function($item) {
            return [
                'productId' => $item['product_id'],
                'name' => $item['product_name'],
                'qty' => $item['qty'],
                'price' => $item['price']
            ];
        }, $items)
    ]);

    safeLogAction($db, 'Receive Order', 'Received stock for order #' . $id);
    jsonResponse(['success' => true, 'message' => 'Stock received successfully']);
}

// Get Order Stats
function getOrderStats() {
    $db = getDB();
    $total = $db->query("SELECT COUNT(*) FROM orders")->fetchColumn();
    $pending = $db->query("SELECT COUNT(*) FROM orders WHERE status IN ('Pending','Ordered')")->fetchColumn();
    $completed = $db->query("SELECT COUNT(*) FROM orders WHERE status = 'Completed'")->fetchColumn();
    $cancelled = $db->query("SELECT COUNT(*) FROM orders WHERE status = 'Cancelled'")->fetchColumn();
    $revenue = $db->query("SELECT COALESCE(SUM(total), 0) FROM orders")->fetchColumn();

    jsonResponse(['success' => true, 'data' => [
        'total' => (int)$total,
        'pending' => (int)$pending,
        'completed' => (int)$completed,
        'cancelled' => (int)$cancelled,
        'totalRevenue' => (float)$revenue
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
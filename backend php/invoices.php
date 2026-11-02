<?php
/**
 * Invoices API
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$action = $_GET['action'] ?? '';

try {
    switch ($method) {
        case 'GET':
            if ($action === 'stats') { getInvoiceStats(); }
            elseif ($id) { getInvoice($id); }
            else { getAllInvoices(); }
            break;
        case 'POST':
            createInvoice();
            break;
        case 'DELETE':
            deleteInvoice($id);
            break;
        default:
            jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
    }
} catch (Exception $e) {
    jsonResponse(['success' => false, 'error' => 'Server error: ' . $e->getMessage()], 500);
}

// Get All Invoices
function getAllInvoices() {
    $db = getDB();
    $search = $_GET['search'] ?? '';
    $filter = $_GET['filter'] ?? 'all';

    // Auto-update overdue
    $db->query("UPDATE invoices SET status = 'Overdue' WHERE status = 'Unpaid' AND due_date < CURDATE()");

    $sql = "SELECT * FROM invoices WHERE 1=1";
    $params = [];

    if ($filter !== 'all' && in_array($filter, ['Paid', 'Unpaid', 'Overdue'])) {
        $sql .= " AND status = :filter";
        $params['filter'] = $filter;
    }

    if ($search) {
        $sql .= " AND (customer LIKE :s1 OR id LIKE :s2 OR phone LIKE :s3 OR status LIKE :s4)";
        $params['s1'] = "%$search%";
        $params['s2'] = "%$search%";
        $params['s3'] = "%$search%";
        $params['s4'] = "%$search%";
    }

    $sql .= " ORDER BY invoice_date DESC";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $invoices = $stmt->fetchAll();

    foreach ($invoices as &$inv) {
        $stmt2 = $db->prepare("SELECT * FROM invoice_items WHERE invoice_id = :iid");
        $stmt2->execute(['iid' => $inv['id']]);
        $inv['items'] = $stmt2->fetchAll();
    }

    jsonResponse(['success' => true, 'data' => $invoices]);
}

// Get Invoice
function getInvoice($id) {
    $db = getDB();
    $stmt = $db->prepare("SELECT * FROM invoices WHERE id = :id");
    $stmt->execute(['id' => $id]);
    $inv = $stmt->fetch();
    if (!$inv) jsonResponse(['success' => false, 'error' => 'Not found'], 404);

    $stmt2 = $db->prepare("SELECT * FROM invoice_items WHERE invoice_id = :iid");
    $stmt2->execute(['iid' => $id]);
    $inv['items'] = $stmt2->fetchAll();

    jsonResponse(['success' => true, 'data' => $inv]);
}

// Create Invoice
function createInvoice() {
    $data = getRequestBody();
    $db = getDB();
    $isUpdate = !empty($data['id']);
    $id = $data['id'] ?? null;

    if (!$isUpdate) {
        $stmt = $db->query("SELECT id FROM invoices ORDER BY id DESC LIMIT 1");
        $last = $stmt->fetch();
        if ($last) {
            $num = (int)str_replace('INV-', '', $last['id']);
            $id = 'INV-' . ($num + 1);
        } else {
            $id = 'INV-1001';
        }
    }

    $db->beginTransaction();
    try {
        if ($isUpdate) {
            $stmt = $db->prepare("UPDATE invoices SET customer = :customer, phone = :phone, invoice_date = :date, due_date = :due, tax = :tax, notes = :notes, status = :status WHERE id = :id");
            $stmt->execute([
                'id' => $id,
                'customer' => $data['customer'],
                'phone' => $data['phone'] ?? null,
                'date' => $data['date'] ?? date('Y-m-d'),
                'due' => $data['dueDate'] ?? null,
                'tax' => $data['tax'] ?? 0,
                'notes' => $data['notes'] ?? null,
                'status' => $data['status'] ?? 'Unpaid'
            ]);

            $oldItemsStmt = $db->prepare("SELECT * FROM invoice_items WHERE invoice_id = :iid");
            $oldItemsStmt->execute(['iid' => $id]);
            $oldItems = $oldItemsStmt->fetchAll();
            foreach ($oldItems as $item) {
                if (!empty($item['name'])) {
                    $db->prepare("UPDATE products SET stock = stock + :qty WHERE LOWER(name) = LOWER(:name)")
                       ->execute(['qty' => $item['qty'] ?? 0, 'name' => $item['name']]);
                }
            }
            $db->prepare("DELETE FROM invoice_items WHERE invoice_id = :iid")->execute(['iid' => $id]);
        } else {
            $stmt = $db->prepare("INSERT INTO invoices (id, customer, phone, invoice_date, due_date, tax, notes, status) VALUES (:id, :customer, :phone, :date, :due, :tax, :notes, :status)");
            $stmt->execute([
                'id' => $id,
                'customer' => $data['customer'],
                'phone' => $data['phone'] ?? null,
                'date' => $data['date'] ?? date('Y-m-d'),
                'due' => $data['dueDate'] ?? null,
                'tax' => $data['tax'] ?? 0,
                'notes' => $data['notes'] ?? null,
                'status' => $data['status'] ?? 'Unpaid'
            ]);
        }

        if (!empty($data['items'])) {
            $stmtItem = $db->prepare("INSERT INTO invoice_items (invoice_id, name, qty, price) VALUES (:iid, :name, :qty, :price)");
            foreach ($data['items'] as $item) {
                if (!empty($item['name'])) {
                    $stmtItem->execute([
                        'iid' => $id,
                        'name' => $item['name'],
                        'qty' => $item['qty'] ?? 1,
                        'price' => $item['price'] ?? 0
                    ]);
                }
            }

            foreach ($data['items'] as $item) {
                if (!empty($item['name'])) {
                    $db->prepare("UPDATE products SET stock = GREATEST(0, stock - :qty), sold = sold + :qty2 WHERE LOWER(name) = LOWER(:name)")
                       ->execute(['qty' => $item['qty'] ?? 0, 'qty2' => $item['qty'] ?? 0, 'name' => $item['name']]);
                }
            }
        }

        $total = calcTotal($data['items'] ?? [], $data['tax'] ?? 0);
        $totalQty = !empty($data['items']) ? array_sum(array_column($data['items'], 'qty')) : 0;
        $method = 'Invoice ' . $id;

        $incomeStmt = $db->prepare("SELECT id FROM finance_income WHERE method = :method LIMIT 1");
        $incomeStmt->execute(['method' => $method]);
        $existingIncome = $incomeStmt->fetch();

        if ($existingIncome) {
            $stmtIncome = $db->prepare("UPDATE finance_income SET income_date = :date, quantity = :qty, amount = :amount WHERE id = :fid");
            $stmtIncome->execute([
                'date' => $data['date'] ?? date('Y-m-d'),
                'qty' => $totalQty,
                'amount' => $total,
                'fid' => $existingIncome['id']
            ]);
        } else {
            $stmtIncome = $db->prepare("INSERT INTO finance_income (income_date, type, method, quantity, amount) VALUES (:date, 'Invoice Sale', :method, :qty, :amount)");
            $stmtIncome->execute([
                'date' => $data['date'] ?? date('Y-m-d'),
                'method' => $method,
                'qty' => $totalQty,
                'amount' => $total
            ]);
        }

        $db->commit();
        safeLogAction($db, $isUpdate ? 'Invoice' : 'Invoice', ($isUpdate ? 'Updated' : 'Created') . ' invoice ' . $id . ' for ' . $data['customer']);
        jsonResponse(['success' => true, 'id' => $id], $isUpdate ? 200 : 201);
    } catch (Exception $e) {
        $db->rollBack();
        throw $e;
    }
}



// Delete Invoice
function deleteInvoice($id) {
    if (!$id) jsonResponse(['success' => false, 'error' => 'ID required'], 400);
    $db = getDB();
    $db->prepare("DELETE FROM invoices WHERE id = :id")->execute(['id' => $id]);
    safeLogAction($db, 'Invoice', 'Deleted invoice ' . $id);
    jsonResponse(['success' => true, 'message' => 'Invoice deleted']);
}

// Get Invoice Stats
function getInvoiceStats() {
    $db = getDB();
    // Auto-update overdue
    $db->query("UPDATE invoices SET status = 'Overdue' WHERE status = 'Unpaid' AND due_date < CURDATE()");

    $total = $db->query("SELECT COUNT(*) FROM invoices")->fetchColumn();
    $paid = $db->query("SELECT COUNT(*) FROM invoices WHERE status = 'Paid'")->fetchColumn();
    $unpaid = $db->query("SELECT COUNT(*) FROM invoices WHERE status = 'Unpaid'")->fetchColumn();
    $overdue = $db->query("SELECT COUNT(*) FROM invoices WHERE status = 'Overdue'")->fetchColumn();

    // Calculate totals (need to sum items)
    $allInvoices = $db->query("SELECT i.id, i.tax, i.status FROM invoices i")->fetchAll();
    $paidTotal = 0; $unpaidTotal = 0; $overdueTotal = 0;

    foreach ($allInvoices as $inv) {
        $items = $db->prepare("SELECT SUM(qty * price) as subtotal FROM invoice_items WHERE invoice_id = :id");
        $items->execute(['id' => $inv['id']]);
        $subtotal = (float)($items->fetch()['subtotal'] ?? 0);
        $tax = $subtotal * ((float)$inv['tax'] / 100);
        $grandTotal = $subtotal + $tax;

        switch ($inv['status']) {
            case 'Paid': $paidTotal += $grandTotal; break;
            case 'Unpaid': $unpaidTotal += $grandTotal; break;
            case 'Overdue': $overdueTotal += $grandTotal; break;
        }
    }

    jsonResponse(['success' => true, 'data' => [
        'total' => (int)$total,
        'paid' => (int)$paid,
        'unpaid' => (int)$unpaid,
        'overdue' => (int)$overdue,
        'paidTotal' => $paidTotal,
        'unpaidTotal' => $unpaidTotal,
        'overdueTotal' => $overdueTotal
    ]]);
}

// Calc Total
function calcTotal($items, $taxPct) {
    $subtotal = 0;
    foreach ($items as $item) {
        $subtotal += ($item['qty'] ?? 0) * ($item['price'] ?? 0);
    }
    return $subtotal + ($subtotal * $taxPct / 100);
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
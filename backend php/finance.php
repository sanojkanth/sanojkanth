<?php
/**
 * Finance API (Income & Expenses)
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$type = $_GET['type'] ?? '';
$id = $_GET['id'] ?? null;
$action = $_GET['action'] ?? '';

try {
    switch ($method) {
        case 'GET':
            if ($action === 'stats') {
                getFinanceStats();
            } else {
                getAllFinance($type);
            }
            break;
        case 'POST':
            if ($type === 'expense' && $action === 'review') {
                reviewExpense($id);
            } else {
                createFinance($type);
            }
            break;
        case 'DELETE':
            deleteFinance($type, $id);
            break;
        default:
            jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
    }
} catch (Exception $e) {
    jsonResponse(['success' => false, 'error' => 'Server error: ' . $e->getMessage()], 500);
}

// Get All Finance
function getAllFinance($type) {
    $user = requireAuth();
    // RBAC: Only Admin can view financial records
    if (strtolower($user['role'] ?? '') !== 'admin') {
        jsonResponse(['success' => false, 'error' => 'Access denied. Admin privileges required.'], 403);
    }
    $db = getDB();
    $search = trim($_GET['search'] ?? '');
    $context = getFinanceContext($db, $user);
    $expenseOrderSql = getExpenseOrderSql();

    if (!$type) {
        $incSql = "SELECT * FROM finance_income ORDER BY income_date DESC, id DESC";
        $expSql = "SELECT * FROM finance_expenses ORDER BY {$expenseOrderSql}";
        $incParams = [];
        $expParams = [];

        if ($search !== '') {
            $incSql = "SELECT * FROM finance_income
                WHERE CAST(id AS CHAR) LIKE :s1 OR type LIKE :s2 OR method LIKE :s3
                ORDER BY income_date DESC, id DESC";
            $incParams = ['s1' => "%{$search}%", 's2' => "%{$search}%", 's3' => "%{$search}%"];

            $expSql = "SELECT * FROM finance_expenses
                WHERE CAST(id AS CHAR) LIKE :s1
                   OR category LIKE :s2
                   OR description LIKE :s3
                   OR approval_status LIKE :s4
                   OR submitted_by LIKE :s5
                   OR reviewed_by LIKE :s6
                ORDER BY {$expenseOrderSql}";
            $expParams = [
                's1' => "%{$search}%",
                's2' => "%{$search}%",
                's3' => "%{$search}%",
                's4' => "%{$search}%",
                's5' => "%{$search}%",
                's6' => "%{$search}%"
            ];
        }

        $stmt1 = $db->prepare($incSql);
        $stmt1->execute($incParams);

        $stmt2 = $db->prepare($expSql);
        $stmt2->execute($expParams);

        jsonResponse([
            'success' => true,
            'data' => [
                'income' => $stmt1->fetchAll(),
                'expenses' => $stmt2->fetchAll(),
                'meta' => $context
            ]
        ]);
    }

    if ($type === 'income') {
        $stmt = $db->query("SELECT * FROM finance_income ORDER BY income_date DESC, id DESC");
        jsonResponse(['success' => true, 'data' => $stmt->fetchAll(), 'meta' => $context]);
    }

    $stmt = $db->query("SELECT * FROM finance_expenses ORDER BY {$expenseOrderSql}");
    jsonResponse(['success' => true, 'data' => $stmt->fetchAll(), 'meta' => $context]);
}

// Create Finance
function createFinance($type) {
    if (!$type) {
        jsonResponse(['success' => false, 'error' => 'Type required'], 400);
    }

    $user = requireAuth();
    $data = getRequestBody();
    $db = getDB();

    if ($type === 'income') {
        $amount = (float)($data['amount'] ?? 0);

        $recordId = $data['id'] ?? null;

        if ($recordId !== null && $recordId !== '') {
            $checkStmt = $db->prepare("SELECT id FROM finance_income WHERE id = :id LIMIT 1");
            $checkStmt->execute(['id' => $recordId]);
            $exists = $checkStmt->fetch();

            if ($exists) {
                $stmt = $db->prepare("UPDATE finance_income
                    SET income_date = :date,
                        type = :type,
                        method = :method,
                        quantity = :qty,
                        amount = :amount
                    WHERE id = :id");
                $stmt->execute([
                    'id' => $recordId,
                    'date' => $data['date'] ?? date('Y-m-d'),
                    'type' => $data['type'] ?? 'Other',
                    'method' => $data['method'] ?? 'Cash',
                    'qty' => $data['quantity'] ?? null,
                    'amount' => $amount
                ]);
                safeLogAction($db, 'Update Income', 'Updated manual payment #' . $recordId . ': ' . ($data['type'] ?? 'Other') . ' (LKR ' . number_format($amount, 2) . ')');
                jsonResponse(['success' => true, 'id' => $recordId, 'message' => 'Income record updated.'], 200);
            } else {
                jsonResponse(['success' => false, 'error' => 'Income record not found.'], 404);
            }
        }

        $stmt = $db->prepare("INSERT INTO finance_income (income_date, type, method, quantity, amount)
            VALUES (:date, :type, :method, :qty, :amount)");
        $stmt->execute([
            'date' => $data['date'] ?? date('Y-m-d'),
            'type' => $data['type'] ?? 'Other',
            'method' => $data['method'] ?? 'Cash',
            'qty' => $data['quantity'] ?? null,
            'amount' => $amount
        ]);
        safeLogAction($db, 'Add Income', 'Added manual payment: ' . ($data['type'] ?? 'Other') . ' (LKR ' . number_format($amount, 2) . ')');
        jsonResponse(['success' => true, 'id' => $db->lastInsertId(), 'message' => 'Income logged successfully.'], 201);
    }

    $amount = (float)($data['amount'] ?? 0);
    $approval = resolveExpenseApproval($db, $user, $amount);
    $submittedBy = trim($data['submittedBy'] ?? '') ?: ($user['name'] ?? 'System');

    if (!empty($data['id'])) {
        $existingStmt = $db->prepare("SELECT id, submitted_by FROM finance_expenses WHERE id = :id LIMIT 1");
        $existingStmt->execute(['id' => $data['id']]);
        $existing = $existingStmt->fetch();
        if (!$existing) {
            jsonResponse(['success' => false, 'error' => 'Expense record not found.'], 404);
        }

        $submittedBy = $existing['submitted_by'] ?: $submittedBy;

        $stmt = $db->prepare("UPDATE finance_expenses
            SET expense_date = :date,
                category = :cat,
                description = :desc,
                quantity = :qty,
                amount = :amount,
                staff_id = :staff_id,
                approval_status = :status,
                submitted_by = :submitted_by,
                reviewed_by = :reviewed_by,
                reviewed_at = :reviewed_at,
                review_note = :review_note
            WHERE id = :id");
        $stmt->execute([
            'id' => $data['id'],
            'date' => $data['date'] ?? date('Y-m-d'),
            'cat' => $data['category'] ?? 'Other',
            'desc' => trim($data['description'] ?? ''),
            'qty' => $data['quantity'] ?? null,
            'amount' => $amount,
            'staff_id' => $data['staff_id'] ?? null,
            'status' => $approval['status'],
            'submitted_by' => $submittedBy,
            'reviewed_by' => $approval['reviewedBy'],
            'reviewed_at' => $approval['reviewedAt'],
            'review_note' => $approval['reviewNote']
        ]);

        safeLogAction($db, 'Update Expense', 'Updated expense #' . $data['id'] . ' as ' . $approval['status'] . ' (LKR ' . number_format($amount, 2) . ')');
        jsonResponse([
            'success' => true,
            'id' => $data['id'],
            'approvalStatus' => $approval['status'],
            'message' => buildExpenseSaveMessage(true, $approval)
        ], 200);
    }

    $stmt = $db->prepare("INSERT INTO finance_expenses (
            expense_date, category, description, quantity, amount, staff_id,
            approval_status, submitted_by, reviewed_by, reviewed_at, review_note
        ) VALUES (
            :date, :cat, :desc, :qty, :amount, :staff_id,
            :status, :submitted_by, :reviewed_by, :reviewed_at, :review_note
        )");
    $stmt->execute([
        'date' => $data['date'] ?? date('Y-m-d'),
        'cat' => $data['category'] ?? 'Other',
        'desc' => trim($data['description'] ?? ''),
        'qty' => $data['quantity'] ?? null,
        'amount' => $amount,
        'staff_id' => $data['staff_id'] ?? null,
        'status' => $approval['status'],
        'submitted_by' => $submittedBy,
        'reviewed_by' => $approval['reviewedBy'],
        'reviewed_at' => $approval['reviewedAt'],
        'review_note' => $approval['reviewNote']
    ]);

    safeLogAction($db, 'Add Expense', 'Added expense as ' . $approval['status'] . ': ' . trim($data['description'] ?? '') . ' (LKR ' . number_format($amount, 2) . ')');
    jsonResponse([
        'success' => true,
        'id' => $db->lastInsertId(),
        'approvalStatus' => $approval['status'],
        'message' => buildExpenseSaveMessage(false, $approval)
    ], 201);
}

// Review Expense
function reviewExpense($id) {
    $user = requireAuth();
    if (strtolower($user['role'] ?? '') !== 'admin') {
        jsonResponse(['success' => false, 'error' => 'Only Admin users can approve or reject expenses.'], 403);
    }
    if (!$id) {
        jsonResponse(['success' => false, 'error' => 'Expense ID required.'], 400);
    }

    $data = getRequestBody();
    $status = $data['status'] ?? '';
    if (!in_array($status, ['Approved', 'Rejected'], true)) {
        jsonResponse(['success' => false, 'error' => 'Invalid review status.'], 400);
    }

    $db = getDB();
    $stmt = $db->prepare("SELECT id, description, amount FROM finance_expenses WHERE id = :id LIMIT 1");
    $stmt->execute(['id' => $id]);
    $expense = $stmt->fetch();

    if (!$expense) {
        jsonResponse(['success' => false, 'error' => 'Expense record not found.'], 404);
    }

    $reviewNote = trim($data['note'] ?? '');
    if ($reviewNote === '') {
        $reviewNote = $status === 'Approved' ? 'Approved by admin review.' : 'Rejected by admin review.';
    }

    $update = $db->prepare("UPDATE finance_expenses
        SET approval_status = :status,
            reviewed_by = :reviewed_by,
            reviewed_at = :reviewed_at,
            review_note = :review_note
        WHERE id = :id");
    $update->execute([
        'status' => $status,
        'reviewed_by' => $user['name'] ?? 'Admin',
        'reviewed_at' => date('Y-m-d H:i:s'),
        'review_note' => $reviewNote,
        'id' => $id
    ]);

    safeLogAction($db, $status === 'Approved' ? 'Approve Expense' : 'Reject Expense', $status . ' expense #' . $id . ' (LKR ' . number_format((float)$expense['amount'], 2) . ')');
    jsonResponse([
        'success' => true,
        'approvalStatus' => $status,
        'message' => $status === 'Approved' ? 'Expense approved successfully.' : 'Expense rejected successfully.'
    ]);
}

// Delete Finance
function deleteFinance($type, $id) {
    if (!$type || !$id) {
        jsonResponse(['success' => false, 'error' => 'Type and ID required'], 400);
    }

    requireAuth();
    $db = getDB();

    if ($type === 'income') {
        $db->prepare("DELETE FROM finance_income WHERE id = :id")->execute(['id' => $id]);
    } else {
        $db->prepare("DELETE FROM finance_expenses WHERE id = :id")->execute(['id' => $id]);
    }

    safeLogAction($db, 'Delete Finance', 'Deleted ' . $type . ' record #' . $id);
    jsonResponse(['success' => true, 'message' => 'Finance record deleted']);
}

// Get Finance Stats
function getFinanceStats() {
    requireAuth();
    $db = getDB();
    $currentMonth = date('m');
    $currentYear = date('Y');

    $rev = $db->query("SELECT COALESCE(SUM(amount), 0) FROM finance_income")->fetchColumn();
    $exp = $db->query("SELECT COALESCE(SUM(amount), 0) FROM finance_expenses WHERE approval_status = 'Approved'")->fetchColumn();

    $mRev = $db->prepare("SELECT COALESCE(SUM(amount), 0) FROM finance_income WHERE MONTH(income_date) = :m AND YEAR(income_date) = :y");
    $mRev->execute(['m' => $currentMonth, 'y' => $currentYear]);
    $monthlyRev = $mRev->fetchColumn();

    $mExp = $db->prepare("SELECT COALESCE(SUM(amount), 0) FROM finance_expenses
        WHERE approval_status = 'Approved' AND MONTH(expense_date) = :m AND YEAR(expense_date) = :y");
    $mExp->execute(['m' => $currentMonth, 'y' => $currentYear]);
    $monthlyExp = $mExp->fetchColumn();

    $pendingCount = $db->query("SELECT COUNT(*) FROM finance_expenses WHERE approval_status = 'Pending'")->fetchColumn();
    $pendingTotal = $db->query("SELECT COALESCE(SUM(amount), 0) FROM finance_expenses WHERE approval_status = 'Pending'")->fetchColumn();

    $taxRate = getSettingNumber($db, 'taxRate', 0);
    $totalTax = (float)$rev * ($taxRate / 100);
    $monthlyTax = (float)$monthlyRev * ($taxRate / 100);

    jsonResponse(['success' => true, 'data' => [
        'totalRevenue' => (float)$rev,
        'totalExpenses' => (float)$exp,
        'totalTax' => $totalTax,
        'netProfit' => (float)$rev - (float)$exp - $totalTax,
        'monthlyRevenue' => (float)$monthlyRev,
        'monthlyExpenses' => (float)$monthlyExp,
        'monthlyTax' => $monthlyTax,
        'monthlyProfit' => (float)$monthlyRev - (float)$monthlyExp - $monthlyTax,
        'pendingExpenseCount' => (int)$pendingCount,
        'pendingExpenseTotal' => (float)$pendingTotal
    ]]);
}

// Get Finance Context
function getFinanceContext($db, $user) {
    return [
        'approvalThreshold' => getSettingNumber($db, 'expenseApprovalThreshold', 50000),
        'canReviewExpenses' => strtolower($user['role'] ?? '') === 'admin',
        'currentUserName' => $user['name'] ?? 'User',
        'currentUserRole' => $user['role'] ?? 'Staff'
    ];
}

// Get Setting Number
function getSettingNumber($db, $key, $default = 0) {
    $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = :key LIMIT 1");
    $stmt->execute(['key' => $key]);
    $value = $stmt->fetchColumn();
    return is_numeric($value) ? (float)$value : (float)$default;
}

// Get Expense Order Sql
function getExpenseOrderSql() {
    return "CASE approval_status WHEN 'Pending' THEN 0 WHEN 'Rejected' THEN 1 ELSE 2 END, expense_date DESC, id DESC";
}

// Resolve Expense Approval
function resolveExpenseApproval($db, $user, $amount) {
    $threshold = getSettingNumber($db, 'expenseApprovalThreshold', 50000);
    $isAdmin = strtolower($user['role'] ?? '') === 'admin';
    $requiresApproval = $amount >= $threshold && !$isAdmin;
    $now = date('Y-m-d H:i:s');

    if ($requiresApproval) {
        return [
            'status' => 'Pending',
            'requiresApproval' => true,
            'reviewedBy' => null,
            'reviewedAt' => null,
            'reviewNote' => 'Awaiting admin approval for a high-value expense.'
        ];
    }

    if ($amount >= $threshold && $isAdmin) {
        return [
            'status' => 'Approved',
            'requiresApproval' => false,
            'reviewedBy' => $user['name'] ?? 'Admin',
            'reviewedAt' => $now,
            'reviewNote' => 'Approved by admin during save.'
        ];
    }

    return [
        'status' => 'Approved',
        'requiresApproval' => false,
        'reviewedBy' => 'Auto-approved',
        'reviewedAt' => $now,
        'reviewNote' => 'Approved automatically below the high-value threshold.'
    ];
}

// Build Expense Save Message
function buildExpenseSaveMessage($isUpdate, $approval) {
    if (($approval['status'] ?? '') === 'Pending') {
        return $isUpdate ? 'Expense updated and sent back for admin approval.' : 'Expense submitted for admin approval.';
    }
    if (($approval['status'] ?? '') === 'Approved' && ($approval['reviewedBy'] ?? '') === 'Auto-approved') {
        return $isUpdate ? 'Expense updated and approved automatically.' : 'Expense logged and approved automatically.';
    }
    return $isUpdate ? 'Expense updated and approved.' : 'Expense logged and approved.';
}

// Safe Log Action
function safeLogAction($db, $action, $details) {
    try {
        $user = $_SESSION['user']['name'] ?? 'System';
        $db->prepare("INSERT INTO activity_logs (user, action, details, log_date, login_time, status)
            VALUES (:u, :a, :d, :dt, :t, 'Closed')")
           ->execute([
               'u' => $user,
               'a' => $action,
               'd' => $details,
               'dt' => date('Y-m-d'),
               't' => date('h:i:s A')
           ]);
    } catch (Exception $e) {
        error_log('LogAction failed: ' . $e->getMessage());
    }
}
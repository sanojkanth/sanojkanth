<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

switch ($method) {
    case 'GET':
        if (isset($_GET['action'])) {
            $action = $_GET['action'];
            switch ($action) {
                case 'list':
                    getNotifications($db);
                    break;
                case 'unread_count':
                    getUnreadCount($db);
                    break;
                case 'rules':
                    getAlertRules($db);
                    break;
                default:
                    echo json_encode(['success' => false, 'message' => 'Invalid action']);
            }
        } else {
            getNotifications($db);
        }
        break;
    case 'POST':
        if (isset($_GET['action'])) {
            $action = $_GET['action'];
            switch ($action) {
                case 'mark_read':
                    markAsRead($db);
                    break;
                case 'create':
                    createNotification($db);
                    break;
                case 'update_rule':
                    updateAlertRule($db);
                    break;
                case 'check_alerts':
                    checkAlerts($db);
                    break;
                default:
                    echo json_encode(['success' => false, 'message' => 'Invalid action']);
            }
        } else {
            createNotification($db);
        }
        break;
    case 'PUT':
        updateAlertRule($db);
        break;
    case 'DELETE':
        deleteNotification($db);
        break;
    default:
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}

// Get Notifications
function getNotifications($db) {
    try {
        $user_id = getCurrentUserId();
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;

        $stmt = $db->prepare("
            SELECT n.*, u.username as user_name
            FROM notifications n
            LEFT JOIN users u ON n.user_id = u.id
            WHERE n.user_id IS NULL OR n.user_id = ?
            ORDER BY n.created_at DESC
            LIMIT ? OFFSET ?
        ");
        $stmt->execute([$user_id, $limit, $offset]);
        $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'data' => $notifications]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

// Get Unread Count
function getUnreadCount($db) {
    try {
        $user_id = getCurrentUserId();
        $stmt = $db->prepare("
            SELECT COUNT(*) as count
            FROM notifications
            WHERE (user_id IS NULL OR user_id = ?) AND is_read = 0
        ");
        $stmt->execute([$user_id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'count' => (int)$result['count']]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

// Mark As Read
function markAsRead($db) {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        $ids = $input['ids'] ?? [];

        if (empty($ids)) {
            echo json_encode(['success' => false, 'message' => 'No notification IDs provided']);
            return;
        }

        $placeholders = str_repeat('?,', count($ids) - 1) . '?';
        $stmt = $db->prepare("UPDATE notifications SET is_read = 1 WHERE id IN ($placeholders)");
        $stmt->execute($ids);

        echo json_encode(['success' => true, 'message' => 'Notifications marked as read']);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

// Create Notification
function createNotification($db) {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        $user_id = $input['user_id'] ?? null;
        $type = $input['type'];
        $title = $input['title'];
        $message = $input['message'];

        if (!$type || !$title || !$message) {
            echo json_encode(['success' => false, 'message' => 'Missing required fields']);
            return;
        }

        $stmt = $db->prepare("
            INSERT INTO notifications (user_id, type, title, message)
            VALUES (?, ?, ?, ?)
        ");
        $stmt->execute([$user_id, $type, $title, $message]);

        echo json_encode(['success' => true, 'id' => $db->lastInsertId()]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

// Get Alert Rules
function getAlertRules($db) {
    try {
        $user_id = getCurrentUserId();
        $stmt = $db->prepare("
            SELECT * FROM alert_rules
            WHERE user_id IS NULL OR user_id = ?
            ORDER BY rule_type
        ");
        $stmt->execute([$user_id]);
        $rules = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'data' => $rules]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

// Update Alert Rule
function updateAlertRule($db) {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = $input['id'];
        $threshold = $input['threshold'] ?? 0;
        $enabled = $input['enabled'] ?? 1;

        $stmt = $db->prepare("UPDATE alert_rules SET threshold = ?, enabled = ? WHERE id = ?");
        $stmt->execute([$threshold, $enabled, $id]);

        echo json_encode(['success' => true, 'message' => 'Alert rule updated']);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

// Check Alerts
function checkAlerts($db) {
    try {
        // Check low stock
        $stmt = $db->prepare("SELECT COUNT(*) as count FROM products WHERE stock_quantity <= (SELECT setting_value FROM settings WHERE setting_key = 'stockThreshold')");
        $stmt->execute();
        $lowStockCount = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

        if ($lowStockCount > 0) {
            createAlertIfNotExists($db, 'low_stock', 'Low Stock Alert', "You have $lowStockCount products with low stock levels.");
        }

        // Check overdue invoices
        $stmt = $db->prepare("SELECT COUNT(*) as count FROM invoices WHERE status = 'Unpaid' AND due_date < CURDATE()");
        $stmt->execute();
        $overdueCount = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

        if ($overdueCount > 0) {
            createAlertIfNotExists($db, 'overdue_invoice', 'Overdue Invoices', "You have $overdueCount overdue invoices.");
        }

        // Check pending orders
        $stmt = $db->prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'Pending'");
        $stmt->execute();
        $pendingOrders = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

        if ($pendingOrders > 0) {
            createAlertIfNotExists($db, 'pending_order', 'Pending Orders', "You have $pendingOrders pending orders.");
        }

        // Check service due dates
        $stmt = $db->prepare("SELECT COUNT(*) as count FROM warranties WHERE next_service <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND status = 'Active'");
        $stmt->execute();
        $serviceDueCount = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

        if ($serviceDueCount > 0) {
            createAlertIfNotExists($db, 'service_due', 'Service Due', "You have $serviceDueCount warranties due for service soon.");
        }

        echo json_encode(['success' => true, 'message' => 'Alerts checked']);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

// Create Alert If Not Exists
function createAlertIfNotExists($db, $type, $title, $message) {
    // Check if similar alert exists in last 24 hours
    $stmt = $db->prepare("
        SELECT COUNT(*) as count FROM notifications
        WHERE type = ? AND title = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)
    ");
    $stmt->execute([$type, $title]);
    $exists = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

    if ($exists == 0) {
        $stmt = $db->prepare("INSERT INTO notifications (type, title, message) VALUES (?, ?, ?)");
        $stmt->execute([$type, $title, $message]);
    }
}

// Delete Notification
function deleteNotification($db) {
    try {
        $id = $_GET['id'] ?? null;
        if (!$id) {
            echo json_encode(['success' => false, 'message' => 'Notification ID required']);
            return;
        }

        $stmt = $db->prepare("DELETE FROM notifications WHERE id = ?");
        $stmt->execute([$id]);

        echo json_encode(['success' => true, 'message' => 'Notification deleted']);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

// Get Current User Id
function getCurrentUserId() {
    // Ensure the PHP session is active without triggering duplicate session warnings.
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    return $_SESSION['user_id'] ?? null;
}
?>
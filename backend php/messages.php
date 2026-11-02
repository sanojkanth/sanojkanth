<?php
/**
 * Messages API for Central Hardwares
 * Handles sending and retrieving SMS/in-app messages
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

try {
    switch ($method) {
        case 'GET':
            handleGetRequest($db);
            break;
        case 'POST':
            handlePostRequest($db);
            break;
        default:
            jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
    }
} catch (Exception $e) {
    error_log('Messages API Error: ' . $e->getMessage());
    jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
}

// Handle Get Request
function handleGetRequest($db) {
    $action = $_GET['action'] ?? 'list';
    
    switch ($action) {
        case 'list':
            listMessages($db);
            break;
        case 'history':
            getMessageHistory($db);
            break;
        default:
            jsonResponse(['success' => false, 'error' => 'Invalid action']);
    }
}

// Handle Post Request
function handlePostRequest($db) {
    $action = $_GET['action'] ?? 'send';
    
    switch ($action) {
        case 'send':
            sendMessage($db);
            break;
        default:
            jsonResponse(['success' => false, 'error' => 'Invalid action']);
    }
}

// Send Message
function sendMessage($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Validate required fields
    if (empty($data['to_phone']) || empty($data['message'])) {
        jsonResponse(['success' => false, 'error' => 'Missing required fields: to_phone, message']);
        return;
    }
    
    $fromUserId = getCurrentUserId();
    if (!$fromUserId) {
        jsonResponse(['success' => false, 'error' => 'User not authenticated'], 401);
        return;
    }
    
    // Get current user info
    $user = getCurrentUser();
    if (!$user) {
        jsonResponse(['success' => false, 'error' => 'User not found'], 404);
        return;
    }
    
    // Clean and validate phone number
    $toPhone = cleanPhone($data['to_phone']);
    if (!$toPhone) {
        jsonResponse(['success' => false, 'error' => 'Invalid phone number']);
        return;
    }
    
    $message = trim($data['message']);
    $toName = $data['to_name'] ?? 'Contact';
    $toRole = $data['to_role'] ?? null;
    $serviceId = $data['service_id'] ?? null;
    
    try {
        // Insert message into database
        $stmt = $db->prepare("
            INSERT INTO messages (from_user_id, from_role, to_phone, to_name, to_role, message, service_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'sent')
        ");
        
        $stmt->execute([
            $fromUserId,
            $user['role'],
            $toPhone,
            $toName,
            $toRole,
            $message,
            $serviceId
        ]);
        
        $messageId = $db->lastInsertId();
        
        // Log the activity
        logActivity("Message sent to $toName", "SMS sent to $toPhone for service #$serviceId", "Message");
        
        jsonResponse([
            'success' => true,
            'message' => 'Message sent successfully',
            'message_id' => $messageId,
            'data' => [
                'id' => $messageId,
                'to_phone' => $toPhone,
                'to_name' => $toName,
                'message' => $message,
                'created_at' => date('Y-m-d H:i:s')
            ]
        ]);
        
    } catch (Exception $e) {
        error_log('Failed to send message: ' . $e->getMessage());
        jsonResponse(['success' => false, 'error' => 'Failed to send message: ' . $e->getMessage()], 500);
    }
}

// List Messages
function listMessages($db) {
    try {
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        $phone = $_GET['phone'] ?? null;
        $serviceId = $_GET['service_id'] ?? null;
        
        $query = "
            SELECT 
                m.*,
                u.username as from_username,
                u.role as from_user_role
            FROM messages m
            JOIN users u ON m.from_user_id = u.id
            WHERE 1=1
        ";
        
        $params = [];
        
        if ($phone) {
            $query .= " AND m.to_phone = ?";
            $params[] = cleanPhone($phone);
        }
        
        if ($serviceId) {
            $query .= " AND m.service_id = ?";
            $params[] = (int)$serviceId;
        }
        
        $query .= " ORDER BY m.created_at DESC LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;
        
        $stmt = $db->prepare($query);
        $stmt->execute($params);
        $messages = $stmt->fetchAll();
        
        jsonResponse([
            'success' => true,
            'data' => $messages,
            'count' => count($messages)
        ]);
        
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

// Get Message History
function getMessageHistory($db) {
    try {
        $phone = $_GET['phone'] ?? null;
        
        if (!$phone) {
            jsonResponse(['success' => false, 'error' => 'Phone number required']);
            return;
        }
        
        $cleanPhone = cleanPhone($phone);
        
        $stmt = $db->prepare("
            SELECT 
                m.*,
                u.username as from_username,
                s.type as service_type,
                s.status as service_status
            FROM messages m
            JOIN users u ON m.from_user_id = u.id
            LEFT JOIN services s ON m.service_id = s.id
            WHERE m.to_phone = ?
            ORDER BY m.created_at DESC
            LIMIT 100
        ");
        
        $stmt->execute([$cleanPhone]);
        $messages = $stmt->fetchAll();
        
        jsonResponse([
            'success' => true,
            'phone' => $phone,
            'messages' => $messages,
            'count' => count($messages)
        ]);
        
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

/**
 * Clean phone number - remove spaces, dashes, parentheses
 * Keep only digits and leading +
 */
function cleanPhone($phone) {
    if (!$phone) return null;
    $clean = preg_replace('/[^0-9+]/', '', (string)$phone);
    if (strlen($clean) < 7) return null;
    return $clean;
}

/**
 * Get current authenticated user ID from session
 */
function getCurrentUserId() {
    return $_SESSION['user_id'] ?? null;
}

/**
 * Get current user from database
 */
function getCurrentUser() {
    $userId = getCurrentUserId();
    if (!$userId) return null;
    
    $db = getDB();
    $stmt = $db->prepare("SELECT id, username, email, role FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    return $stmt->fetch();
}

/**
 * Log activity to database
 */
function logActivity($action, $details, $category = 'System') {
    try {
        $db = getDB();
        $userId = getCurrentUserId();
        $username = '';
        
        if ($userId) {
            $user = getCurrentUser();
            $username = $user['username'] ?? 'Unknown';
        }
        
        $stmt = $db->prepare("
            INSERT INTO activity_logs (user, action, details, status)
            VALUES (?, ?, ?, 'Completed')
        ");
        $stmt->execute([$username, $action, $details]);
    } catch (Exception $e) {
        error_log('Failed to log activity: ' . $e->getMessage());
    }
}

// Json Response
function jsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit();
}
?>
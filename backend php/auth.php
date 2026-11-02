<?php
/**
 * Authentication API
 * POST /api/auth.php?action=login
 * POST /api/auth.php?action=signup
 * POST /api/auth.php?action=logout
 * GET  /api/auth.php?action=check
 */
require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'login':
        handleLogin();
        break;
    case 'signup':
        handleSignup();
        break;
    case 'logout':
        handleLogout();
        break;
    case 'check':
        checkSession();
        break;
    case 'change-password':
        handleChangePassword();
        break;

    default:
        jsonResponse(['success' => false, 'error' => 'Invalid action'], 400);
}

// Handle Login
function handleLogin() {
    $data = getRequestBody();
    $email = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';

    if (!$email || !$password) {
        jsonResponse(['success' => false, 'error' => 'Email and password are required'], 400);
    }

    $db = getDB();
    
    // Check if table exists to prevent crash
    try {
        $db->query("SELECT 1 FROM users LIMIT 1");
    } catch (PDOException $e) {
        jsonResponse(['success' => false, 'error' => 'Database tables are not set up. Please run the setup script or contact support.'], 500);
    }

    $stmt = $db->prepare("SELECT * FROM users WHERE email = :email LIMIT 1");
    $stmt->execute(['email' => strtolower($email)]);
    $user = $stmt->fetch();

    if (!$user) {
        jsonResponse(['success' => false, 'error' => 'User not found'], 401);
    }

    // Verify password (bcrypt)
    if (!password_verify($password, $user['password'])) {
        // Fallback: check base64 encoded (legacy from localStorage version)
        $decoded = base64_decode($user['password']);
        if ($password !== $decoded) {
            jsonResponse(['success' => false, 'error' => 'Incorrect password'], 401);
        }
    }

    // Update last login
    $now = date('d M, h:i A');
    $db->prepare("UPDATE users SET last_login = :login WHERE id = :id")
       ->execute(['login' => $now, 'id' => $user['id']]);

    // Store session
    $_SESSION['user'] = [
        'id' => $user['id'],
        'name' => $user['username'],
        'email' => $user['email'],
        'role' => $user['role'],
        'image' => $user['image']
    ];

    // Log activity
    logActivity($db, $user['username'], 'User Login', 'User ' . $user['username'] . ' logged in');

    jsonResponse([
        'success' => true,
        'user' => [
            'name' => $user['username'],
            'email' => $user['email'],
            'role' => $user['role'],
            'image' => $user['image']
        ]
    ]);
}

// Handle Signup
function handleSignup() {
    $data = getRequestBody();
    $name = trim($data['name'] ?? '');
    $email = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';

    if (!$name || !$email || !$password) {
        jsonResponse(['success' => false, 'error' => 'All fields are required'], 400);
    }

    $db = getDB();

    // Check if email exists
    $stmt = $db->prepare("SELECT id FROM users WHERE email = :email");
    $stmt->execute(['email' => strtolower($email)]);
    if ($stmt->fetch()) {
        jsonResponse(['success' => false, 'error' => 'An account with this email already exists'], 409);
    }

    // Hash password
    $hashedPassword = password_hash($password, PASSWORD_BCRYPT);

    $stmt = $db->prepare("INSERT INTO users (username, email, password, role) VALUES (:name, :email, :pass, 'Staff')");
    $stmt->execute([
        'name' => $name,
        'email' => strtolower($email),
        'pass' => $hashedPassword
    ]);

    logActivity($db, $name, 'New User Created', 'Account created for ' . $name);

    jsonResponse(['success' => true, 'message' => 'Account created successfully']);
}

// Handle Logout
function handleLogout() {
    $user = $_SESSION['user'] ?? null;
    
    if ($user) {
        $db = getDB();
        $userName = $user['name'];
        
        // Find the latest active log to calculate duration for the session
        $stmt = $db->prepare("SELECT id, created_at FROM activity_logs WHERE user = :user AND status = 'Active' ORDER BY id DESC LIMIT 1");
        $stmt->execute(['user' => $userName]);
        $activeLog = $stmt->fetch();

        $logoutTime = date('h:i:s A');
        $logoutAt = date('Y-m-d H:i:s');
        $durationStr = '-';

        if ($activeLog) {
            $created_at = strtotime($activeLog['created_at']);
            $now = time();
            $diffMinutes = max(0, round(($now - $created_at) / 60));

            $hours = floor($diffMinutes / 60);
            $mins = $diffMinutes % 60;
            $durationStr = $hours > 0 ? "{$hours}h {$mins}m" : "{$mins}m";
            
            // Update the user's total/last duration
            $db->prepare("UPDATE users SET duration = :dur WHERE username = :uname")
               ->execute(['dur' => $durationStr, 'uname' => $userName]);
        }

        // Close ALL active logs for this user with the logout time
        $updateStmt = $db->prepare("UPDATE activity_logs 
            SET logout_time = :logout, 
                logout_at = :logout_at, 
                duration = CASE WHEN duration = 'Active' OR duration = '---' THEN :dur ELSE duration END, 
                status = 'Closed' 
            WHERE user = :user AND status = 'Active'");
        
        $updateStmt->execute([
            'logout' => $logoutTime,
            'logout_at' => $logoutAt,
            'dur' => $durationStr,
            'user' => $userName
        ]);
    }

    session_destroy();
    jsonResponse(['success' => true, 'message' => 'Logged out successfully']);
}

// Check Session
function checkSession() {
    if (isset($_SESSION['user'])) {
        jsonResponse(['success' => true, 'user' => $_SESSION['user']]);
    } else {
        jsonResponse(['success' => false, 'error' => 'Not logged in'], 401);
    }
}

// Handle Change Password
function handleChangePassword() {
    // Check if user is logged in
    if (!isset($_SESSION['user'])) {
        jsonResponse(['success' => false, 'error' => 'Not logged in'], 401);
        return;
    }

    $data = getRequestBody();
    $newPassword = $data['newPassword'] ?? '';

    // Validate new password
    if (empty($newPassword)) {
        jsonResponse(['success' => false, 'error' => 'New password cannot be empty'], 400);
        return;
    }

    if (strlen($newPassword) < 6) {
        jsonResponse(['success' => false, 'error' => 'Password must be at least 6 characters'], 400);
        return;
    }

    $userId = $_SESSION['user']['id'] ?? null;
    $userName = $_SESSION['user']['name'] ?? null;

    if (!$userId || !$userName) {
        jsonResponse(['success' => false, 'error' => 'Session data invalid'], 400);
        return;
    }

    try {
        $db = getDB();
        $hashedPassword = password_hash($newPassword, PASSWORD_BCRYPT);

        $stmt = $db->prepare("UPDATE users SET password = :pass WHERE id = :id");
        $stmt->execute([
            'pass' => $hashedPassword,
            'id' => $userId
        ]);

        // Log the password change activity
        logActivity($db, $userName, 'Password Changed', 'User ' . $userName . ' changed their password');

        jsonResponse(['success' => true, 'message' => 'Password updated successfully']);
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'error' => 'Failed to update password: ' . $e->getMessage()], 500);
    }
}
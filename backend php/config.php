<?php
/**
 * Database Configuration for Central Hardwares
 * WampServer MySQL Connection
 * Auto-creates the database and tables if they don't exist.
 */

// 1. MUST start session before any output or CORS headers
if (session_status() === PHP_SESSION_NONE) {
    // Increase session lifetime to 30 days
    ini_set('session.gc_maxlifetime', 2592000);
    ini_set('session.cookie_lifetime', 2592000);
    
    // Ensure cookie is available across the entire site
    session_set_cookie_params([
        'lifetime' => 2592000,
        'path' => '/',
        'secure' => false, // Set to true if using HTTPS
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
    
    @session_start();
}

// 2. Timezone Configuration
date_default_timezone_set('Asia/Colombo');

// 3. CORS Headers (Must be explicit for credentials)
$origin = $_SERVER['HTTP_ORIGIN'] ?? 'http://localhost';
header("Access-Control-Allow-Origin: $origin");
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Database credentials (WampServer defaults)
define('DB_HOST', '127.0.0.1');
define('DB_NAME', 'central_hardwares');
define('DB_USER', 'root');
define('DB_PASS', '');       // WampServer default: no password
define('DB_CHARSET', 'utf8mb4');

// Gmail SMTP config for password reset emails
// Use a Gmail App Password (not your normal Gmail password):
// Google Account -> Security -> 2-Step Verification -> App passwords
define('MAIL_SMTP_HOST', 'smtp.gmail.com');
define('MAIL_SMTP_PORT', 587);
define('MAIL_FROM_EMAIL', '');      // e.g. yourname@gmail.com
define('MAIL_FROM_NAME', 'Central Hardwares');
define('MAIL_SMTP_USER', '');       // same as Gmail address
define('MAIL_SMTP_PASS', '');       // 16-character App Password

/**
 * Get PDO database connection
 * Auto-creates the database and tables if they don't exist.
 */
function getDB() {
    static $pdo = null;
    if ($pdo === null) {
        try {
            // First, connect without specifying a database to check/create it
            $dsn_no_db = "mysql:host=" . DB_HOST . ";charset=" . DB_CHARSET;
            $pdo_temp = new PDO($dsn_no_db, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);

            // Create database if it doesn't exist
            $pdo_temp->exec("CREATE DATABASE IF NOT EXISTS `" . DB_NAME . "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            $pdo_temp = null; // Close temporary connection

            // Now connect to the actual database
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);

            // Auto-create tables if they don't exist
            ensureTables($pdo);

        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Database connection failed: ' . $e->getMessage()]);
            exit();
        }
    }
    return $pdo;
}

/**
 * Ensure all required tables exist. Creates them if missing.
 * Also seeds initial data if tables are empty.
 */
function ensureTables($pdo) {
    // Always attempt to create tables using IF NOT EXISTS
    // (Existing return logic was too aggressive)

    // --- CREATE ALL TABLES ---
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");

    // Users
    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('Admin','Staff') DEFAULT 'Staff',
        image LONGTEXT DEFAULT NULL,
        last_login VARCHAR(100) DEFAULT 'Never',
        duration VARCHAR(50) DEFAULT '-',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    try {
        $userColumns = [
            'phone' => "ALTER TABLE users ADD COLUMN phone VARCHAR(20) DEFAULT NULL"
        ];
        foreach ($userColumns as $column => $sql) {
            $exists = $pdo->query("SHOW COLUMNS FROM users LIKE '$column'")->rowCount() > 0;
            if (!$exists) {
                $pdo->exec($sql);
            }
        }
    } catch (Exception $e) {
        // Ignore if ALTER TABLE is not supported by older MySQL versions
    }

    // Products
    $pdo->exec("CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        category VARCHAR(100) NOT NULL,
        price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        stock INT NOT NULL DEFAULT 0,
        sold INT NOT NULL DEFAULT 0,
        incoming_stock INT DEFAULT 0,
        image LONGTEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Customers
    $pdo->exec("CREATE TABLE IF NOT EXISTS customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        email VARCHAR(150) DEFAULT NULL,
        address VARCHAR(300) DEFAULT NULL,
        points INT DEFAULT 0,
        product VARCHAR(200) DEFAULT NULL,
        warranty VARCHAR(100) DEFAULT NULL,
        buy_date DATE DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Suppliers
    $pdo->exec("CREATE TABLE IF NOT EXISTS suppliers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        type ENUM('Wholesaler','Distributor','Manufacturer') DEFAULT 'Wholesaler',
        phone VARCHAR(30) DEFAULT NULL,
        email VARCHAR(150) DEFAULT NULL,
        address VARCHAR(300) DEFAULT NULL,
        website VARCHAR(200) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Orders
    $pdo->exec("CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        supplier VARCHAR(200) DEFAULT NULL,
        order_date DATE NOT NULL,
        expected_delivery_date DATE DEFAULT NULL,
        received_at DATETIME DEFAULT NULL,
        total DECIMAL(12,2) DEFAULT 0.00,
        status ENUM('Pending','Ordered','Completed','Cancelled') DEFAULT 'Pending',
        stock_updated TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT DEFAULT NULL,
        product_name VARCHAR(200) NOT NULL,
        qty INT NOT NULL DEFAULT 1,
        price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Invoices
    $pdo->exec("CREATE TABLE IF NOT EXISTS invoices (
        id VARCHAR(20) PRIMARY KEY,
        customer VARCHAR(200) NOT NULL,
        phone VARCHAR(30) DEFAULT NULL,
        invoice_date DATE NOT NULL,
        due_date DATE DEFAULT NULL,
        tax DECIMAL(5,2) DEFAULT 0.00,
        notes TEXT DEFAULT NULL,
        status ENUM('Paid','Unpaid','Overdue') DEFAULT 'Unpaid',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS invoice_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_id VARCHAR(20) NOT NULL,
        name VARCHAR(200) NOT NULL,
        qty INT NOT NULL DEFAULT 1,
        price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Finance
    $pdo->exec("CREATE TABLE IF NOT EXISTS finance_income (
        id INT AUTO_INCREMENT PRIMARY KEY,
        income_date DATE NOT NULL,
        type VARCHAR(100) NOT NULL,
        method VARCHAR(100) NOT NULL,
        quantity INT DEFAULT NULL,
        amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS finance_expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        expense_date DATE NOT NULL,
        category VARCHAR(100) NOT NULL,
        description VARCHAR(300) NOT NULL,
        quantity INT DEFAULT NULL,
        amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        ref_order INT DEFAULT NULL,
        staff_id INT DEFAULT NULL,
        approval_status ENUM('Approved','Pending','Rejected') DEFAULT 'Approved',
        submitted_by VARCHAR(100) DEFAULT NULL,
        reviewed_by VARCHAR(100) DEFAULT NULL,
        reviewed_at DATETIME DEFAULT NULL,
        review_note TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Services
    $pdo->exec("CREATE TABLE IF NOT EXISTS services (
        id VARCHAR(20) PRIMARY KEY,
        customer VARCHAR(200) NOT NULL,
        email VARCHAR(150) DEFAULT NULL,
        type ENUM('Repair','Delivery Only','Installation','Maintenance') DEFAULT 'Repair',
        priority ENUM('Low','Medium','High','Urgent') DEFAULT 'Medium',
        status ENUM('Requested','In Progress','Completed') DEFAULT 'Requested',
        delivery VARCHAR(100) DEFAULT 'N/A',
        staff VARCHAR(100) DEFAULT 'Unassigned',
        cost DECIMAL(10,2) DEFAULT 0.00,
        phone VARCHAR(30) DEFAULT NULL,
        address VARCHAR(300) DEFAULT NULL,
        service_date DATE DEFAULT NULL,
        eta DATETIME DEFAULT NULL,
        assigned_at DATETIME DEFAULT NULL,
        en_route_at DATETIME DEFAULT NULL,
        on_site_at DATETIME DEFAULT NULL,
        completed_at DATETIME DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        rating TINYINT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    try {
        $columns = [
            'email' => "ALTER TABLE services ADD COLUMN email VARCHAR(150) DEFAULT NULL",
            'eta' => "ALTER TABLE services ADD COLUMN eta DATETIME DEFAULT NULL",
            'assigned_at' => "ALTER TABLE services ADD COLUMN assigned_at DATETIME DEFAULT NULL",
            'en_route_at' => "ALTER TABLE services ADD COLUMN en_route_at DATETIME DEFAULT NULL",
            'on_site_at' => "ALTER TABLE services ADD COLUMN on_site_at DATETIME DEFAULT NULL",
            'completed_at' => "ALTER TABLE services ADD COLUMN completed_at DATETIME DEFAULT NULL",
            'notes' => "ALTER TABLE services ADD COLUMN notes TEXT DEFAULT NULL",
            'rating' => "ALTER TABLE services ADD COLUMN rating TINYINT DEFAULT NULL"
        ];
        foreach ($columns as $column => $sql) {
            $exists = $pdo->query("SHOW COLUMNS FROM services LIKE '$column'")->rowCount() > 0;
            if (!$exists) {
                $pdo->exec($sql);
            }
        }
    } catch (Exception $e) {
        // Ignore if ALTER TABLE is not supported by older MySQL versions
    }

    try {
        $expenseColumns = [
            'staff_id' => "ALTER TABLE finance_expenses ADD COLUMN staff_id INT DEFAULT NULL AFTER ref_order",
            'approval_status' => "ALTER TABLE finance_expenses ADD COLUMN approval_status ENUM('Approved','Pending','Rejected') DEFAULT 'Approved'",
            'submitted_by' => "ALTER TABLE finance_expenses ADD COLUMN submitted_by VARCHAR(100) DEFAULT NULL",
            'reviewed_by' => "ALTER TABLE finance_expenses ADD COLUMN reviewed_by VARCHAR(100) DEFAULT NULL",
            'reviewed_at' => "ALTER TABLE finance_expenses ADD COLUMN reviewed_at DATETIME DEFAULT NULL",
            'review_note' => "ALTER TABLE finance_expenses ADD COLUMN review_note TEXT DEFAULT NULL",
            'updated_at' => "ALTER TABLE finance_expenses ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        ];
        foreach ($expenseColumns as $column => $sql) {
            $exists = $pdo->query("SHOW COLUMNS FROM finance_expenses LIKE '$column'")->rowCount() > 0;
            if (!$exists) {
                $pdo->exec($sql);
            }
        }
    } catch (Exception $e) {
        // Ignore if ALTER TABLE is not supported by older MySQL versions
    }

    $pdo->exec("CREATE TABLE IF NOT EXISTS warranties (
        id VARCHAR(20) PRIMARY KEY,
        serial_number VARCHAR(50) NOT NULL,
        product VARCHAR(200) NOT NULL,
        customer VARCHAR(200) NOT NULL,
        cycle VARCHAR(50) DEFAULT '6 Months',
        next_service DATE DEFAULT NULL,
        status ENUM('Active','Expired') DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS staff_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        role VARCHAR(50) DEFAULT 'Technician',
        phone VARCHAR(30) DEFAULT NULL,
        status ENUM('Active','Busy','Off') DEFAULT 'Active',
        tasks INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Activity Logs
    $pdo->exec("CREATE TABLE IF NOT EXISTS activity_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user VARCHAR(100) NOT NULL,
        action VARCHAR(100) DEFAULT NULL,
        details TEXT DEFAULT NULL,
        log_date DATE NOT NULL,
        login_time VARCHAR(30) DEFAULT NULL,
        logout_time VARCHAR(30) DEFAULT '---',
        logout_at DATETIME DEFAULT NULL,
        duration VARCHAR(30) DEFAULT 'Active',
        status ENUM('Active','Closed') DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    try {
        $logoutAtExists = $pdo->query("SHOW COLUMNS FROM activity_logs LIKE 'logout_at'")->rowCount() > 0;
        if (!$logoutAtExists) {
            $pdo->exec("ALTER TABLE activity_logs ADD COLUMN logout_at DATETIME DEFAULT NULL");
        }
    } catch (Exception $e) {
        // Ignore if ALTER TABLE is not supported by older MySQL versions
    }

    // Ensure password reset columns exist in users table
    try {
        $resetCodeExists = $pdo->query("SHOW COLUMNS FROM users LIKE 'reset_code'")->rowCount() > 0;
        if (!$resetCodeExists) {
            $pdo->exec("ALTER TABLE users ADD COLUMN reset_code VARCHAR(6) DEFAULT NULL");
            $pdo->exec("ALTER TABLE users ADD COLUMN reset_expires DATETIME DEFAULT NULL");
        }
    } catch (Exception $e) {}

    // Settings
    $pdo->exec("CREATE TABLE IF NOT EXISTS settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(100) NOT NULL UNIQUE,
        setting_value TEXT DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");

    try {
        $orderColumns = [
            'expected_delivery_date' => "ALTER TABLE orders ADD COLUMN expected_delivery_date DATE DEFAULT NULL AFTER order_date",
            'received_at' => "ALTER TABLE orders ADD COLUMN received_at DATETIME DEFAULT NULL AFTER expected_delivery_date",
            'stock_updated' => "ALTER TABLE orders ADD COLUMN stock_updated TINYINT(1) NOT NULL DEFAULT 0 AFTER status"
        ];
        foreach ($orderColumns as $column => $sql) {
            $exists = $pdo->query("SHOW COLUMNS FROM orders LIKE '$column'")->rowCount() > 0;
            if (!$exists) {
                $pdo->exec($sql);
            }
        }
        $pdo->exec("ALTER TABLE orders MODIFY COLUMN status ENUM('Pending','Ordered','Completed','Cancelled') DEFAULT 'Pending'");
    } catch (Exception $e) {
        // Ignore if ALTER TABLE is not supported by older MySQL versions
    }

    // Messages
    $pdo->exec("CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        from_user_id INT NOT NULL,
        from_role VARCHAR(50) NOT NULL,
        to_phone VARCHAR(20) NOT NULL,
        to_name VARCHAR(100),
        to_role VARCHAR(50),
        message TEXT NOT NULL,
        service_id VARCHAR(20) DEFAULT NULL,
        status ENUM('sent', 'pending', 'failed') DEFAULT 'sent',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_phone (to_phone),
        INDEX idx_service (service_id),
        INDEX idx_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // --- SEED INITIAL DATA ---
    seedData($pdo);
}

/**
 * Seed initial data into all tables
 */
function seedData($pdo) {
    // Check if we need to seed
    $stmt = $pdo->query("SELECT COUNT(*) FROM users");
    if ($stmt->fetchColumn() > 0) return;

    $hash = password_hash('password', PASSWORD_BCRYPT);

    // Users
    $stmt = $pdo->prepare("INSERT INTO users (username, email, password, role, last_login, duration) VALUES (?,?,?,?,?,?)");
    $users = [
        ['Creamer', 'creamer@gmail.com', $hash, 'Admin', '01 Mar, 12:30 AM', '1h 15m'],
        ['Ssm', 'ssm@gmail.com', $hash, 'Staff', '28 Feb, 04:45 PM', '5h 20m'],
        ['Erakan', 'erakan@gmail.com', $hash, 'Staff', '01 Mar, 10:15 AM', '1h 30m'],
        ['Sanoj', 'sanoj@gmail.com', $hash, 'Staff', '01 Mar, 08:00 AM', '8h 45m'],
        ['Sujith', 'sujith@gmail.com', $hash, 'Staff', '01 Mar, 11:20 AM', '0h 45m'],
    ];
    foreach ($users as $u) { $stmt->execute($u); }

    // Products
    $stmt = $pdo->prepare("INSERT INTO products (name, category, price, cost, stock, sold) VALUES (?,?,?,?,?,?)");
    $products = [
        ['Tokyo Super Cement (50kg)', 'Construction', 2450.00, 2100.00, 150, 450],
        ['Orange Electric Switch', 'Electrical', 450.00, 320.00, 200, 120],
        ['Lanka Tiles 2x2 (White)', 'Flooring', 1250.00, 950.00, 80, 65],
        ['S-Lon PVC Pipe 20mm', 'Plumbing', 320.00, 240.00, 300, 850],
        ['Dulux Weathershield (10L)', 'Paints', 18500.00, 16000.00, 8, 12],
        ['Stanley Claw Hammer', 'Hand Tools', 1850.00, 1400.00, 0, 85],
        ['Makita Angle Grinder 9"', 'Power Tools', 12500.00, 11000.00, 2, 42],
        ['Electrical Conduit (10pk)', 'Electrical', 3500.00, 2800.00, 5, 150],
        ['PPR Gate Valve 1 inch', 'Plumbing', 1200.00, 950.00, 0, 30],
        ['Water Pump 1HP', 'Electrical', 25000.00, 21000.00, 12, 5],
        ['Amano Roofing Sheet (12ft)', 'Construction', 3800.00, 3200.00, 45, 220],
        ['Bosch Drill Machine 13mm', 'Power Tools', 8900.00, 7500.00, 18, 72],
        ['UPVC Window Frame 4x3', 'Construction', 15000.00, 12500.00, 10, 8],
        ['Nippon Emulsion Paint (20L)', 'Paints', 12500.00, 10800.00, 15, 35],
        ['Sand (1 Cube)', 'Construction', 22000.00, 18000.00, 25, 180],
        ['Granite Chips (1 Cube)', 'Construction', 18000.00, 15000.00, 20, 95],
        ['Metal Door 3x7', 'Construction', 28000.00, 24000.00, 6, 18],
        ['PVC Rain Gutter (10ft)', 'Plumbing', 1800.00, 1400.00, 40, 65],
        ['Electrical Wire (100m Roll)', 'Electrical', 4500.00, 3800.00, 35, 110],
        ['Measuring Tape 5m', 'Hand Tools', 650.00, 400.00, 100, 320],
        ['GI Nails 3 inch (1kg)', 'Fasteners', 380.00, 250.00, 0, 890],
        ['Wood Screws Mixed (100pk)', 'Fasteners', 550.00, 350.00, 75, 520],
        ['CPVC Pipe 1/2 inch (10ft)', 'Plumbing', 480.00, 350.00, 120, 210],
        ['LED Bulb 12W (Pack of 5)', 'Electrical', 1200.00, 900.00, 60, 145],
        ['Tile Adhesive 20kg', 'Construction', 2200.00, 1800.00, 35, 88],
        ['Hacksaw Blade Pack (10)', 'Hand Tools', 450.00, 300.00, 50, 175],
        ['Wall Putty 40kg', 'Paints', 3800.00, 3200.00, 22, 42],
        ['Circuit Breaker 32A', 'Electrical', 1800.00, 1350.00, 14, 75],
        ['Plywood Sheet 8x4 (12mm)', 'Construction', 5800.00, 4800.00, 30, 55],
        ['Spirit Level 24 inch', 'Hand Tools', 2200.00, 1600.00, 0, 38],
        ['ACL Cable 1.5mm (90m Coil)', 'Electrical', 16500.00, 14200.00, 24, 58],
        ['Orange LED Tube Light 18W', 'Electrical', 1450.00, 1180.00, 90, 160],
        ['S-Lon Ball Valve 1/2 inch', 'Plumbing', 950.00, 720.00, 48, 96],
        ['S-Lon Water Tank 1000L', 'Plumbing', 46500.00, 39800.00, 7, 11],
        ['Tokyo Cement Block 6 inch', 'Construction', 210.00, 160.00, 850, 2300],
        ['Kelani Sand Paper Assorted Pack', 'Paints', 380.00, 260.00, 140, 310],
        ['Nippon Undercoat White (4L)', 'Paints', 5400.00, 4700.00, 26, 54],
        ['Dulux Gloss Enamel (1L)', 'Paints', 2850.00, 2350.00, 34, 77],
        ['Rhino Joint Tape 45m', 'Construction', 780.00, 610.00, 65, 140],
        ['Rhino Gypsum Board 8x4', 'Construction', 3650.00, 3050.00, 42, 83],
        ['Normal Brick', 'Construction', 68.00, 52.00, 5000, 9800],
        ['6mm TMT Bar (12ft)', 'Construction', 1780.00, 1520.00, 110, 270],
        ['8mm TMT Bar (12ft)', 'Construction', 2980.00, 2550.00, 95, 220],
        ['12mm TMT Bar (12ft)', 'Construction', 6350.00, 5740.00, 60, 145],
        ['PVC Junction Box 4x4', 'Electrical', 160.00, 110.00, 180, 420],
        ['Orange 13A Socket', 'Electrical', 790.00, 620.00, 75, 155],
        ['Ceiling Fan 56 inch', 'Electrical', 12900.00, 10950.00, 18, 33],
        ['Waterproof Extension Cord 4 Way', 'Electrical', 2450.00, 1980.00, 36, 70],
        ['Bathroom Mixer Tap', 'Plumbing', 7200.00, 6100.00, 14, 29],
        ['Kitchen Sink Tap', 'Plumbing', 4850.00, 3980.00, 16, 35],
        ['PVC Floor Trap 110mm', 'Plumbing', 880.00, 650.00, 44, 92],
        ['Toilet Flush Cistern Complete Set', 'Plumbing', 8900.00, 7600.00, 10, 26],
        ['Stanley Adjustable Spanner 10 inch', 'Hand Tools', 2450.00, 1980.00, 28, 63],
        ['Masonry Trowel', 'Hand Tools', 950.00, 720.00, 55, 125],
        ['Wheelbarrow Heavy Duty', 'Hand Tools', 18500.00, 15800.00, 9, 17],
        ['Concrete Mixing Tray', 'Hand Tools', 6900.00, 5700.00, 11, 24],
        ['Bosch Cutting Disc 4 inch', 'Power Tools', 420.00, 290.00, 190, 440],
        ['Makita Drill Bit Set (13pcs)', 'Power Tools', 3850.00, 3150.00, 32, 78],
        ['Welding Electrode 2.5mm (5kg)', 'Power Tools', 4650.00, 3980.00, 22, 51],
        ['Roofing Screw with Washer (100pk)', 'Fasteners', 1550.00, 1180.00, 68, 143],
        ['Anchor Bolt 12mm (Pack of 10)', 'Fasteners', 1350.00, 980.00, 46, 102],
    ];
    foreach ($products as $p) { $stmt->execute($p); }

    // Customers
    $stmt = $pdo->prepare("INSERT INTO customers (name, phone, email, address, points, product, warranty, buy_date) VALUES (?,?,?,?,?,?,?,?)");
    $customers = [
        ['Arulrasa', '0771234567', 'arul@jfn.lk', 'Nallur, Jaffna', 250, 'Tokyo Super Cement', 'No Warranty', '2024-01-15'],
        ['Meera Sivakumar', '0712345678', 'meera@test.com', 'Kodikamam', 150, 'Orange Electric Switch', '2 Years', '2024-02-10'],
        ['Navaratnam & Sons', '0112345678', 'navas@const.lk', 'Colombo 04', 3500, 'S-Lon PVC Pipe', '5 Years', '2023-11-20'],
        ['Kugan Builders', '0775678901', 'kugan@builders.lk', 'Chavakachcheri', 1800, 'Amano Roofing Sheet', '10 Years', '2025-12-05'],
        ['Selvi Hardware', '0769876543', 'selvi.hw@gmail.com', 'Point Pedro', 950, 'Bosch Drill Machine', '1 Year', '2026-01-08'],
        ['Ravi Constructions', '0701122334', 'ravi.const@yahoo.com', 'Kilinochchi', 4200, 'Sand (1 Cube)', 'No Warranty', '2026-01-22'],
        ['Priya Electricals', '0773344556', 'priya.elec@mail.lk', 'Trincomalee', 620, 'Circuit Breaker 32A', '2 Years', '2026-02-01'],
        ['Mohamed Farook', '0765544332', 'farook.m@outlook.com', 'Akkaraipattu', 380, 'Dulux Weathershield', 'No Warranty', '2026-02-08'],
        ['Suren Paint House', '0711234567', 'suren.paint@gmail.com', 'Matale', 2100, 'Nippon Emulsion Paint', 'No Warranty', '2026-02-12'],
        ['Kamala Tiles', '0778899001', 'kamala.tg@hotmail.com', 'Jaffna Town', 1450, 'Lanka Tiles 2x2', '3 Years', '2026-02-18'],
    ];
    foreach ($customers as $c) { $stmt->execute($c); }

    // Suppliers
    $stmt = $pdo->prepare("INSERT INTO suppliers (name, type, phone, email, address, website) VALUES (?,?,?,?,?,?)");
    $suppliers = [
        ['Northern Traders (Jaffna)', 'Wholesaler', '+94 21 222 3456', 'sales@northerntraders.lk', '45 Hospital Rd, Jaffna', 'northerntraders.lk'],
        ['Colombo Tool Center', 'Wholesaler', '+94 11 234 5678', 'info@colombotools.lk', '123 Panchikawatte Rd, Colombo 10', 'colombotools.lk'],
        ['Hill Country Hardware', 'Distributor', '+94 81 223 4567', 'hillsup@kandytls.lk', '89 Kandy Road, Peradeniya', ''],
        ['Southern Hardware Suppliers', 'Wholesaler', '+94 91 234 5678', 'info@southernhw.lk', '56 Galle Road, Matara', 'southernhw.lk'],
        ['Eastern Building Materials', 'Manufacturer', '+94 65 222 8901', 'sales@easternbm.lk', '12 Main Street, Batticaloa', 'easternbm.lk'],
        ['Lanka Paints Distributors', 'Distributor', '+94 11 567 8901', 'orders@lankapaints.lk', '78 Baseline Rd, Colombo 08', 'lankapaints.lk'],
        ['Kandy Tools & Equipment', 'Wholesaler', '+94 81 456 7890', 'info@kandytools.lk', '34 Peradeniya Rd, Kandy', ''],
        ['Jaffna Plumbing Supplies', 'Distributor', '+94 21 333 4567', 'jfnplumbing@gmail.com', '15 Stanley Rd, Jaffna', ''],
    ];
    foreach ($suppliers as $s) { $stmt->execute($s); }

    // Orders
    $stmt = $pdo->prepare("INSERT INTO orders (supplier, order_date, total, status) VALUES (?,?,?,?)");
    $orders = [
        ['Northern Traders (Jaffna)', '2026-01-15', 15450.00, 'Completed'],
        ['Southern Hardware Suppliers', '2026-01-20', 2300.00, 'Completed'],
        ['Eastern Building Materials', '2026-01-25', 45000.00, 'Completed'],
        ['Colombo Tool Center', '2026-01-28', 32500.00, 'Completed'],
        ['Hill Country Hardware', '2026-02-01', 18750.00, 'Completed'],
        ['Northern Traders (Jaffna)', '2026-02-05', 67200.00, 'Pending'],
        ['Lanka Paints Distributors', '2026-02-08', 125000.00, 'Completed'],
        ['Southern Hardware Suppliers', '2026-02-10', 8900.00, 'Pending'],
        ['Eastern Building Materials', '2026-02-12', 55600.00, 'Pending'],
        ['Kandy Tools & Equipment', '2026-02-15', 41300.00, 'Pending'],
        ['Colombo Tool Center', '2026-02-18', 22800.00, 'Pending'],
        ['Jaffna Plumbing Supplies', '2026-02-20', 36500.00, 'Pending'],
    ];
    foreach ($orders as $o) { $stmt->execute($o); }

    // Settings
    $stmt = $pdo->prepare("INSERT INTO settings (setting_key, setting_value) VALUES (?,?)");
    $settings = [
        ['storeName', 'Central Hardwares'], ['location', 'Jaffna, Main St.'],
        ['email', 'info@centralhardwares.lk'], ['phone', '+94 77 123 4567'],
        ['currency', 'LKR'], ['taxLabel', 'VAT'], ['taxRate', '0'],
        ['stockThreshold', '15'], ['expenseApprovalThreshold', '50000'],
        ['invoiceNote', 'Thank you for your business!'],
        ['stripeSecretKey', 'sk_test_your_stripe_secret_key_here'],
        ['stripePublicKey', 'pk_test_your_stripe_public_key_here'],
    ];
    foreach ($settings as $s) { $stmt->execute($s); }

    // Staff members
    $stmt = $pdo->prepare("INSERT INTO staff_members (name, role, phone, status, tasks) VALUES (?,?,?,?,?)");
    $staffList = [
        ['Praveen Arul', 'Technician', '+94 77 123 4567', 'Active', 12],
        ['Tharsan Raj', 'Driver', '+94 77 234 5678', 'Busy', 8],
        ['Mubeen S.', 'Helper', '+94 77 345 6789', 'Active', 5],
        ['Logesh V.', 'Technician', '+94 76 456 7890', 'Off', 3],
    ];
    foreach ($staffList as $s) { $stmt->execute($s); }
}

/**
 * Send JSON response
 */
function jsonResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit();
}

/**
 * Get JSON request body
 */
function getRequestBody() {
    $body = file_get_contents('php://input');
    return json_decode($body, true) ?? [];
}

/**
 * Check if user is authenticated
 */
function requireAuth() {
    if (!isset($_SESSION['user'])) {
        jsonResponse(['success' => false, 'error' => 'Unauthorized'], 401);
    }
    return $_SESSION['user'];
}

/**
 * Log activity to the database
 */
function logActivity($db, $userName, $action, $details, $status = 'Active') {
    try {
        $stmt = $db->prepare("INSERT INTO activity_logs (user, action, details, log_date, login_time, status) VALUES (:user, :action, :details, :log_date, :login_time, :status)");
        $stmt->execute([
            'user' => $userName,
            'action' => $action,
            'details' => $details,
            'log_date' => date('Y-m-d'),
            'login_time' => date('h:i:s A'),
            'status' => $status
        ]);
    } catch (Exception $e) {
        // Silently fail to prevent breaking the main flow
    }
}
-- =============================================
-- Central Hardwares Admin Dashboard Database
-- Complete working SQL for WAMP Server (MySQL / MariaDB)
-- IMPORT: Open phpMyAdmin > Click "Import" tab > Choose this file > Click "Go"
-- OR: Click "SQL" tab > Paste contents > Click "Go"
-- DEFAULT PASSWORD FOR ALL ACCOUNTS: password
-- =============================================

-- Database: `central_hardwares`
CREATE DATABASE IF NOT EXISTS `central_hardwares` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `central_hardwares`;

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

-- =============================================
-- DROP ALL EXISTING TABLES (clean slate)
-- =============================================
DROP TABLE IF EXISTS invoice_items;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS activity_logs;
DROP TABLE IF EXISTS warranties;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS staff_members;
DROP TABLE IF EXISTS finance_expenses;
DROP TABLE IF EXISTS finance_income;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;
-- =============================================
-- 1. USERS TABLE
-- Used by: auth.php, users.php
-- =============================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20) DEFAULT NULL,
    role ENUM('Admin', 'Staff') DEFAULT 'Staff',
    image LONGTEXT DEFAULT NULL,
    reset_code VARCHAR(6) DEFAULT NULL,
    reset_expires DATETIME DEFAULT NULL,
    last_login VARCHAR(100) DEFAULT 'Never',
    duration VARCHAR(50) DEFAULT '-',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
-- bcrypt hash of "password" (cost 10)
-- Demo user accounts removed for repository safety. Create your own account through the signup page.
-- =============================================
-- 2. PRODUCTS TABLE (Inventory)
-- Used by: products.php
-- Columns: id, name, category, price, cost, stock, sold, incoming_stock, image
-- =============================================
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL,
    price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    stock INT NOT NULL DEFAULT 0,
    sold INT NOT NULL DEFAULT 0,
    incoming_stock INT DEFAULT 0,
    image LONGTEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
INSERT INTO products (name, category, price, cost, stock, sold)
VALUES (
        'Tokyo Super Cement (50kg)',
        'Construction',
        2450.00,
        2100.00,
        150,
        450
    ),
    (
        'Orange Electric Switch',
        'Electrical',
        450.00,
        320.00,
        200,
        120
    ),
    (
        'Lanka Tiles 2x2 (White)',
        'Flooring',
        1250.00,
        950.00,
        80,
        65
    ),
    (
        'S-Lon PVC Pipe 20mm',
        'Plumbing',
        320.00,
        240.00,
        300,
        850
    ),
    (
        'Dulux Weathershield (10L)',
        'Paints',
        18500.00,
        16000.00,
        8,
        12
    ),
    (
        'Stanley Claw Hammer',
        'Hand Tools',
        1850.00,
        1400.00,
        0,
        85
    ),
    (
        'Makita Angle Grinder 9"',
        'Power Tools',
        12500.00,
        11000.00,
        2,
        42
    ),
    (
        'Electrical Conduit (10pk)',
        'Electrical',
        3500.00,
        2800.00,
        5,
        150
    ),
    (
        'PPR Gate Valve 1 inch',
        'Plumbing',
        1200.00,
        950.00,
        0,
        30
    ),
    (
        'Water Pump 1HP',
        'Electrical',
        25000.00,
        21000.00,
        12,
        5
    ),
    (
        'Amano Roofing Sheet (12ft)',
        'Construction',
        3800.00,
        3200.00,
        45,
        220
    ),
    (
        'Bosch Drill Machine 13mm',
        'Power Tools',
        8900.00,
        7500.00,
        18,
        72
    ),
    (
        'UPVC Window Frame 4x3',
        'Construction',
        15000.00,
        12500.00,
        10,
        8
    ),
    (
        'Nippon Emulsion Paint (20L)',
        'Paints',
        12500.00,
        10800.00,
        15,
        35
    ),
    (
        'Sand (1 Cube)',
        'Construction',
        22000.00,
        18000.00,
        25,
        180
    ),
    (
        'Granite Chips (1 Cube)',
        'Construction',
        18000.00,
        15000.00,
        20,
        95
    ),
    (
        'Metal Door 3x7',
        'Construction',
        28000.00,
        24000.00,
        6,
        18
    ),
    (
        'PVC Rain Gutter (10ft)',
        'Plumbing',
        1800.00,
        1400.00,
        40,
        65
    ),
    (
        'Electrical Wire (100m Roll)',
        'Electrical',
        4500.00,
        3800.00,
        35,
        110
    ),
    (
        'Measuring Tape 5m',
        'Hand Tools',
        650.00,
        400.00,
        100,
        320
    ),
    (
        'GI Nails 3 inch (1kg)',
        'Fasteners',
        380.00,
        250.00,
        0,
        890
    ),
    (
        'Wood Screws Mixed (100pk)',
        'Fasteners',
        550.00,
        350.00,
        75,
        520
    ),
    (
        'CPVC Pipe 1/2 inch (10ft)',
        'Plumbing',
        480.00,
        350.00,
        120,
        210
    ),
    (
        'LED Bulb 12W (Pack of 5)',
        'Electrical',
        1200.00,
        900.00,
        60,
        145
    ),
    (
        'Tile Adhesive 20kg',
        'Construction',
        2200.00,
        1800.00,
        35,
        88
    ),
    (
        'Hacksaw Blade Pack (10)',
        'Hand Tools',
        450.00,
        300.00,
        50,
        175
    ),
    (
        'Wall Putty 40kg',
        'Paints',
        3800.00,
        3200.00,
        22,
        42
    ),
    (
        'Circuit Breaker 32A',
        'Electrical',
        1800.00,
        1350.00,
        14,
        75
    ),
    (
        'Plywood Sheet 8x4 (12mm)',
        'Construction',
        5800.00,
        4800.00,
        30,
        55
    ),
    (
        'Spirit Level 24 inch',
        'Hand Tools',
        2200.00,
        1600.00,
        0,
        38
    );
-- =============================================
-- 3. CUSTOMERS TABLE
-- Used by: customers.php
-- Columns: id, name, phone, email, address, points, product, warranty, buy_date
-- =============================================
CREATE TABLE customers (
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
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
INSERT INTO customers (
        name,
        phone,
        email,
        address,
        points,
        product,
        warranty,
        buy_date
    )
VALUES (
        'Arulrasa',
        '0771234567',
        'arul@jfn.lk',
        'Nallur, Jaffna',
        250,
        'Tokyo Super Cement',
        'No Warranty',
        '2024-01-15'
    ),
    (
        'Meera Sivakumar',
        '0712345678',
        'meera@test.com',
        'Kodikamam',
        150,
        'Orange Electric Switch',
        '2 Years',
        '2024-02-10'
    ),
    (
        'Navaratnam & Sons',
        '0112345678',
        'navas@const.lk',
        'Colombo 04',
        3500,
        'S-Lon PVC Pipe',
        '5 Years',
        '2023-11-20'
    ),
    (
        'Kugan Builders',
        '0775678901',
        'kugan@builders.lk',
        'Chavakachcheri',
        1800,
        'Amano Roofing Sheet',
        '10 Years',
        '2025-12-05'
    ),
    (
        'Selvi Hardware',
        '0769876543',
        'selvi.hw@gmail.com',
        'Point Pedro',
        950,
        'Bosch Drill Machine',
        '1 Year',
        '2026-01-08'
    ),
    (
        'Ravi Constructions',
        '0701122334',
        'ravi.const@yahoo.com',
        'Kilinochchi',
        4200,
        'Sand (1 Cube)',
        'No Warranty',
        '2026-01-22'
    ),
    (
        'Priya Electricals',
        '0773344556',
        'priya.elec@mail.lk',
        'Trincomalee',
        620,
        'Circuit Breaker 32A',
        '2 Years',
        '2026-02-01'
    ),
    (
        'Mohamed Farook',
        '0765544332',
        'farook.m@outlook.com',
        'Akkaraipattu',
        380,
        'Dulux Weathershield',
        'No Warranty',
        '2026-02-08'
    ),
    (
        'Suren Paint House',
        '0711234567',
        'suren.paint@gmail.com',
        'Matale',
        2100,
        'Nippon Emulsion Paint',
        'No Warranty',
        '2026-02-12'
    ),
    (
        'Kamala Tiles',
        '0778899001',
        'kamala.tg@hotmail.com',
        'Jaffna Town',
        1450,
        'Lanka Tiles 2x2',
        '3 Years',
        '2026-02-18'
    );
-- =============================================
-- 4. SUPPLIERS TABLE
-- Used by: suppliers.php
-- Columns: id, name, type, phone, email, address, website
-- =============================================
CREATE TABLE suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    type ENUM('Wholesaler', 'Distributor', 'Manufacturer') DEFAULT 'Wholesaler',
    phone VARCHAR(30) DEFAULT NULL,
    email VARCHAR(150) DEFAULT NULL,
    address VARCHAR(300) DEFAULT NULL,
    website VARCHAR(200) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
INSERT INTO suppliers (name, type, phone, email, address, website)
VALUES (
        'Northern Traders (Jaffna)',
        'Wholesaler',
        '+94 21 222 3456',
        'sales@northerntraders.lk',
        '45 Hospital Rd, Jaffna',
        'northerntraders.lk'
    ),
    (
        'Colombo Tool Center',
        'Wholesaler',
        '+94 11 234 5678',
        'info@colombotools.lk',
        '123 Panchikawatte Rd, Colombo 10',
        'colombotools.lk'
    ),
    (
        'Hill Country Hardware',
        'Distributor',
        '+94 81 223 4567',
        'hillsup@kandytls.lk',
        '89 Kandy Road, Peradeniya',
        ''
    ),
    (
        'Southern Hardware Suppliers',
        'Wholesaler',
        '+94 91 234 5678',
        'info@southernhw.lk',
        '56 Galle Road, Matara',
        'southernhw.lk'
    ),
    (
        'Eastern Building Materials',
        'Manufacturer',
        '+94 65 222 8901',
        'sales@easternbm.lk',
        '12 Main Street, Batticaloa',
        'easternbm.lk'
    ),
    (
        'Lanka Paints Distributors',
        'Distributor',
        '+94 11 567 8901',
        'orders@lankapaints.lk',
        '78 Baseline Rd, Colombo 08',
        'lankapaints.lk'
    ),
    (
        'Kandy Tools & Equipment',
        'Wholesaler',
        '+94 81 456 7890',
        'info@kandytools.lk',
        '34 Peradeniya Rd, Kandy',
        ''
    ),
    (
        'Jaffna Plumbing Supplies',
        'Distributor',
        '+94 21 333 4567',
        'jfnplumbing@gmail.com',
        '15 Stanley Rd, Jaffna',
        ''
    );
-- =============================================
-- 5. ORDERS TABLE (Supplier Purchase Orders)
-- Used by: orders.php
-- Parent: orders  →  Children: order_items
-- =============================================
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    supplier VARCHAR(200) DEFAULT NULL,
    order_date DATE NOT NULL,
    total DECIMAL(12, 2) DEFAULT 0.00,
    status ENUM('Pending', 'Completed', 'Cancelled') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT DEFAULT NULL,
    product_name VARCHAR(200) NOT NULL,
    qty INT NOT NULL DEFAULT 1,
    price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
INSERT INTO orders (supplier, order_date, total, status)
VALUES (
        'Northern Traders (Jaffna)',
        '2026-01-15',
        15450.00,
        'Completed'
    ),
    (
        'Southern Hardware Suppliers',
        '2026-01-20',
        2300.00,
        'Completed'
    ),
    (
        'Eastern Building Materials',
        '2026-01-25',
        45000.00,
        'Completed'
    ),
    (
        'Colombo Tool Center',
        '2026-01-28',
        32500.00,
        'Completed'
    ),
    (
        'Hill Country Hardware',
        '2026-02-01',
        18750.00,
        'Completed'
    ),
    (
        'Northern Traders (Jaffna)',
        '2026-02-05',
        67200.00,
        'Pending'
    ),
    (
        'Lanka Paints Distributors',
        '2026-02-08',
        125000.00,
        'Completed'
    ),
    (
        'Southern Hardware Suppliers',
        '2026-02-10',
        8900.00,
        'Pending'
    ),
    (
        'Eastern Building Materials',
        '2026-02-12',
        55600.00,
        'Pending'
    ),
    (
        'Kandy Tools & Equipment',
        '2026-02-15',
        41300.00,
        'Pending'
    ),
    (
        'Colombo Tool Center',
        '2026-02-18',
        22800.00,
        'Pending'
    ),
    (
        'Jaffna Plumbing Supplies',
        '2026-02-20',
        36500.00,
        'Pending'
    );
-- Sample order items (linked to orders above)
INSERT INTO order_items (
        order_id,
        product_id,
        product_name,
        qty,
        price,
        total
    )
VALUES (
        1,
        1,
        'Tokyo Super Cement (50kg)',
        50,
        2100.00,
        105000.00
    ),
    (
        1,
        4,
        'S-Lon PVC Pipe 20mm',
        100,
        240.00,
        24000.00
    ),
    (
        2,
        2,
        'Orange Electric Switch',
        50,
        320.00,
        16000.00
    ),
    (
        3,
        15,
        'Sand (1 Cube)',
        5,
        18000.00,
        90000.00
    ),
    (
        4,
        12,
        'Bosch Drill Machine 13mm',
        10,
        7500.00,
        75000.00
    ),
    (
        5,
        11,
        'Amano Roofing Sheet (12ft)',
        20,
        3200.00,
        64000.00
    );
-- =============================================
-- 6. INVOICES TABLE (Customer Sales)
-- Used by: invoices.php
-- Parent: invoices  →  Children: invoice_items
-- =============================================
CREATE TABLE invoices (
    id VARCHAR(20) PRIMARY KEY,
    customer VARCHAR(200) NOT NULL,
    phone VARCHAR(30) DEFAULT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE DEFAULT NULL,
    tax DECIMAL(5, 2) DEFAULT 0.00,
    notes TEXT DEFAULT NULL,
    status ENUM('Paid', 'Unpaid', 'Overdue') DEFAULT 'Unpaid',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
CREATE TABLE invoice_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id VARCHAR(20) NOT NULL,
    name VARCHAR(200) NOT NULL,
    qty INT NOT NULL DEFAULT 1,
    price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
INSERT INTO invoices (
        id,
        customer,
        phone,
        invoice_date,
        due_date,
        tax,
        notes,
        status
    )
VALUES (
        'INV-1001',
        'Logu Swamy',
        '+94 77 234 5678',
        '2026-02-01',
        '2026-02-15',
        0,
        'Delivery to site by Feb 5',
        'Paid'
    ),
    (
        'INV-1002',
        'Senthil Kumar',
        '+94 76 345 6789',
        '2026-02-03',
        '2026-02-17',
        0,
        '',
        'Unpaid'
    ),
    (
        'INV-1003',
        'Amila Perera',
        '+94 71 456 7890',
        '2026-01-15',
        '2026-01-30',
        0,
        'Warranty registered',
        'Overdue'
    ),
    (
        'INV-1004',
        'Nimal Fernando',
        '+94 77 567 8901',
        '2026-02-10',
        '2026-02-24',
        0,
        'Construction site - Kandy Road',
        'Unpaid'
    ),
    (
        'INV-1005',
        'Kusal Mendis',
        '+94 72 678 9012',
        '2026-02-05',
        '2026-02-19',
        0,
        '',
        'Paid'
    );
INSERT INTO invoice_items (invoice_id, name, qty, price)
VALUES (
        'INV-1001',
        'PVC Pipe 2" x 10ft',
        20,
        350.00
    ),
    (
        'INV-1001',
        'Elbow Joint 2"',
        40,
        85.00
    ),
    (
        'INV-1001',
        'Pipe Cement 500ml',
        5,
        420.00
    ),
    (
        'INV-1002',
        'Portland Cement 50kg',
        10,
        1850.00
    ),
    (
        'INV-1002',
        'Sand (cubic yard)',
        2,
        4500.00
    ),
    (
        'INV-1002',
        'Steel Rods 12mm',
        50,
        680.00
    ),
    (
        'INV-1003',
        'Makita Hammer Drill',
        1,
        28500.00
    ),
    (
        'INV-1003',
        'Drill Bit Set (10pc)',
        2,
        3200.00
    ),
    (
        'INV-1004',
        'Roof Tiles (Bundle)',
        15,
        2200.00
    ),
    (
        'INV-1004',
        'Timber 2x4 (8ft)',
        30,
        950.00
    ),
    (
        'INV-1004',
        'Nails 3" (1kg)',
        5,
        380.00
    ),
    (
        'INV-1005',
        'Paint (White 20L)',
        4,
        8500.00
    ),
    (
        'INV-1005',
        'Paint Roller Set',
        2,
        1200.00
    ),
    (
        'INV-1005',
        'Masking Tape (Roll)',
        10,
        250.00
    );
-- =============================================
-- 7. FINANCE TABLES (Income & Expenses)
-- Used by: finance.php
-- =============================================
CREATE TABLE finance_income (
    id INT AUTO_INCREMENT PRIMARY KEY,
    income_date DATE NOT NULL,
    type VARCHAR(100) NOT NULL,
    method VARCHAR(100) NOT NULL,
    quantity INT DEFAULT NULL,
    amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
CREATE TABLE finance_expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    expense_date DATE NOT NULL,
    category VARCHAR(100) NOT NULL,
    description VARCHAR(300) NOT NULL,
    quantity INT DEFAULT NULL,
    amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    ref_order INT DEFAULT NULL,
    staff_id INT DEFAULT NULL,
    approval_status ENUM('Approved', 'Pending', 'Rejected') DEFAULT 'Approved',
    submitted_by VARCHAR(100) DEFAULT NULL,
    reviewed_by VARCHAR(100) DEFAULT NULL,
    reviewed_at DATETIME DEFAULT NULL,
    review_note TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
INSERT INTO finance_income (income_date, type, method, quantity, amount)
VALUES (
        '2026-01-31',
        'Product Sale',
        'Cash',
        5,
        15450.00
    ),
    (
        '2026-01-30',
        'Service',
        'KOKO (Installments)',
        NULL,
        5500.00
    ),
    (
        '2026-01-31',
        'Wholesale',
        'Commercial Bank',
        50,
        145000.00
    ),
    (
        '2026-02-05',
        'Product Sale',
        'Cash',
        8,
        22800.00
    ),
    (
        '2026-02-10',
        'Service',
        'Card',
        NULL,
        8500.00
    ),
    (
        '2026-02-15',
        'Product Sale',
        'Commercial Bank',
        12,
        67500.00
    ),
    (
        '2026-02-20',
        'Wholesale',
        'Cash',
        20,
        92000.00
    ),
    (
        '2026-02-25',
        'Service',
        'Cash',
        NULL,
        3200.00
    );
INSERT INTO finance_expenses (
        expense_date,
        category,
        description,
        quantity,
        amount
    )
VALUES (
        '2026-01-25',
        'Utilities',
        'CEB Monthly Bill',
        NULL,
        12500.00
    ),
    (
        '2026-01-28',
        'Transport',
        'Fuel for delivery',
        NULL,
        4500.00
    ),
    (
        '2026-01-20',
        'Rent',
        'January Warehouse Rent',
        NULL,
        45000.00
    ),
    (
        '2026-01-31',
        'Salary',
        'Staff Salaries (Jan)',
        NULL,
        85000.00
    ),
    (
        '2026-01-05',
        'COGS',
        'Supplier Payment: Cement',
        100,
        350000.00
    ),
    (
        '2026-02-01',
        'Utilities',
        'Water Bill (Feb)',
        NULL,
        3200.00
    ),
    (
        '2026-02-05',
        'Transport',
        'Delivery vehicle fuel',
        NULL,
        6800.00
    ),
    (
        '2026-02-15',
        'Maintenance',
        'Shop Equipment Service',
        NULL,
        15000.00
    ),
    (
        '2026-02-20',
        'Salary',
        'Staff Salaries (Feb)',
        NULL,
        85000.00
    ),
    (
        '2026-02-28',
        'Rent',
        'February Warehouse Rent',
        NULL,
        45000.00
    );
-- =============================================
-- 8. SERVICES & DELIVERY TABLES
-- Used by: services.php (?type=service|warranty|staff)
-- =============================================
CREATE TABLE services (
    id VARCHAR(20) PRIMARY KEY,
    customer VARCHAR(200) NOT NULL,
    type ENUM(
        'Repair',
        'Delivery Only',
        'Installation',
        'Maintenance'
    ) DEFAULT 'Repair',
    priority ENUM('Low', 'Medium', 'High', 'Urgent') DEFAULT 'Medium',
    status ENUM('Requested', 'In Progress', 'Completed') DEFAULT 'Requested',
    delivery VARCHAR(100) DEFAULT 'N/A',
    staff VARCHAR(100) DEFAULT 'Unassigned',
    cost DECIMAL(10, 2) DEFAULT 0.00,
    phone VARCHAR(30) DEFAULT NULL,
    address VARCHAR(300) DEFAULT NULL,
    service_date DATE DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
CREATE TABLE warranties (
    id VARCHAR(20) PRIMARY KEY,
    serial_number VARCHAR(50) NOT NULL,
    product VARCHAR(200) NOT NULL,
    customer VARCHAR(200) NOT NULL,
    cycle VARCHAR(50) DEFAULT '6 Months',
    next_service DATE DEFAULT NULL,
    status ENUM('Active', 'Expired') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
CREATE TABLE staff_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    role VARCHAR(50) DEFAULT 'Technician',
    phone VARCHAR(30) DEFAULT NULL,
    status ENUM('Active', 'Busy', 'Off') DEFAULT 'Active',
    tasks INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
INSERT INTO services (
        id,
        customer,
        type,
        priority,
        status,
        delivery,
        staff,
        cost,
        phone,
        service_date
    )
VALUES (
        'SVC-101',
        'John Doe',
        'Repair',
        'High',
        'In Progress',
        'Pending',
        'Praveen Arul',
        1500.00,
        '+94 77 111 0001',
        '2026-02-10'
    ),
    (
        'SVC-102',
        'Jane Smith',
        'Delivery Only',
        'Medium',
        'Requested',
        'Out for Delivery',
        'Tharsan Raj',
        500.00,
        '+94 77 222 0002',
        '2026-02-12'
    ),
    (
        'SVC-103',
        'Mike Johnson',
        'Installation',
        'Low',
        'Completed',
        'Delivered',
        'Mubeen S.',
        3000.00,
        '+94 77 333 0003',
        '2026-02-08'
    ),
    (
        'SVC-104',
        'Ravi Kumar',
        'Maintenance',
        'Urgent',
        'Requested',
        'N/A',
        'Praveen Arul',
        2200.00,
        '+94 76 444 0004',
        '2026-02-25'
    ),
    (
        'SVC-105',
        'Selvi Raj',
        'Repair',
        'Medium',
        'In Progress',
        'Pending',
        'Tharsan Raj',
        800.00,
        '+94 71 555 0005',
        '2026-02-20'
    );
INSERT INTO warranties (
        id,
        serial_number,
        product,
        customer,
        cycle,
        next_service,
        status
    )
VALUES (
        'WRN-201',
        'SN-8821-X',
        'Makita Power Drill',
        'John Doe',
        '6 Months',
        '2026-08-10',
        'Active'
    ),
    (
        'WRN-202',
        'SN-9932-Y',
        'Bosch Angle Grinder',
        'Jane Smith',
        '1 Year',
        '2027-02-12',
        'Active'
    ),
    (
        'WRN-203',
        'SN-1045-Z',
        'Dulux Weathershield',
        'Ravi Kumar',
        'No Cycle',
        NULL,
        'Expired'
    );
INSERT INTO staff_members (name, role, phone, status, tasks)
VALUES (
        'Praveen Arul',
        'Technician',
        '+94 77 123 4567',
        'Active',
        12
    ),
    (
        'Tharsan Raj',
        'Driver',
        '+94 77 234 5678',
        'Busy',
        8
    ),
    (
        'Mubeen S.',
        'Helper',
        '+94 77 345 6789',
        'Active',
        5
    ),
    (
        'Logesh V.',
        'Technician',
        '+94 76 456 7890',
        'Off',
        3
    );
-- =============================================
-- 9. ACTIVITY LOGS TABLE
-- Used by: activity.php, auth.php (auto-logged)
-- Also written to by: products.php, orders.php, invoices.php, etc.
-- =============================================
CREATE TABLE activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user VARCHAR(100) NOT NULL,
    action VARCHAR(100) DEFAULT NULL,
    details TEXT DEFAULT NULL,
    log_date DATE NOT NULL,
    login_time VARCHAR(30) DEFAULT NULL,
    logout_time VARCHAR(30) DEFAULT '---',
    duration VARCHAR(30) DEFAULT 'Active',
    status ENUM('Active', 'Closed') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
INSERT INTO activity_logs (
        user,
        action,
        details,
        log_date,
        login_time,
        logout_time,
        duration,
        status
    )
VALUES (
        'Creamer',
        'User Login',
        'User Creamer logged in',
        '2026-02-28',
        '08:30 AM',
        '10:45 AM',
        '2h 15m',
        'Closed'
    ),
    (
        'Ssm',
        'User Login',
        'User Ssm logged in',
        '2026-02-28',
        '09:00 AM',
        '---',
        'Active',
        'Active'
    ),
    (
        'Erakan',
        'User Login',
        'User Erakan logged in',
        '2026-02-27',
        '01:15 PM',
        '05:30 PM',
        '4h 15m',
        'Closed'
    ),
    (
        'Creamer',
        'Add Product',
        'Added new product: Cement',
        '2026-02-27',
        '09:10 AM',
        '09:10 AM',
        '-',
        'Closed'
    ),
    (
        'Sujith',
        'User Login',
        'User Sujith logged in',
        '2026-02-26',
        '11:00 AM',
        '12:30 PM',
        '1h 30m',
        'Closed'
    );
-- =============================================
-- 10. SETTINGS TABLE (Key-Value Store)
-- Used by: settings.php, products.php (stockThreshold)
-- =============================================
CREATE TABLE settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT DEFAULT NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
INSERT INTO settings (setting_key, setting_value)
VALUES ('storeName', 'Central Hardwares'),
    ('location', 'Jaffna, Main St.'),
    ('email', 'info@centralhardwares.lk'),
    ('phone', '+94 77 123 4567'),
    ('currency', 'LKR'),
    ('taxLabel', 'VAT'),
    ('taxRate', '0'),m
    ('stockThreshold', '15'),
    ('invoiceNote', 'Thank you for your business!');
-- =============================================
-- 11. NOTIFICATIONS TABLE
-- Used by: notifications.php
-- =============================================
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT DEFAULT NULL,
    type ENUM('low_stock', 'overdue_invoice', 'pending_order', 'service_due', 'system_alert') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- =============================================
-- 12. ALERT_RULES TABLE
-- Used by: notifications.php
-- =============================================
CREATE TABLE alert_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rule_type ENUM('low_stock', 'overdue_invoice', 'pending_order', 'service_due') NOT NULL,
    threshold INT DEFAULT 0,
    enabled TINYINT(1) DEFAULT 1,
    user_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- Insert default alert rules
INSERT INTO alert_rules (rule_type, threshold, enabled) VALUES
('low_stock', 10, 1),
('overdue_invoice', 7, 1),
('pending_order', 1, 1),
('service_due', 3, 1);

-- =============================================
-- 13. MESSAGES TABLE
-- Used by: messages.php
-- Stores SMS/in-app messages sent to customers and technicians
-- =============================================
CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    from_user_id INT NOT NULL,
    from_role VARCHAR(50) NOT NULL,
    to_phone VARCHAR(20) NOT NULL,
    to_name VARCHAR(100),
    to_role VARCHAR(50),
    message TEXT NOT NULL,
    service_id INT DEFAULT NULL,
    status ENUM('sent', 'pending', 'failed') DEFAULT 'sent',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
    INDEX idx_phone (to_phone),
    INDEX idx_service (service_id),
    INDEX idx_created (created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- =============================================
-- DONE — Database ready for use!
-- =============================================
-- 
-- LOGIN CREDENTIALS:
--   Email: creamer@gmail.com    Password: password
--   Email: ssm@gmail.com       Password: password
--   Email: erakan@gmail.com    Password: password
--   Email: sanoj@gmail.com     Password: password
--   Email: sujith@gmail.com    Password: password
--
-- HOW TO USE:
--   1. Open phpMyAdmin: http://localhost/phpmyadmin
--   2. Click "SQL" tab at the top
--   3. Paste this entire SQL and click "Go"
--   4. Open the app: http://localhost/dashboard%20final/New%20folder%20(3)/login.html
--
-- API ENDPOINTS (all in /api/ folder):
--   auth.php       → Login, Logout, Session check
--   users.php      → CRUD users
--   products.php   → CRUD products + stats
--   customers.php  → CRUD customers
--   suppliers.php  → CRUD suppliers
--   orders.php     → CRUD orders with items + stats
--   invoices.php   → CRUD invoices with items
--   finance.php    → Income & Expenses CRUD + stats
--   services.php   → Services, Warranties, Staff CRUD + stats
--   settings.php   → Key-value settings
--   activity.php   → Activity logs (read-only from frontend)
-- =============================================
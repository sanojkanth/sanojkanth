move this feature to the finance section the admin wants to pay the expences through the system<?php
/**
 * Shipping API - FedEx Tracking Integration
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    switch ($method) {
        case 'GET':
            if ($action === 'track') {
                trackShipment();
            }
            break;
        default:
            jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
    }
} catch (Exception $e) {
    jsonResponse(['success' => false, 'error' => 'Server error: ' . $e->getMessage()], 500);
}

// Track Shipment
function trackShipment() {
    $trackingNumber = $_GET['tracking_number'] ?? null;

    if (!$trackingNumber) {
        jsonResponse(['success' => false, 'error' => 'Tracking number required'], 400);
    }

    // Mock FedEx API call - Replace with actual FedEx API integration
    // Requires FedEx API key and proper authentication
    $mockResponse = [
        'tracking_number' => $trackingNumber,
        'status' => 'In Transit',
        'estimated_delivery' => '2026-04-10',
        'events' => [
            ['date' => '2026-04-07', 'status' => 'Picked up'],
            ['date' => '2026-04-08', 'status' => 'In Transit']
        ]
    ];

    jsonResponse(['success' => true, 'data' => $mockResponse]);
}
?>
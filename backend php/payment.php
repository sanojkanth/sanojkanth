<?php
/**
 * Payment API - Stripe Integration
 */
require_once __DIR__ . '/config.php';

$vendorAutoloadPath = __DIR__ . '/../vendor/autoload.php';
if (!file_exists($vendorAutoloadPath)) {
    jsonResponse([
        'success' => false,
        'error' => 'Payment service unavailable: missing Stripe dependencies. Run composer install in the project root.'
    ], 500);
}

require_once $vendorAutoloadPath;

$db = getDB();
$stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'stripeSecretKey'");
$stmt->execute();
$row = $stmt->fetch();
$stripeSecret = $row ? $row['setting_value'] : 'sk_test_your_stripe_secret_key_here';

if (empty($stripeSecret) || $stripeSecret === 'sk_test_your_stripe_secret_key_here') {
    // For development, we might want to allow this to fail gracefully or prompt
    // For now, we'll keep a warning but maybe slightly more informative
    error_log("Stripe Secret Key not configured in settings table.");
}

if (!class_exists('\Stripe\Stripe')) {
    jsonResponse([
        'success' => false,
        'error' => 'Stripe SDK failed to load. Check composer installation and autoload path.'
    ], 500);
}

\Stripe\Stripe::setApiKey($stripeSecret);

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    switch ($method) {
        case 'POST':
            if ($action === 'create_payment_intent') {
                createPaymentIntent();
            } elseif ($action === 'confirm_payment') {
                confirmPayment();
            }
            break;
        default:
            jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
    }
} catch (Exception $e) {
    jsonResponse(['success' => false, 'error' => 'Server error: ' . $e->getMessage()], 500);
}

// Create Payment Intent
function createPaymentIntent() {
    $input = json_decode(file_get_contents('php://input'), true);
    $amount = $input['amount'] ?? 0; // Amount in cents
    $currency = $input['currency'] ?? 'usd';
    $invoiceId = $input['invoice_id'] ?? null;

    if (!$amount || !$invoiceId) {
        jsonResponse(['success' => false, 'error' => 'Amount and invoice_id required'], 400);
    }

    try {
        $paymentIntent = \Stripe\PaymentIntent::create([
            'amount' => $amount,
            'currency' => $currency,
            'metadata' => ['invoice_id' => $invoiceId],
        ]);

        jsonResponse(['success' => true, 'client_secret' => $paymentIntent->client_secret]);
    } catch (\Stripe\Exception\ApiErrorException $e) {
        jsonResponse(['success' => false, 'error' => $e->getMessage()], 400);
    }
}

// Confirm Payment
function confirmPayment() {
    $input = json_decode(file_get_contents('php://input'), true);
    $paymentIntentId = $input['payment_intent_id'] ?? null;
    $invoiceId = $input['invoice_id'] ?? null;

    if (!$paymentIntentId || !$invoiceId) {
        jsonResponse(['success' => false, 'error' => 'Payment intent ID and invoice_id required'], 400);
    }

    try {
        $paymentIntent = \Stripe\PaymentIntent::retrieve($paymentIntentId);

        if ($paymentIntent->status === 'succeeded') {
            // Update invoice status to Paid
            $db = getDB();
            $stmt = $db->prepare("UPDATE invoices SET status = 'Paid' WHERE id = :id");
            $stmt->execute(['id' => $invoiceId]);

            jsonResponse(['success' => true, 'message' => 'Payment confirmed']);
        } else {
            jsonResponse(['success' => false, 'error' => 'Payment not succeeded'], 400);
        }
    } catch (\Stripe\Exception\ApiErrorException $e) {
        jsonResponse(['success' => false, 'error' => $e->getMessage()], 400);
    }
}
?>
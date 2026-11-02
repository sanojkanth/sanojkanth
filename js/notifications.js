/* notifications.js */
// Global notification state
let notificationData = {
    unreadCount: 0,
    notifications: [],
    alertRules: []
};

// Function to check all system levels and update alerts
async function checkSystemAlerts() {
    if (!window.apiFetch) return;

    try {
        // Check for new alerts via the new API
        await checkForNewAlerts();

        // Update unread count
        await updateUnreadNotificationCount();

        // Legacy system checks for backward compatibility
        let products = [], orders = [], services = [], warranties = [], financeStats = null;

        const [pRes, oRes, sRes] = await Promise.all([
            window.apiFetch('products.php'),
            window.apiFetch('orders.php'),
            window.apiFetch('services.php')
        ]);

        products = pRes ? (pRes.data || pRes) : [];
        orders = oRes ? (oRes.data || oRes) : [];
        services = sRes ? (sRes.data || sRes) : [];

        // Optional endpoints
        try { const wRes = await window.apiFetch('warranties.php'); warranties = wRes ? (wRes.data || wRes) : []; } catch(e) { warranties = []; }
        try { financeStats = await window.apiFetch('finance.php?action=stats'); } catch(e) { financeStats = null; }

        // Critical & Action Items
        const LOW_STOCK_THRESHOLD = (window.Utils && Utils.getLowStockThreshold) ? Utils.getLowStockThreshold() : 15;
        const lowStockItems = products.filter(p => (parseInt(p.stock) || 0) <= LOW_STOCK_THRESHOLD);
        const pendingOrders = orders.filter(o => o.status === 'Pending' || o.status === 'ordered');
        const requestedServices = services.filter(s => s.status === 'Requested' || s.service_status === 'Requested');
        const pendingExpenses = financeStats && financeStats.data ? parseInt(financeStats.data.pendingExpenseCount || 0) : 0;

        // Warranty Check (Services due within 7 days)
        const sevenDaysFromNow = new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000);
        const dueWarranties = warranties.filter(w => {
            const date = new Date(w.next_service || w.next_service_date);
            return date <= sevenDaysFromNow && w.status === 'Active';
        });

        // Counts for Badge (Action items only)
        const actionCount = lowStockItems.length + pendingOrders.length + requestedServices.length + dueWarranties.length + pendingExpenses;

        // Update Dashboard Counts (if they exist)
        updateLowStockCount(lowStockItems.length);

        // Update Bell Icon Badge with total unread notifications
        updateBellIcon(notificationData.unreadCount + actionCount);
    } catch (err) {
        console.error("Failed to check system alerts:", err);
        updateBellIcon(0);
    }
}

// To
// New function to check for alerts via API
async function checkForNewAlerts() {
    try {
        await window.apiFetch('notifications.php?action=check_alerts');
    } catch (e) {
        console.warn('Failed to check alerts:', e);
    }
}

// To
// New function to get unread notification count
async function updateUnreadNotificationCount() {
    try {
        const response = await window.apiFetch('notifications.php?action=unread_count');
        if (response.success) {
            notificationData.unreadCount = response.count;
        }
    } catch (e) {
        console.warn('Failed to get unread count:', e);
        notificationData.unreadCount = 0;
    }
}

// To
// New function to load notifications
async function loadNotifications() {
    try {
        const response = await window.apiFetch('notifications.php?action=list&limit=20');
        if (response.success) {
            notificationData.notifications = response.data;
        }
    } catch (e) {
        console.warn('Failed to load notifications:', e);
        notificationData.notifications = [];
    }
}

// Update Low Stock Count
function updateLowStockCount(count) {
    const ids = ['low-stock-count', 'dashboard-low-stock', 'low-stock-count-header'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.innerText = count;
            if (count > 0) {
                el.classList.add('text-danger');
                const widget = el.closest('.low-stock-widget');
                if (widget) {
                    widget.classList.remove('severity-ok');
                    widget.classList.add('severity-critical');
                }
            } else {
                el.classList.remove('text-danger');
                const widget = el.closest('.low-stock-widget');
                if (widget) {
                    widget.classList.remove('severity-critical');
                    widget.classList.add('severity-ok');
                }
            }
        }
    });
}

// Update Bell Icon
function updateBellIcon(totalCount) {
    const bell = document.getElementById('notification-bell');
    if (!bell) return;

    // Remove any existing badges
    bell.querySelectorAll('.badge, .notification-badge').forEach(b => b.remove());

    if (totalCount > 0) {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.innerText = totalCount;
        bell.appendChild(badge);
    }
}

// To
// Global function to toggle notification list
window.toggleNotifications = async function() {
    const bell = document.getElementById('notification-bell');
    if (!bell) return;

    let dropdown = document.getElementById('notification-dropdown');
    
    // Create dropdown if it doesn't exist
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'notification-dropdown';
        dropdown.className = 'notification-dropdown';
        document.body.appendChild(dropdown);
        
        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!bell.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });
    }

    const isShowing = dropdown.classList.contains('show');
    
    if (!isShowing) {
        await loadNotifications();
        await populateNotifications(dropdown);
        
        // Position dropdown below bell
        const rect = bell.getBoundingClientRect();
        dropdown.style.position = 'fixed';
        dropdown.style.top = `${rect.bottom + 10}px`;
        dropdown.style.right = `${window.innerWidth - rect.right}px`;
        dropdown.classList.add('show');
    } else {
        dropdown.classList.remove('show');
    }
};

// Populate Notifications
async function populateNotifications(container) {
    container.innerHTML = `<div class="p-20 text-center"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading...</div>`;
    await loadNotifications();

    try {
    let productsList = [], ordersList = [], servicesList = [], warrantiesList = [], activityList = [];
    let financeStats = null;

    try {
        const [pRes, oRes, sRes, aRes, fRes] = await Promise.all([
            window.apiFetch('products.php').catch(e => { console.warn(e); return { success: false, data: [] }; }),
            window.apiFetch('orders.php').catch(e => { console.warn(e); return { success: false, data: [] }; }),
            window.apiFetch('services.php').catch(e => { console.warn(e); return { success: false, data: [] }; }),
            window.apiFetch('activity.php').catch(e => { console.warn(e); return { success: false, data: [] }; }),
            window.apiFetch('finance.php?action=stats').catch(e => { console.warn(e); return { success: false, data: {} }; })
        ]);

        productsList = (pRes && pRes.data) ? pRes.data : [];
        ordersList = (oRes && oRes.data) ? oRes.data : [];
        servicesList = (sRes && sRes.data) ? sRes.data : [];
        activityList = (aRes && aRes.data) ? aRes.data : [];
        financeStats = (fRes && fRes.data) ? fRes.data : null;

        try {
            const wRes = await window.apiFetch('warranties.php');
            warrantiesList = (wRes && wRes.data) ? wRes.data : [];
        } catch(e) { warrantiesList = []; }

        // Low_Stock_Threshold
        const LOW_STOCK_THRESHOLD = (window.Utils && Utils.getLowStockThreshold) ? Utils.getLowStockThreshold() : 15;
        const lowStock = productsList.filter(p => (parseInt(p.stock) || 0) <= LOW_STOCK_THRESHOLD);
        const pendingOrders = ordersList.filter(o => o.status === 'Pending' || o.status === 'ordered');
        const requestedServices = servicesList.filter(s => s.status === 'Requested' || s.service_status === 'Requested');
        const pendingExpenses = financeStats ? parseInt(financeStats.pendingExpenseCount || 0) : 0;
        const pendingExpenseTotal = financeStats ? parseFloat(financeStats.pendingExpenseTotal || 0) : 0;
        
        // Login activity from today or most recent (limit to top 3 for pulse)
        const recentLogins = activityList.filter(log => log.action === 'User Login' || log.action === 'Login').slice(0, 3);
        
        const sevenDaysFromNow = new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000);
        const dueWarranties = warrantiesList.filter(w => {
            const date = new Date(w.next_service || w.next_service_date);
            return date <= sevenDaysFromNow && w.status === 'Active';
        });

        const totalCritical = lowStock.length + pendingOrders.length + requestedServices.length + dueWarranties.length + recentLogins.length + pendingExpenses + notificationData.notifications.filter(n => !n.is_read).length;

        if (totalCritical === 0) {
            container.innerHTML = `
                <div class="notification-header">System Pulse</div>
                <div class="notification-empty">
                    <i class="fa-solid fa-check-circle"></i>
                    <p>System is healthy. No critical actions!</p>
                </div>
                <div class="notification-footer">
                    <a href="activity.html">View System Logs</a>
                </div>
            `;
            return;
        }

        let html = `
            <div class="notification-header">
                <span>System Pulse (${totalCritical})</span>
                <button onclick="window.toggleNotifications()"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="notification-body">
        `;

        // Add database notifications first
        const unreadNotifications = notificationData.notifications.filter(n => !n.is_read);
        if (unreadNotifications.length > 0) {
            html += `<div class="notification-category">Alerts (${unreadNotifications.length})</div>`;
            unreadNotifications.slice(0, 5).forEach(notification => {
                const iconClass = getNotificationIcon(notification.type);
                html += `
                    <div class="notification-item" onclick="markNotificationAsRead(${notification.id})">
                        <div class="item-icon ${notification.type}"><i class="${iconClass}"></i></div>
                        <div class="item-content">
                            <strong>${notification.title}</strong>
                            <span>${notification.message}</span>
                            <span class="text-micro">${formatNotificationDate(notification.created_at)}</span>
                        </div>
                    </div>
                `;
            });
        }

        if (lowStock.length > 0) {
            html += `<div class="notification-category">Low Inventory (${lowStock.length})</div>`;
            lowStock.forEach(item => {
                html += `
                    <div class="notification-item">
                        <div class="item-icon stock"><i class="fa-solid fa-circle-exclamation"></i></div>
                        <div class="item-content">
                            <strong>${item.name}</strong>
                            <span>Only ${item.stock} units left</span>
                            <a href="inventory.html" class="reorder-link">Restock</a>
                        </div>
                    </div>
                `;
            });
        }

        if (pendingOrders.length > 0) {
            html += `<div class="notification-category">Pending Orders (${pendingOrders.length})</div>`;
            pendingOrders.forEach(order => {
                html += `
                    <div class="notification-item">
                        <div class="item-icon order"><i class="fa-solid fa-file-invoice-dollar"></i></div>
                        <div class="item-content">
                            <strong>${window.Utils && Utils.formatID ? Utils.formatID(order.id, '#ORD-') : '#' + order.id}</strong>
                            <span>${order.customer} - Processing required</span>
                            <a href="orders.html" class="reorder-link">View</a>
                        </div>
                    </div>
                `;
            });
        }

        const canApproveExpenses = financeStats && financeStats.canReviewExpenses;
        if (pendingExpenses > 0) {
            html += `<div class="notification-category">Pending Expense Approvals (${pendingExpenses})</div>`;
            html += `
                <div class="notification-item">
                    <div class="item-icon expense"><i class="fa-solid fa-file-circle-exclamation"></i></div>
                    <div class="item-content">
                        <strong>${pendingExpenses} pending expense${pendingExpenses === 1 ? '' : 's'}</strong>
                        <span>Total ${window.Utils && Utils.formatCurrency ? Utils.formatCurrency(pendingExpenseTotal) : 'LKR ' + Number(pendingExpenseTotal || 0).toLocaleString('en-LK')}</span>
                        <div class="notification-action-group">
                            <a href="finance.html" class="reorder-link">Review</a>
                            ${canApproveExpenses ? `<button type="button" class="notification-action-btn" onclick="window.location.href='finance.html'">Approve</button>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }

        if (requestedServices.length > 0) {
            html += `<div class="notification-category">Service Requests (${requestedServices.length})</div>`;
            requestedServices.forEach(srv => {
                html += `
                    <div class="notification-item">
                        <div class="item-icon service"><i class="fa-solid fa-screwdriver-wrench"></i></div>
                        <div class="item-content">
                            <strong>${window.Utils && Utils.formatID ? Utils.formatID(srv.id, '#SRV-') : '#' + srv.id}</strong>
                            <span>${srv.type} - ${srv.customer}</span>
                            <a href="services.html" class="reorder-link">Assign</a>
                        </div>
                    </div>
                `;
            });
        }

        if (dueWarranties.length > 0) {
            html += `<div class="notification-category">Maintenance Due (${dueWarranties.length})</div>`;
            dueWarranties.forEach(wrn => {
                html += `
                    <div class="notification-item">
                        <div class="item-icon service"><i class="fa-solid fa-clock-rotate-left"></i></div>
                        <div class="item-content">
                            <strong>${wrn.product_name || wrn.productName}</strong>
                            <span>SN: ${wrn.serial_number || wrn.serialNumber}</span>
                            <a href="services.html" class="reorder-link">Schedule</a>
                        </div>
                    </div>
                `;
            });
        }

        if (recentLogins.length > 0) {
            html += `<div class="notification-category">Security Pulse (${recentLogins.length})</div>`;
            recentLogins.forEach(log => {
                const time = window.Utils && window.Utils.formatDateTime ? Utils.formatDateTime(log.created_at) : log.log_date;
                html += `
                    <div class="notification-item">
                        <div class="item-icon security"><i class="fa-solid fa-shield-halved"></i></div>
                        <div class="item-content">
                            <strong>Successful Login</strong>
                            <span>${log.user} entered the system</span>
                            <span class="text-micro">${time}</span>
                        </div>
                    </div>
                `;
            });
        }

        html += `
            </div>
            <div class="notification-footer">
                <a href="activity.html">View Full Activity Log</a>
            </div>
        `;
        container.innerHTML = html;
        } catch (innerErr) {
            console.error("Inner notification fetch failed", innerErr);
            throw innerErr;
        }
    } catch (err) {
        console.error("Populate Notifications Error:", err);
        container.innerHTML = `<div class="p-20 text-danger" style="text-align:center;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size:1.5rem;display:block;margin-bottom:10px;"></i>
            Error loading notifications
        </div>`;
    }
}

// Helper functions for new notification system
function getNotificationIcon(type) {
    const icons = {
        'low_stock': 'fa-solid fa-circle-exclamation',
        'overdue_invoice': 'fa-solid fa-file-invoice-dollar',
        'pending_order': 'fa-solid fa-clock',
        'service_due': 'fa-solid fa-screwdriver-wrench',
        'system_alert': 'fa-solid fa-bell'
    };
    return icons[type] || 'fa-solid fa-bell';
}

// Format Notification Date
function formatNotificationDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

window.markNotificationAsRead = async function(id) {
    try {
        await window.apiFetch('notifications.php?action=mark_read', {
            method: 'POST',
            body: { ids: [id] }
        });
        await updateUnreadNotificationCount();
        updateBellIcon(notificationData.unreadCount);
        // Refresh dropdown if open
        const dropdown = document.getElementById('notification-dropdown');
        if (dropdown && dropdown.classList.contains('show')) {
            populateNotifications(dropdown);
        }
    } catch (e) {
        console.warn('Failed to mark notification as read:', e);
    }
};

window.markAllNotificationsAsRead = async function() {
    const unreadIds = notificationData.notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;

    try {
        await window.apiFetch('notifications.php?action=mark_read', {
            method: 'POST',
            body: { ids: unreadIds }
        });
        await updateUnreadNotificationCount();
        updateBellIcon(notificationData.unreadCount);
        // Refresh dropdown if open
        const dropdown = document.getElementById('notification-dropdown');
        if (dropdown && dropdown.classList.contains('show')) {
            populateNotifications(dropdown);
        }
    } catch (e) {
        console.warn('Failed to mark all notifications as read:', e);
    }
};

// Auto-initialize alerts on page load
document.addEventListener('DOMContentLoaded', checkSystemAlerts);
setInterval(checkSystemAlerts, 60000); // Check every minute
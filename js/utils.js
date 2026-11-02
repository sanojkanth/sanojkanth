/**
 * Centralized Utilities for Central Hardwares
 * Includes: Auth, Logging, Formatting, UI Helpers, Undo, Keyboard Shortcuts
 */

// Extend global Utils
window.Utils = window.Utils || {};

// =========================================
// #1 — PASSWORD HASHING (Base64 obfuscation)
// =========================================
window.Utils.hashPassword = function(password) {
    // Base64 encode for basic obfuscation (not production-grade)
    try { return btoa(unescape(encodeURIComponent(password))); }
    catch(e) { return btoa(password); }
};

window.Utils.verifyPassword = function(entered, storedHash) {
    try {
        const decoded = decodeURIComponent(escape(atob(storedHash)));
        return entered === decoded;
    } catch(e) {
        try { return entered === atob(storedHash); }
        catch(e2) { return entered === storedHash; } // fallback for un-hashed legacy
    }
};

// =========================================
// API HELPER (With Global Progress Indicator)
// =========================================
window.apiFetch = async function(url, options = {}) {
    const defaultHeaders = { 'Content-Type': 'application/json' };

    const config = {
        ...options,
        credentials: 'include',
        headers: { ...defaultHeaders, ...options.headers }
    };
    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }
    try {
        const res = await fetch('../backend php/' + url, config);
        
        let data;
        const text = await res.text();
        try {
            data = text ? JSON.parse(text) : {};
        } catch (e) {
            console.error('SERVER RESPONDED WITH NON-JSON:', text);
            throw new Error('Server error: Invalid response format');
        }

        if (!res.ok) {
            const err = new Error(data.error || 'API Request Failed ('+res.status+')');
            err.status = res.status;
            throw err;
        }

        return data;
    } catch (err) {
        throw err;
    }
};

// =========================================
// #2 — LOGIN VALIDATION (Moved to login.html explicitly handling fetch)
// =========================================
window.Utils.handleLogin = function(email, password) {
    console.warn('.handleLogin is deprecated. Using fetch directly in login.html');
    return false;
};

// =========================================
// #3 — ROUTE PROTECTION
// =========================================
window.Utils.requireAuth = async function() {
    const path = window.location.pathname.toLowerCase();
    const publicPages = ['login.html', 'signup.html', 'forgot-password.html'];
    const isPublicPage = publicPages.some(pp => path.includes(pp.toLowerCase()));
    
    if (isPublicPage) {
        document.documentElement.style.display = ''; // Ensure visible
        return;
    }

    // --- Fast Check ---
    // If we have a cached user, let the page stay visible for now.
    // The background API check will verify if the session is still valid.
    const cachedUser = localStorage.getItem('currentUser');
    if (!cachedUser) {
        // No local session at all? Likely need to login.
        document.documentElement.style.display = 'none';
        window.location.replace('login.html');
        return;
    }

    try {
        await window.apiFetch('auth.php?action=check&t=' + Date.now(), { method: 'GET' });
        console.log('Session active');
    } catch (e) {
        if (e.status === 401) {
            console.warn('Session expired or invalid');
            localStorage.removeItem('currentUser');
            document.documentElement.style.display = 'none';
            window.location.replace('login.html');
        } else {
            console.error('Auth server unreachable, but keeping local session for now:', e.message);
        }
    }
};

window.logout = async function() {
    try {
        await window.apiFetch('auth.php?action=logout', { method: 'POST' });
    } catch(e) {
        console.error('Logout API failed:', e);
    }
    localStorage.removeItem('currentUser');
    window.location.replace('login.html');
};

// Run immediately (before DOMContentLoaded to catch the "flash")
Utils.requireAuth();

// Prevent Back-Forward Cache (BFCache) issues when clicking browser back button after logout
window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        // The page was restored from the cache, re-verify auth
        Utils.requireAuth();
    }
});

// Handle cross-tab logout
window.addEventListener('storage', function(e) {
    if (e.key === 'currentUser' && !e.newValue) {
        const path = window.location.pathname.toLowerCase();
        const publicPages = ['login.html', 'signup.html', 'forgot-password.html'];
        if (!publicPages.some(pp => path.includes(pp.toLowerCase()))) {
            document.documentElement.style.display = 'none';
            window.location.href = 'login.html';
        }
    }
});

// =========================================
// #8 & #9 — SETTINGS READER (API-backed with in-memory cache)
// =========================================
window.Utils._settingsCache = null;
window.Utils._settingsDefaults = {
    storeName: 'Central Hardwares',
    location: 'Jaffna, Main St.',
    email: 'info@centralhardwares.lk',
    phone: '+94 77 123 4567',
    currency: 'LKR',
    taxLabel: 'VAT',
    taxRate: 0,
    stockThreshold: 15,
    expenseApprovalThreshold: 50000,
    invoiceNote: 'Thank you for your business!'
};

// Load settings from API into cache (called on page load)
window.Utils.loadSettings = async function() {
    try {
        const res = await window.apiFetch('settings.php');
        window.Utils._settingsCache = { ...window.Utils._settingsDefaults, ...(res.data || {}) };
    } catch(e) {
        console.warn('Failed to load settings from API, using defaults', e);
        window.Utils._settingsCache = { ...window.Utils._settingsDefaults };
    }
    return window.Utils._settingsCache;
};

window.Utils.getSettings = function() {
    if (window.Utils._settingsCache) {
        return window.Utils._settingsCache;
    }
    // Fallback to defaults if cache not yet loaded
    return { ...window.Utils._settingsDefaults };
};

// Eagerly load settings on script load
window.Utils.loadSettings();

window.Utils.getLowStockThreshold = function() {
    return parseInt(Utils.getSettings().stockThreshold) || 15;
};

window.Utils.getExpenseApprovalThreshold = function() {
    return parseFloat(Utils.getSettings().expenseApprovalThreshold) || 50000;
};

window.Utils.getTaxRate = function() {
    return parseFloat(Utils.getSettings().taxRate) || 0;
};

window.Utils.formatCurrency = function(amount) {
    const s = Utils.getSettings();
    const currency = s.currency || 'LKR';
    const formatted = parseFloat(amount || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    return `${currency} ${formatted}`;
};

window.Utils.getBranding = function() {
    return Utils.getSettings();
};

// =========================================
// AUDIT LOGGING (Reduced since backend handles most logic)
// =========================================
window.Utils.logAction = function(action, details, target = 'System') {
    // Left as passive placeholder if UI needs to emit local events
    console.log(`[Audit Log] ${action}: ${details}`);
};

window.Utils.addLoginActivity = function(userName) {
    // Handled by backend API automatically
};

// =========================================
// FORMATTING
// =========================================
window.Utils.formatCurrency = function(amount) {
    return new Intl.NumberFormat('en-LK', {
        style: 'currency',
        currency: 'LKR',
        minimumFractionDigits: 2
    }).format(amount);
};

window.Utils.formatID = function(id, prefix = '#') {
    if (!id) return '---';
    const idStr = id.toString();
    if(idStr.length > 8) {
        return `${prefix}${idStr.slice(-6)}`;
    }
    return `${prefix}${idStr.padStart(4, '0')}`;
};

// =========================================
// #14 — UNIFIED DATE FORMATTING
// =========================================
window.Utils.formatDate = function(dateStr) {
    if (!dateStr) return '---';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr; // Return original if invalid
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

window.Utils.formatDateTime = function(dateStr) {
    if (!dateStr) return '---';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + 
           ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};

// =========================================
// PRINT
// =========================================
window.printData = function(tableId) {
    if (window.openReportPrintPreview) {
        // Use the new premium print preview system if available
        let title = 'Records Report';
        if (tableId.includes('customer')) title = 'Customer List';
        if (tableId.includes('income')) title = 'Income Report';
        if (tableId.includes('expense')) title = 'Expense Report';
        if (tableId.includes('activity')) title = 'Activity Logs';
        
        window.openReportPrintPreview(tableId, title);
        return;
    }

    // Legacy fallback
    const tableBody = document.getElementById(tableId);
    if (!tableBody) {
        alert("No data to print!");
        return;
    }

    const table = tableBody.closest('table');
    const htmlToPrint = table ? table.outerHTML : `<table>${tableBody.outerHTML}</table>`;

    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write('<html><head><title>Print Records</title>');
    printWindow.document.write('<style>');
    printWindow.document.write('body { font-family: sans-serif; padding: 20px; }');
    printWindow.document.write('table { width: 100%; border-collapse: collapse; margin-top: 20px; }');
    printWindow.document.write('th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 12px; }');
    printWindow.document.write('th { background-color: #f8f9fa; font-weight: bold; }');
    printWindow.document.write('img { max-width: 40px; height: auto; border-radius: 4px; }');
    printWindow.document.write('.action-btns, .btn-action, .no-print { display: none !important; }');
    printWindow.document.write('</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write('<h2>Data Report</h2>');
    printWindow.document.write(`<p>Generated on: ${new Date().toLocaleString()}</p>`);
    printWindow.document.write(htmlToPrint);
    printWindow.document.write('</body></html>');
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
};

// =========================================
// LOGOUT & ACTIVITY
// =========================================
window.Utils.handleLogout = async function(removeUser = true) {
    try {
        await window.apiFetch('auth.php?action=logout', { method: 'POST' });
    } catch(e) {
        console.warn('Logout API failed', e);
    }
    if (removeUser) {
        try { localStorage.removeItem('currentUser'); } catch(e) {}
    }
};

window.Utils.handleLogoutAndRedirect = async function(url) {
    try { await window.Utils.handleLogout(true); } catch(e) { console.warn(e); }
    window.location.replace(url || 'login.html');
};

window.Utils.handleAutoLogout = function() {
    try { window.Utils.handleLogout(false); } catch(e) { console.warn(e); }
};

// =========================================
// #18 — UNDO DELETE (API-backed)
// =========================================
window.Utils._lastDeleted = null;

// Map storage keys to API endpoints
window.Utils._storageKeyToApi = {
    'hardware_products': 'products.php',
    'hardware_orders': 'orders.php',
    'hardware_suppliers': 'suppliers.php',
    'hardware_customers': 'customers.php',
    'hardware_services': 'services.php',
    'hardware_invoices': 'invoices.php',
    'hardware_users': 'users.php'
};

window.Utils.deleteWithUndo = function(storageKey, items, id, entityName, renderFn) {
    const item = items.find(i => (i.id === id || i.id == id));
    if (!item) return items;

    const filtered = items.filter(i => i.id !== id && i.id != id);

    // Delete via API
    const apiEndpoint = window.Utils._storageKeyToApi[storageKey] || storageKey;
    window.apiFetch(`${apiEndpoint}?id=${id}`, { method: 'DELETE' }).catch(e => {
        console.error('API delete failed:', e);
    });

    // Store for undo
    window.Utils._lastDeleted = { storageKey, item, id, entityName, renderFn };

    // Show undo toast
    const toast = document.createElement('div');
    toast.className = 'toast-notification toast-warning show';
    toast.id = 'undo-toast';
    toast.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation"></i>
        <div class="toast-content">
            <strong>${entityName} deleted</strong>
            <button onclick="Utils.undoDelete()" class="btn-undo">Undo</button>
        </div>
    `;
    // Remove existing undo toasts
    const existing = document.getElementById('undo-toast');
    if (existing) existing.remove();
    document.body.appendChild(toast);

    // Auto-remove after 8 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }
        window.Utils._lastDeleted = null;
    }, 8000);

    if (window.Utils && Utils.logAction) {
        Utils.logAction('Delete ' + entityName, `Deleted: ${item.name || item.username || item.customer || id}`, entityName);
    }

    return filtered;
};

window.Utils.undoDelete = async function() {
    const data = window.Utils._lastDeleted;
    if (!data) return;

    // Re-create via API
    const apiEndpoint = window.Utils._storageKeyToApi[data.storageKey] || data.storageKey;
    try {
        await window.apiFetch(apiEndpoint, {
            method: 'POST',
            body: JSON.stringify(data.item)
        });
    } catch(e) {
        console.error('Undo (re-create) failed:', e);
    }

    // Remove toast
    const toast = document.getElementById('undo-toast');
    if (toast) toast.remove();

    if (data.renderFn && typeof data.renderFn === 'function') {
        data.renderFn();
    } else {
        location.reload(); // Fallback
    }

    if (window.Utils && Utils.logAction) {
        Utils.logAction('Undo Delete', `Restored: ${data.item.name || data.item.username || data.item.customer || data.id}`, data.entityName);
    }

    if (typeof showToast === 'function') showToast('Item restored successfully!', 'success');
    window.Utils._lastDeleted = null;
};

// =========================================
// #17 — FORM VALIDATION HELPERS
// =========================================
window.Utils.validatePhone = function(phone) {
    // Sri Lankan phone: starts with 0 or +94, 10-15 digits
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    return /^(\+94|0)[0-9]{9,12}$/.test(cleaned);
};

window.Utils.validateEmail = function(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

window.Utils.validatePositiveNumber = function(val) {
    return !isNaN(val) && parseFloat(val) >= 0;
};

// =========================================
// TOAST NOTIFICATIONS
// =========================================
window.showToast = function(message, type = "success") {
    const existing = document.querySelector('.toast-notification:not(#undo-toast)');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    
    let icon = 'check-circle';
    if(type === 'error') icon = 'circle-xmark';
    if(type === 'warning') icon = 'triangle-exclamation';
    if(type === 'info') icon = 'circle-info';

    toast.innerHTML = `
        <i class="fa-solid fa-${icon}"></i>
        <div class="toast-content">
            <strong>${type.toUpperCase()}</strong>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);

    setTimeout(() => {
        if(toast) {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }
    }, 4000);
};

// =========================================
// #5 — PAGINATION UTILITY
// =========================================
window.Utils.paginate = function(data, page, perPage) {
    page = page || 1;
    perPage = perPage || 15;
    const totalPages = Math.max(1, Math.ceil(data.length / perPage));
    page = Math.min(page, totalPages);
    // Start
    const start = (page - 1) * perPage;
    return {
        items: data.slice(start, start + perPage),
        total: data.length,
        totalPages: totalPages,
        currentPage: page,
        perPage: perPage
    };
};

window.Utils.renderPagination = function(containerId, paginationInfo, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const { currentPage, totalPages, total, perPage } = paginationInfo;
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    // Start
    const start = (currentPage - 1) * perPage + 1;
    const end = Math.min(currentPage * perPage, total);

    let html = `<div class="pagination-btns">`;
    
    // Prev Button (Optional, but good for UX)
    html += `<button class="nav-btn" ${currentPage <= 1 ? 'disabled' : ''} onclick="window._paginateTo(${currentPage - 1}, '${containerId}')">Prev</button>`;

    // Page numbers
    const maxVisible = 15; // Increased to match screenshot density
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    // Always show first page if not in range
    if (startPage > 1) {
        html += `<button onclick="window._paginateTo(1, '${containerId}')">1</button>`;
        if (startPage > 2) html += `<span class="pagination-dots">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="${i === currentPage ? 'active' : ''}" onclick="window._paginateTo(${i}, '${containerId}')">${i}</button>`;
    }

    // Always show last page if not in range
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="pagination-dots">...</span>`;
        html += `<button onclick="window._paginateTo(${totalPages}, '${containerId}')">${totalPages}</button>`;
    }

    // Next Button
    html += `<button class="nav-btn next-btn" ${currentPage >= totalPages ? 'disabled' : ''} onclick="window._paginateTo(${currentPage + 1}, '${containerId}')">Next</button>`;
    html += `</div>`;

    container.innerHTML = html;

    // Store callback
    window._paginationCallbacks = window._paginationCallbacks || {};
    window._paginationCallbacks[containerId] = onPageChange;
};

window._paginateTo = function(page, containerId) {
    if (window._paginationCallbacks && window._paginationCallbacks[containerId]) {
        window._paginationCallbacks[containerId](page);
    }
};

// =========================================
// #16 — KEYBOARD SHORTCUTS
// =========================================
document.addEventListener('keydown', function(e) {
    // Ctrl+K = Focus search
    if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('#global-header-search, [id$="-search"]');
        if (searchInput) searchInput.focus();
    }
    // Escape = Close modals
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));
        // Also close notification dropdown
        const dd = document.getElementById('notification-dropdown');
        if (dd) dd.classList.remove('show');
    }
    // Ctrl+P = Print data (prevent default browser print for controlled print)
    if (e.ctrlKey && e.key === 'p') {
        // Let browser handle its own print
    }
});

/**
 * Custom Theme-aware Prompt Modal
 * Replaces browser's native prompt() with a premium design
 */
window.Utils.customPrompt = function(options) {
    const {
        title,
        message,
        placeholder,
        type = 'text',
        onConfirm,
        onCancel,
        value = '',
        avatar = '',
        userName = '',
        userEmail = '',
        confirmText = 'Continue'
    } = options;
    
    const modalId = 'prompt-' + Math.random().toString(36).substr(2, 9);
    const isDark = document.body.classList.contains('dark-mode');
    
    const memojiLady = "https://img.freepik.com/premium-vector/vector-flat-icon-young-woman-with-glasses-suit_98402-45731.jpg";
    const avatarSrc = avatar === 'default' ? memojiLady : avatar;

    const modalHTML = `
        <div id="${modalId}" style="position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(15,23,42,0.6); backdrop-filter: blur(4px); z-index: 99999;">
            <div id="${modalId}-card" style="background: white; padding: 32px; border-radius: 20px; text-align: center; width: min(100%, 360px); box-shadow: 0 20px 40px rgba(0,0,0,0.2); border: 1px solid rgba(226,232,240,0.8);">
                <div style="width: 72px; height: 72px; margin: 0 auto 16px;">
                    <img src="${avatarSrc}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; border: 2px solid #e2e8f0; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                </div>
                
                <h3 id="${modalId}-title" style="margin: 0 0 8px 0; font-size: 1.5rem; color: #0f172a; font-weight: 800;">${title}</h3>
                <p id="${modalId}-message" style="margin: 0 0 24px 0; color: #64748b; font-size: 0.95rem; line-height: 1.4;">${message}</p>

                <div style="text-align: left; margin-bottom: 24px;">
                    <div id="${modalId}-input-wrap" style="display: flex; align-items: center; gap: 10px; padding: 0 16px; border: 1.5px solid #e2e8f0; border-radius: 12px; background: #f8fafc; transition: all 0.2s;">
                        <i id="${modalId}-lock" class="fa-solid fa-lock" style="color: #94a3b8; font-size: 0.9rem;"></i>
                        <input type="${type}" id="${modalId}-input" placeholder="${placeholder || 'Enter password'}" value="${value}"
                               style="width: 100%; padding: 14px 0; border: none; background: transparent; box-sizing: border-box; outline: none; color: #0f172a; font-size: 0.95rem; font-weight: 500;">
                    </div>
                </div>

                <div style="display: flex; gap: 12px;">
                    <button id="${modalId}-cancel" style="flex: 1; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; color: #64748b; cursor: pointer; font-weight: 600; font-size: 0.95rem; transition: background 0.2s;">
                        Cancel
                    </button>
                    <button id="${modalId}-ok" style="flex: 1; padding: 12px; border: none; border-radius: 12px; background: #f59e0b; color: white; cursor: pointer; font-weight: 600; font-size: 0.95rem; box-shadow: 0 4px 12px rgba(245,158,11,0.2); transition: background 0.2s;">
                        ${confirmText}
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById(modalId);
    const inputEl = document.getElementById(`${modalId}-input`);
    const contentEl = document.getElementById(`${modalId}-card`);
    const titleEl = document.getElementById(`${modalId}-title`);
    const messageEl = document.getElementById(`${modalId}-message`);
    const inputWrapEl = document.getElementById(`${modalId}-input-wrap`);
    const lockEl = document.getElementById(`${modalId}-lock`);
    const okBtn = document.getElementById(`${modalId}-ok`);
    const cancelBtn = document.getElementById(`${modalId}-cancel`);
    
    if(isDark) {
        contentEl.style.background = 'linear-gradient(180deg, #0f172a 0%, #111827 100%)';
        contentEl.style.borderColor = 'rgba(51,65,85,0.95)';
        titleEl.style.color = '#f8fafc';
        messageEl.style.color = '#94a3b8';
        inputWrapEl.style.background = '#0b1220';
        inputWrapEl.style.borderColor = '#475569';
        lockEl.style.color = '#94a3b8';
        inputEl.style.color = '#f8fafc';
        inputEl.style.caretColor = '#f59e0b';
        cancelBtn.style.color = '#94a3b8';
        cancelBtn.style.background = 'transparent';
        cancelBtn.style.borderColor = '#475569';
    } else {
        inputWrapEl.style.background = '#ffffff';
        inputWrapEl.style.borderColor = '#cbd5e1';
    }

    // Cleanup
    const cleanup = () => {
        modalEl.remove();
    };

    okBtn.onclick = () => {
        const val = inputEl.value;
        if (!val && type === 'password') {
            inputWrapEl.style.borderColor = '#ef4444';
            return;
        }
        cleanup();
        if (onConfirm) onConfirm(val);
    };

    // Handle Cancel
    const handleCancel = () => {
        cleanup();
        if (onCancel) onCancel();
    };

    cancelBtn.onclick = handleCancel;

    inputEl.onkeydown = (e) => {
        inputWrapEl.style.borderColor = isDark ? '#475569' : '#cbd5e1';
        if (e.key === 'Enter') {
            e.preventDefault();
            okBtn.click();
        }
        if (e.key === 'Escape') handleCancel();
    };
    
    modalEl.onclick = (e) => {
        if (e.target === modalEl) handleCancel();
    };
    
    inputEl.focus();
};

/**
 * Custom Centered Confirm Dialog
 * Replaces window.confirm() with a premium design
 */
window.Utils.showConfirm = function(options) {
    return new Promise((resolve) => {
        const { title = 'Are you sure?', message = '', okText = 'OK', cancelText = 'Cancel', type = 'danger' } = 
            (typeof options === 'string') ? { message: options } : options;
        
        const modalId = 'confirm-' + Math.random().toString(36).substr(2, 9);
        const isDark = document.body.classList.contains('dark-mode');
        
        const colorClass = type === 'danger' ? '#991b1b' : (type === 'warning' ? '#b45309' : '#1e40af');
        const hoverColor = type === 'danger' ? '#7f1d1d' : (type === 'warning' ? '#92400e' : '#1e3a8a');

        const modalHTML = `
            <div id="${modalId}" style="position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.6); z-index: 100000; backdrop-filter: blur(4px); transition: all 0.3s ease;">
                <div class="confirm-modal-content" style="background: white; padding: 32px; border-radius: 20px; text-align: center; width: 400px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); transform: scale(0.9); opacity: 0; transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);">
                    <div style="width: 64px; height: 64px; background: ${type === 'danger' ? '#fee2e2' : '#fef3c7'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                        <i class="fa-solid ${type === 'danger' ? 'fa-trash-can' : 'fa-triangle-exclamation'}" style="font-size: 24px; color: ${colorClass};"></i>
                    </div>
                    <h3 style="margin: 0 0 10px 0; font-size: 1.5rem; color: #111827; font-weight: 800;">${title}</h3>
                    <p style="margin: 0 0 28px 0; color: #4b5563; font-size: 1rem; line-height: 1.5;">${message}</p>
                    
                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <button id="${modalId}-cancel" style="flex: 1; padding: 12px 20px; border: 1.5px solid #e5e7eb; border-radius: 12px; background: white; color: #374151; cursor: pointer; font-weight: 600; transition: all 0.2s;">
                            ${cancelText}
                        </button>
                        <button id="${modalId}-ok" style="flex: 1; padding: 12px 20px; border: none; border-radius: 12px; background: ${colorClass}; color: white; cursor: pointer; font-weight: 700; transition: all 0.2s; box-shadow: 0 4px 12px ${type === 'danger' ? 'rgba(153, 27, 27, 0.3)' : 'rgba(180, 83, 9, 0.3)'};">
                            ${okText}
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modalEl = document.getElementById(modalId);
        const innerContent = modalEl.querySelector('.confirm-modal-content');
        const okBtn = document.getElementById(`${modalId}-ok`);
        const cancelBtn = document.getElementById(`${modalId}-cancel`);
        
        if(isDark) {
            innerContent.style.background = '#1e1e2e';
            innerContent.querySelector('h3').style.color = '#f8fafc';
            innerContent.querySelector('p').style.color = '#94a3b8';
            cancelBtn.style.background = '#2d2d3d';
            cancelBtn.style.color = '#e2e8f0';
            cancelBtn.style.borderColor = '#3d3d4d';
        }

        // Animate in
        setTimeout(() => {
            innerContent.style.transform = 'scale(1)';
            innerContent.style.opacity = '1';
        }, 10);

        // Cleanup
        const cleanup = (val) => {
            innerContent.style.transform = 'scale(0.9)';
            innerContent.style.opacity = '0';
            setTimeout(() => {
                modalEl.remove();
                resolve(val);
            }, 300);
        };

        okBtn.onclick = () => cleanup(true);
        cancelBtn.onclick = () => cleanup(false);
        
        modalEl.onclick = (e) => {
            if (e.target === modalEl) cleanup(false);
        };

        // Keyboard support
        const handleKeys = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                cleanup(false);
                document.removeEventListener('keydown', handleKeys);
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                cleanup(true);
                document.removeEventListener('keydown', handleKeys);
            }
        };
        document.addEventListener('keydown', handleKeys);
    });
};

window.closeCenteredModal = function() {
    const existing = document.getElementById('centered-view-modal');
    if (existing) existing.remove();
};

window.showCenteredModal = function(options) {
    const {
        title = 'Details',
        content = '',
        primaryText = 'OK',
        primaryAction = null,
        secondaryText = 'Close',
        secondaryAction = null,
        width = '900px',
        htmlBody = true
    } = options || {};

    window.closeCenteredModal();

    const modalHtml = `
        <div id="centered-view-modal" class="modal centered" style="display:flex;">
            <div class="modal-content modal-content-centered" style="max-width:${width};">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <span class="close-btn" id="centered-view-close">&times;</span>
                </div>
                <div class="modal-body">${htmlBody ? content : `<pre style="white-space:pre-wrap; word-break:break-word; font-family:inherit;">${content}</pre>`}</div>
                <div class="modal-footer" style="justify-content: flex-end;">
                    <button class="btn-cancel" id="centered-view-secondary">${secondaryText}</button>
                    <button class="btn-save" id="centered-view-primary">${primaryText}</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalEl = document.getElementById('centered-view-modal');
    const closeBtn = document.getElementById('centered-view-close');
    const primaryBtn = document.getElementById('centered-view-primary');
    const secondaryBtn = document.getElementById('centered-view-secondary');

    // Cleanup
    const cleanup = () => window.closeCenteredModal();
    closeBtn.onclick = cleanup;
    secondaryBtn.onclick = typeof secondaryAction === 'function' ? () => { secondaryAction(); cleanup(); } : cleanup;
    primaryBtn.onclick = typeof primaryAction === 'function' ? () => { primaryAction(); } : cleanup;

    modalEl.onclick = function(e) {
        if (e.target === modalEl) cleanup();
    };
};

window.openPrintPreviewModal = function(options) {
    const {
        reportTitle = 'Print Preview',
        headline = '',
        subHeadline = '',
        contentHtml = '',
        printHtml = '',
        width = '800px'
    } = options || {};

    const branding = window.Utils && typeof window.Utils.getBranding === 'function'
        ? window.Utils.getBranding()
        : { storeName: 'Central Hardwares', location: 'Jaffna, Main St.' };

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB') + ', ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
    
    const previewHtml = `
        <div class="print-report-container" style="font-family: 'Inter', Arial, sans-serif; max-width: 100%; margin: 0 auto; padding: 10px;">
            <div class="report-header" style="display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 12px; border-bottom: 3px solid #fbbc04; margin-bottom: 30px;">
                <div class="store-info">
                    <h2 style="margin: 0; font-size: 1.8rem; font-weight: 800; letter-spacing: -0.02em;">${branding.storeName}</h2>
                    <p style="margin: 4px 0 0 0; color: #64748b; font-size: 0.95rem;">${branding.location}</p>
                </div>
                <div class="report-meta" style="text-align: right;">
                    <h1 style="margin: 0; font-size: 1.6rem; font-weight: 800; text-transform: uppercase;">${reportTitle}</h1>
                    <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 0.85rem;">Generated: ${dateStr}</p>
                </div>
            </div>

            <div class="report-body" style="padding: 0 10px;">
                ${headline ? `
                    <div style="text-align: center; margin-bottom: 35px;">
                        <h2 style="margin: 0; font-size: 1.4rem; font-weight: 600;">${headline}</h2>
                        <h1 style="margin: 8px 0; font-size: 2.2rem; font-weight: 800;">${reportTitle}</h1>
                        ${subHeadline ? `<p style="margin: 0; font-size: 1.1rem;">${subHeadline}</p>` : ''}
                    </div>
                ` : ''}

                <div class="report-content" style="margin-top: 20px;">
                    ${contentHtml}
                </div>
            </div>

            <div class="report-footer" style="margin-top: 50px; padding-top: 20px; border-top: 1px dotted #cbd5e1; text-align: center; color: #94a3b8; font-size: 0.85rem;">
                <p>This report was generated from Hardware Central Management System</p>
            </div>
        </div>
    `;

    const printContent = printHtml || previewHtml;

    window.showCenteredModal({
        title: reportTitle,
        content: previewHtml,
        primaryText: 'Print',
        primaryAction: function() {
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head>
                    <title>${reportTitle}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
                    <style>
                        body { font-family: 'Inter', Arial, sans-serif; margin: 30px; color: #1e293b; -webkit-print-color-adjust: exact; }
                        h1, h2, h3, p { margin: 0; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th, td { border-bottom: 1px solid #f1f5f9; padding: 12px 8px; text-align: left; }
                        th { color: #64748b; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; background: #f8fafc; }
                        td { font-size: 0.95rem; }
                        .text-right { text-align: right; }
                        .font-bold { font-weight: 700; }
                        @media print {
                            .no-print { display: none; }
                            body { margin: 0; padding: 20px; }
                        }
                    </style>
                </head>
                <body>
                    ${printContent}
                    <script>window.onload = function() { window.print(); window.close(); }<\/script>
                </body>
                </html>
            `);
            printWindow.document.close();
        },
        secondaryText: 'Close',
        secondaryAction: window.closeCenteredModal,
        width
    });
};

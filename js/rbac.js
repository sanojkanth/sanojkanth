/**
 * Role-Based Access Control (RBAC) for Central Hardwares
 * Enforces Admin vs Staff permissions across the system.
 * Staff can see all pages but sensitive DATA is hidden.
 */

window.RBAC = window.RBAC || {};

// Current user role (set after auth check)
window.RBAC._role = null;
window.RBAC._userName = null;

/**
 * Initialize RBAC - fetch user role from session
 */
window.RBAC.init = async function() {
    try {
        const res = await window.apiFetch('auth.php?action=check');
        if (res.success && res.user) {
            window.RBAC._role = res.user.role || 'Staff';
            window.RBAC._userName = res.user.name || '';
        }
    } catch(e) {
        // Fallback to localStorage
        try {
            const lsUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            window.RBAC._role = lsUser.role || 'Staff';
            window.RBAC._userName = lsUser.name || '';
        } catch(err) {
            window.RBAC._role = 'Staff'; // Default to most restrictive
        }
    }

    // Apply restrictions immediately
    window.RBAC.enforce();
};

/**
 * Check if current user is Admin
 */
window.RBAC.isAdmin = function() {
    return window.RBAC._role === 'Admin';
};

/**
 * Check if current user is Staff
 */
window.RBAC.isStaff = function() {
    return window.RBAC._role === 'Staff';
};

/**
 * Main enforcement function — runs on every page
 */
window.RBAC.enforce = function() {
    if (window.RBAC.isAdmin()) return; // Admin has full access

    const page = window.location.pathname.split('/').pop() || 'index.html';

    // --- GLOBAL RESTRICTIONS (all pages) ---
    window.RBAC._restrictActionButtons();
    window.RBAC._hideExportButtons();
    window.RBAC._hideSettingsIcon();

    // --- PAGE-SPECIFIC RESTRICTIONS ---
    switch(page) {
        case 'index.html':
            window.RBAC._restrictDashboard();
            break;
        case 'finance.html':
            window.RBAC._restrictFinance();
            break;
        case 'users.html':
            window.RBAC._restrictUsers();
            break;
        case 'account.html':
            window.RBAC._restrictSettings();
            break;
        case 'activity.html':
        case 'activity-logs.html':
            window.RBAC._restrictActivity();
            break;
        case 'suppliers.html':
            window.RBAC._restrictSuppliers();
            break;
        case 'reports.html':
            window.RBAC._restrictReports();
            break;
    }
};

// =========================================
// GLOBAL RESTRICTION HELPERS
// =========================================

/**
 * Hide restricted buttons (Delete, Edit) while keeping View/Print
 */
window.RBAC._restrictActionButtons = function() {
    const isDark = document.body.classList.contains('dark-mode');

    // 1. Hide all DELETE buttons
    document.querySelectorAll('.btn-danger, .btn-delete, [onclick*="delete"], [onclick*="Delete"]').forEach(btn => {
        btn.style.display = 'none';
    });

    // 2. Hide "Reset Data" buttons
    document.querySelectorAll('[onclick*="reset"], [onclick*="Reset"]').forEach(btn => {
        if (btn.textContent.toLowerCase().includes('reset data') || btn.textContent.toLowerCase().includes('reset')) {
            btn.style.display = 'none';
        }
    });

    // 3. Hide EDIT buttons (but keep View/Print/Details)
    document.querySelectorAll('.btn-edit, .btn-update, [onclick*="edit"], [onclick*="Edit"]').forEach(btn => {
        // Specifically check if it's an edit button to avoid hiding "View/Print"
        if (!btn.classList.contains('btn-view') && !btn.classList.contains('btn-print')) {
            btn.style.display = 'none';
        }
    });

    // 4. Ensure View/Print/Action containers are visible even if child buttons are hidden
    document.querySelectorAll('.action-btns, .btn-action').forEach(el => {
        if (!el.classList.contains('btn-delete') && !el.classList.contains('btn-edit')) {
            el.style.display = ''; // Restore visibility
        }
    });
};

/**
 * Hide EXPORT buttons for Staff
 */
window.RBAC._hideExportButtons = function() {
    document.querySelectorAll('[onclick*="export"], [onclick*="Export"]').forEach(btn => {
        btn.style.display = 'none';
    });
    document.querySelectorAll('[onclick*="Print"], [onclick*="print"]').forEach(btn => {
        if (btn.textContent.includes('PRINT DATA') || btn.textContent.includes('EXPORT DATA')) {
            btn.style.display = 'none';
        }
    });
};

/**
 * Hide Settings gear icon in header for Staff
 */
window.RBAC._hideSettingsIcon = function() {
    document.querySelectorAll('.settings-icon').forEach(el => {
        el.style.display = 'none';
    });
};

// =========================================
// PAGE-SPECIFIC RESTRICTIONS
// =========================================

/**
 * Dashboard — Hide financial/revenue cards for Staff
 */
window.RBAC._restrictDashboard = function() {
    const isDark = document.body.classList.contains('dark-mode');
    
    // Hide Profit Calculator widget
    const profitCalc = document.querySelector('.widget-card');
    if (profitCalc && profitCalc.querySelector('#profit-product')) {
        profitCalc.innerHTML = `
            <div class="widget-header-row">
                <h3><i class="fa-solid fa-lock"></i> Profit Calculator</h3>
            </div>
            <div style="padding: 40px 20px; text-align: center; color: #94a3b8;">
                <i class="fa-solid fa-shield-halved" style="font-size: 2.5rem; margin-bottom: 15px; display: block; color: ${isDark ? '#475569' : '#cbd5e1'};"></i>
                <p style="font-weight: 600; font-size: 1rem; margin: 0; color: ${isDark ? '#e2e8f0' : '#1e293b'};">Admin Access Required</p>
                <p style="font-size: 0.85rem; margin-top: 5px;">Financial tools are restricted to administrators.</p>
            </div>
        `;
    }

    // Hide revenue number in nav stats
    const revenueStat = document.getElementById('nav-total-sales');
    if (revenueStat) {
        const parentItem = revenueStat.closest('.nav-stat-item');
        if (parentItem) {
            parentItem.innerHTML = '<span>Total Sales</span><span style="color: #94a3b8;">Restricted</span>';
        }
    }
};

/**
 * Finance — Hide all financial data, show restricted message
 */
window.RBAC._restrictFinance = function() {
    const contentArea = document.querySelector('.content-area');
    if (!contentArea) return;
    const isDark = document.body.classList.contains('dark-mode');

    contentArea.innerHTML = `
        <div class="dashboard-header">
            <h2>Financial Management</h2>
        </div>
        <div style="
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            min-height: 400px; text-align: center; padding: 60px 20px;
            background: ${isDark ? '#1e293b' : '#fff'}; border-radius: 16px; border: 1px solid ${isDark ? '#334155' : '#e2e8f0'};
        ">
            <div style="
                width: 100px; height: 100px; border-radius: 50%;
                background: ${isDark ? 'linear-gradient(135deg, #0f172a, #1e293b)' : 'linear-gradient(135deg, #f1f5f9, #e2e8f0)'};
                display: flex; align-items: center; justify-content: center;
                margin-bottom: 25px;
            ">
                <i class="fa-solid fa-shield-halved" style="font-size: 2.5rem; color: #94a3b8;"></i>
            </div>
            <h3 style="color: ${isDark ? '#f8fafc' : '#1e293b'}; font-size: 1.5rem; font-weight: 800; margin: 0 0 10px 0;">Access Restricted</h3>
            <p style="color: #64748b; font-size: 1rem; max-width: 400px; line-height: 1.6; margin: 0;">
                Financial data including income, expenses, and profit reports are restricted to <strong>Admin</strong> users only. 
                Please contact your system administrator if you need access.
            </p>
            <div style="
                margin-top: 25px; padding: 12px 24px;
                background: ${isDark ? '#0f172a' : '#f8fafc'}; border-radius: 12px; border: 1px solid ${isDark ? '#334155' : '#e2e8f0'};
                color: #94a3b8; font-size: 0.85rem; font-weight: 600;
            ">
                <i class="fa-solid fa-user"></i> Logged in as: <strong style="color:${isDark ? '#e2e8f0' : '#475569'}">${window.RBAC._userName}</strong> (Staff)
            </div>
        </div>
    `;
};

/**
 * Users — Hide user data, show restricted message
 */
window.RBAC._restrictUsers = function() {
    const contentArea = document.querySelector('.content-area');
    if (!contentArea) return;
    const isDark = document.body.classList.contains('dark-mode');

    contentArea.innerHTML = `
        <div class="dashboard-header">
            <h2>User Management</h2>
        </div>
        <div style="
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            min-height: 400px; text-align: center; padding: 60px 20px;
            background: ${isDark ? '#1e293b' : '#fff'}; border-radius: 16px; border: 1px solid ${isDark ? '#334155' : '#e2e8f0'};
        ">
            <div style="
                width: 100px; height: 100px; border-radius: 50%;
                background: ${isDark ? 'linear-gradient(135deg, #0f172a, #1e293b)' : 'linear-gradient(135deg, #f1f5f9, #e2e8f0)'};
                display: flex; align-items: center; justify-content: center;
                margin-bottom: 25px;
            ">
                <i class="fa-solid fa-users-slash" style="font-size: 2.5rem; color: #94a3b8;"></i>
            </div>
            <h3 style="color: ${isDark ? '#f8fafc' : '#1e293b'}; font-size: 1.5rem; font-weight: 800; margin: 0 0 10px 0;">Access Restricted</h3>
            <p style="color: #64748b; font-size: 1rem; max-width: 400px; line-height: 1.6; margin: 0;">
                User management including adding, editing, and removing user accounts is restricted to <strong>Admin</strong> users only.
            </p>
            <div style="
                margin-top: 25px; padding: 12px 24px;
                background: ${isDark ? '#0f172a' : '#f8fafc'}; border-radius: 12px; border: 1px solid ${isDark ? '#334155' : '#e2e8f0'};
                color: #94a3b8; font-size: 0.85rem; font-weight: 600;
            ">
                <i class="fa-solid fa-user"></i> Logged in as: <strong style="color:${isDark ? '#e2e8f0' : '#475569'}">${window.RBAC._userName}</strong> (Staff)
            </div>
        </div>
    `;
};

/**
 * Settings/Account — Hide settings data, show restricted message
 */
window.RBAC._restrictSettings = function() {
    const contentArea = document.querySelector('.content-area');
    if (!contentArea) return;
    const isDark = document.body.classList.contains('dark-mode');

    // Find settings sections and hide them, keep profile section
    const settingsSections = contentArea.querySelectorAll('.settings-section, .system-settings');
    settingsSections.forEach(section => {
        const heading = section.querySelector('h3, h2');
        if (heading && (
            heading.textContent.includes('System') || 
            heading.textContent.includes('Business') || 
            heading.textContent.includes('Tax') || 
            heading.textContent.includes('Invoice') ||
            heading.textContent.includes('Backup') ||
            heading.textContent.includes('API') ||
            heading.textContent.includes('Stripe')
        )) {
            section.innerHTML = `
                <div style="padding: 30px; text-align: center; color: #94a3b8; border: 1px dashed ${isDark ? '#334155' : '#e2e8f0'}; border-radius: 12px; background: ${isDark ? 'rgba(15,23,42,0.2)' : 'transparent'};">
                    <i class="fa-solid fa-lock" style="font-size: 1.5rem; margin-bottom: 10px; display: block; color: ${isDark ? '#475569' : '#cbd5e1'};"></i>
                    <p style="margin: 0; font-weight: 600; color: ${isDark ? '#94a3b8' : '#475569'};">Admin Access Required</p>
                    <p style="font-size: 0.8rem; margin-top: 5px;">This section is restricted to administrators.</p>
                </div>
            `;
        }
    });
};

/**
 * Activity — Staff can only see their own logs
 */
window.RBAC._restrictActivity = function() {
    // We'll filter the table to show only the current user's logs
    // This works by adding a MutationObserver to filter rows after they load
    const observer = new MutationObserver(() => {
        const tbody = document.querySelector('tbody');
        if (!tbody) return;
        
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            const userCell = row.querySelector('td:nth-child(2)'); // Usually the 'User' column
            if (userCell && userCell.textContent.trim() !== window.RBAC._userName) {
                row.style.display = 'none';
            }
        });
    });

    const tbody = document.querySelector('tbody');
    if (tbody) {
        observer.observe(tbody, { childList: true, subtree: true });
    }
};

/**
 * Suppliers — Make read-only for Staff (hide Add/Edit buttons)
 */
window.RBAC._restrictSuppliers = function() {
    // Hide Add Supplier button
    document.querySelectorAll('.btn-primary, #add-supplier-btn').forEach(btn => {
        if (btn.textContent.includes('Add') || btn.id === 'add-supplier-btn') {
            btn.style.display = 'none';
        }
    });

    // Selectively hide buttons in table (observer for dynamically loaded content)
    const observer = new MutationObserver(() => {
        window.RBAC._restrictActionButtons();
    });

    const tbody = document.querySelector('tbody');
    if (tbody) {
        observer.observe(tbody, { childList: true, subtree: true });
    }
};

/**
 * Reports — Hide export functionality for Staff
 */
window.RBAC._restrictReports = function() {
    // Export buttons already hidden globally, but also hide download links
    document.querySelectorAll('[onclick*="download"], [onclick*="Download"]').forEach(btn => {
        btn.style.display = 'none';
    });
};

// =========================================
// RE-ENFORCE AFTER DYNAMIC CONTENT LOADS
// =========================================
// MutationObserver to catch dynamically injected elements
window.RBAC._observeDOM = function() {
    if (window.RBAC.isAdmin()) return;

    const observer = new MutationObserver((mutations) => {
        let needsEnforce = false;
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                needsEnforce = true;
                break;
            }
        }
        if (needsEnforce) {
            // Debounce to avoid performance hit
            clearTimeout(window.RBAC._enforceTimer);
            window.RBAC._enforceTimer = setTimeout(() => {
                window.RBAC._restrictActionButtons();
                window.RBAC._hideExportButtons();
                window.RBAC._hideSettingsIcon();
            }, 200);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    await window.RBAC.init();
    window.RBAC._observeDOM();
});
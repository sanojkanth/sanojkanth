// Trigger File Download
function triggerFileDownload(blob, fileName) {
    const link = document.createElement('a');
    if (link.download === undefined) return;

    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Utility to Download CSV
function downloadCSV(csvContent, fileName) {
    const blob = new Blob(['\ufeff', csvContent], { type: 'text/csv;charset=utf-8;' });
    triggerFileDownload(blob, fileName);
}

window.downloadCSV = downloadCSV;

window.ExportUtils = window.ExportUtils || {};

window.ExportUtils.escapeHtml = function(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

window.ExportUtils.normalizeCell = function(value) {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    const text = String(value);
    return /^[=+\-@]/.test(text) ? `'${text}` : text;
};

window.ExportUtils.toExcel = function(options = {}) {
    const headers = Array.isArray(options.headers) ? options.headers : [];
    const rows = Array.isArray(options.rows) ? options.rows : [];

    if (headers.length === 0) {
        alert('No columns available to export.');
        return;
    }

    const fileName = String(options.fileName || 'export.xls').replace(/\.xlsx?$/i, '.xls');
    const safeSheetName = String(options.sheetName || 'Sheet1')
        .replace(/[\\\/:*?\[\]]/g, ' ')
        .trim()
        .slice(0, 31) || 'Sheet1';

    const headHtml = headers
        .map(header => `<th>${window.ExportUtils.escapeHtml(window.ExportUtils.normalizeCell(header))}</th>`)
        .join('');

    const bodyHtml = rows.map(row => {
        const cells = Array.isArray(row) ? row : [];
        return `<tr>${cells.map(cell => {
            const normalized = window.ExportUtils.normalizeCell(cell);
            const isNumeric = typeof cell === 'number' && Number.isFinite(cell);
            const className = isNumeric ? '' : ' class="cell-text"';
            return `<td${className}>${window.ExportUtils.escapeHtml(normalized)}</td>`;
        }).join('')}</tr>`;
    }).join('');

    const excelHtml = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
    <meta charset="utf-8">
    <!--[if gte mso 9]>
    <xml>
        <x:ExcelWorkbook>
            <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                    <x:Name>${window.ExportUtils.escapeHtml(safeSheetName)}</x:Name>
                    <x:WorksheetOptions>
                        <x:DisplayGridlines/>
                    </x:WorksheetOptions>
                </x:ExcelWorksheet>
            </x:ExcelWorksheets>
        </x:ExcelWorkbook>
    </xml>
    <![endif]-->
    <style>
        table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
        th, td { border: 1px solid #d7dee8; padding: 8px 10px; text-align: left; vertical-align: top; }
        th { background: #f3f6fb; font-weight: 700; }
        .cell-text { mso-number-format: "\\@"; }
    </style>
</head>
<body>
    <table>
        <thead><tr>${headHtml}</tr></thead>
        <tbody>${bodyHtml}</tbody>
    </table>
</body>
</html>`.trim();

    const blob = new Blob(['\ufeff', excelHtml], {
        type: 'application/vnd.ms-excel;charset=utf-8;'
    });

    triggerFileDownload(blob, fileName);
};

// Global Utils for ID Formatting
window.Utils = window.Utils || {};
window.Utils.formatID = function(id, prefix = '#') {
    if (!id) return '---';
    const idStr = id.toString();
    if(idStr.length > 8) {
        return `${prefix}${idStr.slice(-6)}`;
    }
    return `${prefix}${idStr.padStart(4, '0')}`;
};

window.getGlobalSidebarItems = function() {
    return [
        { key: 'dashboard', href: 'index.html', icon: 'fa-solid fa-gauge', label: 'Dashboard' },
        { key: 'inventory', href: 'inventory.html', icon: 'fa-solid fa-box', label: 'Inventory' },
        { key: 'orders', href: 'orders.html', icon: 'fa-solid fa-file-invoice', label: 'Orders' },
        { key: 'invoices', href: 'invoices.html', icon: 'fa-solid fa-file-invoice-dollar', label: 'Invoices' },
        { key: 'services', href: 'services.html', icon: 'fa-solid fa-truck', label: 'Services & Delivery', dataNav: 'records' },
        { key: 'service-performance', href: 'services.html?view=performance', icon: 'fa-solid fa-chart-column', label: 'Field Operations', dataNav: 'performance' },
        { key: 'finance', href: 'finance.html', icon: 'fa-solid fa-coins', label: 'Finance' },
        { key: 'suppliers', href: 'suppliers.html', icon: 'fa-solid fa-truck-field', label: 'Suppliers' },
        { key: 'customers', href: 'customers.html', icon: 'fa-solid fa-user-group', label: 'Customers' },
        { key: 'users', href: 'users.html', icon: 'fa-solid fa-users', label: 'Users' },
        { key: 'activity', href: 'activity.html', icon: 'fa-solid fa-chart-line', label: 'Activity' }
    ];
};

window.getCurrentSidebarKey = function() {
    // Page
    const page = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const params = new URLSearchParams(window.location.search);

    if (page === 'services.html') {
        return params.get('view') === 'performance' ? 'service-performance' : 'services';
    }

    const pageToKey = {
        'index.html': 'dashboard',
        'inventory.html': 'inventory',
        'orders.html': 'orders',
        'invoices.html': 'invoices',
        'finance.html': 'finance',
        'suppliers.html': 'suppliers',
        'customers.html': 'customers',
        'users.html': 'users',
        'activity.html': 'activity',
        'activity-logs.html': 'activity'
    };

    return pageToKey[page] || '';
};

window.renderGlobalSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const activeKey = window.getCurrentSidebarKey();
    const items = window.getGlobalSidebarItems();

    sidebar.classList.add('sidebar-widget');
    sidebar.innerHTML = `
        <div class="widget-header">
            <h3>Admin Menu</h3>
        </div>
        <ul class="cat-list">
            ${items.map(item => {
                const activeClass = item.key === activeKey ? ' class="active"' : '';
                const dataNavAttr = item.dataNav ? ` data-service-nav="${item.dataNav}"` : '';
                return `<li${activeClass}${dataNavAttr}><a href="${item.href}"><i class="${item.icon}"></i> ${item.label}</a></li>`;
            }).join('')}
        </ul>
    `;
};

// Global Animation for Statistics
window.animateStat = (elId, finalVal, prefix = '') => {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerText = prefix + finalVal.toLocaleString();
};

// Common animation utility used in some legacy parts
window.animateValue = function(element, target) {
    if (!element) return;
    const elId = element.id;
    if (elId) {
        window.animateStat(elId, target);
    } else {
        element.innerText = target.toLocaleString();
    }
};

// --- GLOBAL SEARCH DISPATCHER ---
window.globalSearch = function() {
    const path = window.location.pathname;
    const page = path.split('/').pop() || 'index.html';
    const searchEl = document.getElementById('global-header-search');
    const query = searchEl ? searchEl.value.trim() : '';

    console.log(`Global search triggered for: ${query} on page: ${page}`);

    if (page.includes('inventory.html')) {
        if (window.searchInventory) window.searchInventory();
    } else if (page.includes('orders.html')) {
        if (window.searchOrders) window.searchOrders();
    } else if (page.includes('customers.html')) {
        if (window.searchCustomers) window.searchCustomers();
    } else if (page.includes('users.html')) {
        if (window.searchUsers) window.searchUsers();
    } else if (page.includes('suppliers.html')) {
        if (window.searchSuppliers) window.searchSuppliers();
    } else if (page.includes('services.html')) {
        if (window.searchServices) window.searchServices();
    } else if (page.includes('finance.html')) {
        if (window.searchFinance) window.searchFinance();
    } else if (page.includes('activity.html')) {
        if (window.searchActivity) window.searchActivity();
    } else if (page.includes('reports.html')) {
        if (window.searchReports) window.searchReports();
    } else {
        if (query) {
            window.location.href = `inventory.html?q=${encodeURIComponent(query)}`;
        }
    }
}

// --- GLOBAL NAV STATS UPDATER ---
window.updateGlobalNavStats = async function() {
    try {
        const results = await Promise.allSettled([
            window.apiFetch('products.php'),
            window.apiFetch('customers.php'),
            window.apiFetch('finance.php?action=stats'),
            window.apiFetch('orders.php'),
            window.apiFetch('services.php?type=service'),
            window.apiFetch('suppliers.php'),
            window.apiFetch('users.php'),
            window.apiFetch('invoices.php')
        ]);
        
        const products = results[0].status === 'fulfilled' ? (results[0].value?.data || []) : [];
        const customers = results[1].status === 'fulfilled' ? (results[1].value?.data || []) : [];
        const financeData = results[2].status === 'fulfilled' ? (results[2].value?.data || {}) : {};
        const orders = results[3].status === 'fulfilled' ? (results[3].value?.data || []) : [];
        const services = results[4].status === 'fulfilled' ? (results[4].value?.data || []) : [];
        const suppliers = results[5].status === 'fulfilled' ? (results[5].value?.data || []) : [];
        const users = results[6].status === 'fulfilled' ? (results[6].value?.data || []) : [];
        const invoices = results[7].status === 'fulfilled' ? (results[7].value?.data || []) : [];

        // Store globally for other modules
        window.dashboardState = {
            products,
            orders,
            services,
            users,
            suppliers,
            customers,
            financeData,
            invoices
        };

        // --- PAGE SPECIFIC NAV BAR UPDATES ---
        const path = window.location.pathname;
        const page = path.split('/').pop() || 'index.html';

        // 1. Common Dashboard Stats (Fallback/Home)
        const totalSales = Math.round(financeData.totalRevenue || 0);
        const totalStock = products.reduce((sum, p) => sum + (parseInt(p.stock) || 0), 0);
        animateStat('nav-total-sales', totalSales);
        animateStat('nav-orders-count', orders.length);
        animateStat('nav-stock-count', totalStock);
        animateStat('nav-customers-count', customers.length);

        // 2. Inventory Page Specific
        animateStat('nav-inv-total', products.length);
        // Threshold
        const threshold = (window.Utils && Utils.getLowStockThreshold) ? Utils.getLowStockThreshold() : 15;
        animateStat('nav-inv-low', products.filter(p => p.stock > 0 && p.stock <= threshold).length);
        animateStat('nav-inv-out', products.filter(p => p.stock <= 0).length);
        const valueOfStock = products.reduce((sum, p) => sum + ((parseFloat(p.cost) || 0) * (parseInt(p.stock) || 0)), 0);
        animateStat('nav-inv-value', Math.round(valueOfStock));

        // 3. Orders Page Specific
        animateStat('nav-orders-total', orders.length);
        animateStat('nav-orders-pending', orders.filter(o => o.status === 'Pending').length);
        animateStat('nav-orders-done', orders.filter(o => o.status === 'Completed').length);

        // 4. Customers Page Specific
        animateStat('nav-cust-total', customers.length);

        animateStat('nav-cust-new', customers.filter(c => {
            const d = new Date(c.buy_date);
            return d.getMonth() === new Date().getMonth();
        }).length);
        animateStat('nav-cust-active', Math.floor(customers.length * 0.4)); // Mock active today

        // 5. Finance Page Specific (Using 'Real' Total Numbers as requested)
        animateStat('nav-fin-revenue', Math.round(financeData.totalRevenue || 0));
        animateStat('nav-fin-expenses', Math.round(financeData.totalExpenses || 0));
        animateStat('nav-fin-tax', Math.round(financeData.totalTax || 0));
        animateStat('nav-fin-profit', Math.round(financeData.netProfit || 0));

        // 6. Services Page Specific
        animateStat('nav-svc-repairs', services.filter(s => s.type === 'Repair' && s.status === 'In Progress').length);
        animateStat('nav-svc-delivery', services.filter(s => s.delivery === 'Out for Delivery').length);
        animateStat('nav-svc-install', services.filter(s => s.type === 'Installation' && s.status !== 'Completed').length);
        animateStat('nav-svc-done', services.filter(s => s.status === 'Completed').length);

        // 7. Users Page Specific
        animateStat('nav-usr-total', users.length);
        animateStat('nav-usr-admins', users.filter(u => u.role === 'Admin').length);
        animateStat('nav-usr-staff', users.filter(u => u.role === 'Staff').length);
        animateStat('nav-usr-sessions', users.filter(u => u.status === 'Online').length || Math.floor(users.length * 0.3));

        // 8. Invoices Page Specific
        animateStat('nav-inv-total-count', invoices.length);
        animateStat('nav-inv-paid', invoices.filter(i => i.status === 'Paid').length);
        animateStat('nav-inv-unpaid', invoices.filter(i => i.status === 'Unpaid').length);
        animateStat('nav-inv-overdue', invoices.filter(i => i.status === 'Overdue').length);

        // 9. Suppliers Page Specific
        animateStat('nav-sup-total', suppliers.length);
        animateStat('nav-sup-mfr', suppliers.filter(s => s.type === 'Manufacturer').length);
        animateStat('nav-sup-ws', suppliers.filter(s => s.type === 'Wholesaler').length);
        animateStat('nav-sup-dist', suppliers.filter(s => s.type === 'Distributor').length);

        // 10. Activity Page Specific
        animateStat('nav-act-total', 150); // Mock total logs
        animateStat('nav-act-active', users.length);
        animateStat('nav-act-system', 24);
        animateStat('nav-act-today', 12);

        // 11. Reports Page Specific
        animateStat('nav-rep-monthly', Math.round(financeData.monthlyRevenue || 0));
        animateStat('nav-rep-growth', 15);
        const topCatEl = document.getElementById('nav-rep-top-cat');
        if (topCatEl) topCatEl.innerText = 'Tools';
        animateStat('nav-rep-conv', 68);

        // 12. Admin Page Specific
        animateStat('nav-adm-load', 12);

        // --- DASHBOARD WIDGETS ---
        animateStat('total-products-count', products.length);
        animateStat('low-stock-count', products.filter(p => p.stock > 0 && p.stock <= threshold).length);
        animateStat('out-of-stock-count', products.filter(p => p.stock <= 0).length);
        animateStat('total-value-count', Math.round(valueOfStock), 'LKR ');
        
        // --- DASHBOARD CORE METRICS ---
        animateStat('total-revenue-count', Math.round(financeData.totalRevenue || 0));
        animateStat('total-orders-count', orders.length);
        animateStat('pending-orders-count', orders.filter(o => o.status === 'Pending').length);

        // Sidebar Badges
        animateStat('side-nav-inventory', products.length);
        animateStat('side-nav-orders', orders.filter(o => o.status === 'Pending').length);
        animateStat('side-nav-customers', customers.length);
        animateStat('side-nav-users', users.length);

        // Trigger dashboard-specific charts if available
        if (typeof initDashboardCharts === 'function') {
            initDashboardCharts(products, orders);
        }

    } catch (e) {
        console.error("Error updating global stats:", e);
    }
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    window.renderGlobalSidebar();

    // 1. Core UI Elements
    const deptBtn = document.getElementById('deptToggle');
    const sidebar = document.getElementById('sidebar');
    if (deptBtn && sidebar) {
        deptBtn.addEventListener('click', () => {
            const catList = sidebar.querySelector('.cat-list');
            if (window.innerWidth <= 992 && catList) {
                catList.style.display = (catList.style.display === 'flex') ? 'none' : 'flex';
            }
        });
    }

    // 2. Search Listeners
    const searchEl = document.getElementById('global-header-search');
    if (searchEl) {
        searchEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') window.globalSearch();
        });
    }

    // 3. Clocks & Time
    updateSriLankaTime();
    setInterval(updateSriLankaTime, 60000);
    
    updateLiveClock();
    setInterval(updateLiveClock, 1000);

    // 4. Initial Global Fetch
    updateGlobalCompanyUI(); // Call first to update branding
    updateGlobalNavStats();
    updateLowStockWidget();
    setInterval(updateGlobalNavStats, 30000);
    setInterval(updateLowStockWidget, 30000);

    if (typeof renderUsersDropdown === 'function') renderUsersDropdown();
    
    // 5. Inject Global Print Modal
    injectPrintModal();

    // 6. Show System Preloader (Once per session)
    window.showSystemPreloader();

    // 7. Mobile Sidebar Toggle
    initMobileSidebar();
});

// Init Mobile Sidebar
function initMobileSidebar() {
    const btn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('mobileSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const closeBtn = document.getElementById('closeSidebar');

    if (!btn || !sidebar || !overlay) return;

    // Toggle Sidebar
    const toggleSidebar = () => {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
        document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
    };

    btn.addEventListener('click', toggleSidebar);
    overlay.addEventListener('click', toggleSidebar);
    if (closeBtn) closeBtn.addEventListener('click', toggleSidebar);
}

// --- SYSTEM PRELOADER ---
window.showSystemPreloader = function() {
    if (sessionStorage.getItem('system_preloader_done')) return;

    const preloaderHtml = `
        <div id="system-preloader" class="preloader-overlay">
            <div class="preloader-content">
                <div class="loader-circle-wrapper">
                    <div class="loader-ring"></div>
                    <img src="../images/logo-icon.png" class="preloader-icon-img" alt="Logo">
                </div>
                <div class="preloader-text-group">
                    <div class="logo-text" style="display: flex; flex-direction: column; align-items: center;">
                        <h2 style="font-size: 3.2rem; color: #ffffff; font-weight: 800; text-transform: uppercase; line-height: 1; margin: 0; letter-spacing: 2px;">Central</h2>
                        <span style="font-size: 1.1rem; color: #fcb800; font-weight: 700; letter-spacing: 6px; text-transform: uppercase; display: block; margin-top: 8px;">HARDWARES</span>
                    </div>
                    <span class="preloader-status-text">Establishing Secure Connection...</span>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('afterbegin', preloaderHtml);
    document.body.style.overflow = 'hidden';

    const preloader = document.getElementById('system-preloader');
    
    setTimeout(() => {
        if (preloader) {
            preloader.classList.add('fade-out');
            document.body.style.overflow = '';
            sessionStorage.setItem('system_preloader_done', 'true');
            setTimeout(() => preloader.remove(), 800);
        }
    }, 3200); // Slightly longer for a more cinematic feel
};

// --- GLOBAL REPORT PRINT SYSTEM ---
function injectPrintModal() {
    if (document.getElementById('report-print-modal')) return;
    
    const modalHtml = `
    <div id="report-print-modal" class="report-print-modal">
        <div class="report-modal-content">
            <div class="report-modal-header">
                <h3 id="report-modal-title"><i class="fa-solid fa-print text-warning"></i> Report Preview</h3>
                <span class="close-report-modal" onclick="window.closeReportModal()" style="cursor:pointer; font-size:1.5rem;">&times;</span>
            </div>
            <div class="report-modal-body" id="report-modal-body">
                <!-- Data injected here -->
            </div>
            <div class="report-modal-footer">
                <button class="btn-cancel" onclick="window.closeReportModal()">Cancel</button>
                <button class="btn-primary" onclick="window.executeReportPrint()"><i class="fa-solid fa-print"></i> Print Now</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

window.closeReportModal = function() {
    const modal = document.getElementById('report-print-modal');
    if (modal) modal.classList.remove('show');
};

window.executeReportPrint = function() {
    window.print();
};

window.openReportPrintPreview = function(tableId, reportTitle = 'Management Report') {
    let sourceElement = document.getElementById(tableId) || document.querySelector('.table-clean table');
    if (!sourceElement) {
        alert('No data table found to print.');
        return;
    }

    // Get Branding
    const branding = window.Utils && typeof window.Utils.getBranding === 'function' ? window.Utils.getBranding() : { storeName: 'Central Hardwares', location: 'Jaffna' };
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB') + ', ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });

    let tableClone;
    if (sourceElement.tagName.toLowerCase() === 'tbody') {
        const fullTable = sourceElement.closest('table');
        if (fullTable) {
            tableClone = fullTable.cloneNode(true);
        } else {
            const newTable = document.createElement('table');
            newTable.appendChild(sourceElement.cloneNode(true));
            tableClone = newTable;
        }
    } else {
        tableClone = sourceElement.cloneNode(true);
    }

    const headers = tableClone.querySelectorAll('th');
    let actionsIdx = -1;
    headers.forEach((th, idx) => {
        if (th.textContent.toLowerCase().includes('action')) actionsIdx = idx;
    });

    if (actionsIdx !== -1) {
        tableClone.querySelectorAll('tr').forEach(tr => {
            if (tr.cells[actionsIdx]) tr.cells[actionsIdx].remove();
        });
    }

    tableClone.className = 'print-table';
    tableClone.removeAttribute('id');

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

            <div class="report-body">
                <div class="report-content" style="margin-top: 20px;">
                    ${tableClone.outerHTML}
                </div>
            </div>

            <div class="report-footer" style="margin-top: 50px; padding-top: 20px; border-top: 1px dotted #cbd5e1; text-align: center; color: #94a3b8; font-size: 0.85rem;">
                <p>This report was generated from Hardware Central Management System</p>
            </div>
        </div>
    `;


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
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #f1f5f9; padding: 12px 10px; text-align: left; }
                        th { background: #f8fafc; color: #64748b; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
                        td { font-size: 0.9rem; }
                        .report-header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 12px; border-bottom: 3px solid #fbbc04; margin-bottom: 30px; }
                        @media print {
                            body { margin: 0; padding: 20px; }
                        }
                    </style>
                </head>
                <body>
                    ${previewHtml}
                    <script>window.onload = function() { window.print(); window.close(); }<\/script>
                </body>
                </html>
            `);
            printWindow.document.close();
        },
        secondaryText: 'Close',
        secondaryAction: window.closeCenteredModal,
        width: '1100px'
    });
};

// --- DYNAMIC COMPANY SETTINGS UI ---
async function updateGlobalCompanyUI() {
    try {
        // Wait for settings to be available from the Utils cache
        const settings = await window.Utils.loadSettings();
        if (!settings) return;

        // 1. Update Logo (Image or Text)
        const logoImg = document.querySelector('.system-logo');
        const logoName = document.querySelector('.logo-text h2');
        const logoSub = document.querySelector('.logo-text span');

        if (logoImg && settings.storeName) {
            logoImg.alt = settings.storeName;
            // If settings had a logo URL, we could update logoImg.src here
        }

        if (logoName && settings.storeName) {
            const parts = settings.storeName.split(' ');
            if (parts.length > 1) {
                logoName.innerText = parts[0];
                if (logoSub) logoSub.innerText = parts.slice(1).join(' ').toUpperCase();
            } else {
                logoName.innerText = settings.storeName;
                if (logoSub) logoSub.innerText = '';
            }
        }

        // 2. Update Location in Top Bar
        const locationEl = document.querySelector('.location-text');
        if (locationEl && settings.location) {
            locationEl.innerHTML = `<i class="fa-solid fa-location-dot text-danger margin-r-5"></i> ${settings.location}`;
        }

        // 3. Update Email in Top Bar (not yet in most HTMLs but good for future)
        const emailEl = document.getElementById('top-bar-email');
        if (emailEl && settings.email) emailEl.innerText = settings.email;
        
        // 4. Page Titles (Suffix update)
        const currentTitle = document.title.split(' - ')[0];
        document.title = `${currentTitle} - ${settings.storeName}`;

    } catch (e) {
        console.warn('Failed to update global company UI:', e);
    }
}

// --- TIME & CLOCK UTILS ---
function updateSriLankaTime() {
    const el = document.getElementById('srilanka-date-time') || document.getElementById('dashboard-date-display');
    if (el) {
        const now = new Date();
        const options = { timeZone: 'Asia/Colombo', year: 'numeric', month: 'short', day: '2-digit' };
        const formatter = new Intl.DateTimeFormat('en-GB', options);
        const parts = formatter.formatToParts(now);
        const day = parts.find(p => p.type === 'day').value;
        const month = parts.find(p => p.type === 'month').value;
        const year = parts.find(p => p.type === 'year').value;
        el.innerText = `Today: ${day} ${month}, ${year}`;
    }
}

// Update Live Clock
function updateLiveClock() {
    const hEl = document.getElementById('c-hours');
    const mEl = document.getElementById('c-mins');
    const sEl = document.getElementById('c-secs');
    const ampmEl = document.getElementById('c-session') || document.getElementById('c-ampm');
    
    if (hEl && mEl && sEl && ampmEl) {
        const now = new Date();
        const options = { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
        const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(now);
        let hour = parts.find(p => p.type === 'hour').value;
        const minute = parts.find(p => p.type === 'minute').value;
        const second = parts.find(p => p.type === 'second').value;
        const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value || (now.getHours() >= 12 ? 'PM' : 'AM');
        
        hEl.innerText = hour.padStart(2, '0');
        mEl.innerText = minute;
        sEl.innerText = second;
        ampmEl.innerText = dayPeriod.toUpperCase();
    }
}

// --- LOW STOCK WIDGET ---
async function updateLowStockWidget() {
    try {
        const res = await window.apiFetch('products.php');
        const products = res.data || [];
        const threshold = window.Utils.getLowStockThreshold();
        const outOfStock = products.filter(p => (parseInt(p.stock) || 0) === 0).length;
        const lowStock = products.filter(p => { 
            const s = parseInt(p.stock) || 0; 
            return s > 0 && s <= threshold; 
        }).length;
        const total = outOfStock + lowStock;

        const hCount = document.getElementById('low-stock-count-header');
        if (hCount) hCount.innerText = total;

        const widget = document.querySelector('.low-stock-widget');
        if (widget) {
            const severity = outOfStock > 0 ? 'critical' : lowStock > 0 ? 'warning' : 'ok';
            widget.classList.remove('severity-ok', 'severity-warning', 'severity-critical');
            widget.classList.add('severity-' + severity);
        }
    } catch (e) {
        console.error("Error updating low stock widget:", e);
    }
}

// --- DASHBOARD CHARTS ---
function initDashboardCharts(products, orders) {
    const ctxSales = document.getElementById('salesChart');
    if(ctxSales && !ctxSales.getAttribute('data-chart-inited')) {
        const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const data = [12000, 19000, 15000, 25000, 22000, 30000, 28000]; // Mock default
        
        new Chart(ctxSales, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Revenue',
                    data: data,
                    borderColor: '#1a73e8',
                    tension: 0.4,
                    fill: true,
                    backgroundColor: 'rgba(26, 115, 232, 0.1)'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
        ctxSales.setAttribute('data-chart-inited', 'true');
    }
}

// --- USERS DROPDOWN ---
// --- USERS DROPDOWN ---
window.renderUsersDropdown = async function() {
    const allAdminLinks = document.querySelectorAll('.admin-link');
    if (allAdminLinks.length === 0) return;

    let uName = 'Creamer';
    let uEmail = 'creamer@gmail.com';
    let uImage = '';
    let uRole = 'Staff';

    try {
        const res = await window.apiFetch('auth.php?action=check');
        if (res.success && res.user) {
            uName = res.user.name || 'Creamer';
            uEmail = res.user.email || 'creamer@gmail.com';
            uImage = res.user.image || '';
            uRole = res.user.role || 'Staff';
        }
    } catch(e) {
        // Fallback to localStorage if session check fails
        try {
            const lsUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            if (lsUser && lsUser.name) {
                uName = lsUser.name;
                uEmail = lsUser.email;
                uImage = lsUser.image;
                uRole = lsUser.role || 'Staff';
            }
        } catch(err) {}
    }

    const memojiLady = "https://img.freepik.com/premium-vector/vector-flat-icon-young-woman-with-glasses-suit_98402-45731.jpg";
    const avatarUrl = uImage || memojiLady;
    // Render Role Badge
    const renderRoleBadge = (role) => {
        const roleLabel = String(role || 'Staff').trim() || 'Staff';
        const isAdmin = roleLabel.toLowerCase() === 'admin';
        const background = isAdmin ? 'rgba(245, 158, 11, 0.14)' : 'rgba(37, 99, 235, 0.10)';
        const color = isAdmin ? '#b45309' : '#1d4ed8';
        return `<span style="display:inline-flex;align-items:center;justify-content:center;padding:3px 8px;border-radius:999px;background:${background};color:${color};font-size:0.66rem;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;width:max-content;">${roleLabel}</span>`;
    };

    // Fetch all users for the switch list
    let allUsers = [];
    try {
        const userRes = await window.apiFetch('users.php');
        if (userRes.success) allUsers = userRes.data || [];
    } catch(e) { console.error("Failed to fetch users", e); }

    const otherUsers = allUsers.filter(u => u.email.toLowerCase() !== uEmail.toLowerCase());

    allAdminLinks.forEach(adminLink => {
        adminLink.innerHTML = `
            <div class="user-btn-content" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <img src="${avatarUrl}" class="user-avatar" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid #ddd; object-fit: cover;">
                <strong style="font-size: 0.95rem; color: #b08a2f;">Hi, ${uName}</strong>
                <i class="fa-solid fa-chevron-down" style="font-size: 0.8rem; color: #b08a2f; opacity: 0.7;"></i>
            </div>
        `;
        
        // Update mobile sidebar user info if elements exist
        const mobName = document.getElementById('mobile-user-name');
        const mobRole = document.getElementById('mobile-user-role');
        const mobImg = document.getElementById('mobile-user-img');
        if (mobName) mobName.innerText = uName;
        if (mobRole) mobRole.innerText = uRole;
        if (mobImg && avatarUrl) mobImg.src = avatarUrl;

        let wrapper = adminLink.closest('.admin-link-wrapper');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = 'admin-link-wrapper dropdown-trigger';
            wrapper.style.position = 'relative';
            wrapper.style.display = 'inline-block';
            adminLink.parentNode.insertBefore(wrapper, adminLink);
            wrapper.appendChild(adminLink);
        } else {
            wrapper.style.position = 'relative';
        }

        const oldMenu = wrapper.querySelector('.user-list');
        if (oldMenu) oldMenu.remove();

        const menu = document.createElement('div');
        menu.className = 'user-list';
        menu.style.cssText = `
            position: absolute; top: 100%; right: 0; width: 280px;
            border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.12);
            margin-top: 15px; display: none; z-index: 9999; overflow: hidden;
            border: 1px solid rgba(0,0,0,0.06); padding: 0;
        `;

        let switchListHtml = otherUsers.map(u => {
            const initials = u.username.charAt(0).toUpperCase();
            const uImg = u.image ? `<img src="${u.image}" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover;">` 
                                 : `<div style="width: 38px; height: 38px; border-radius: 50%; background: #94a3b8; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.95rem;">${initials}</div>`;
            return `
                <div class="user-item-switch" onclick="window.switchUser('${u.email}', '${u.username}', '${u.image || 'default'}')" style="display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 12px; cursor: pointer; transition: 0.2s;">
                    ${uImg}
                    <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; overflow: hidden;">
                        <div style="font-weight: 600; font-size: 0.9rem; color: #334155; line-height: 1.2;" class="switch-name text-truncate">${u.username}</div>
                        <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 1px;" class="text-truncate">${u.email}</div>
                        <div style="margin-top: 6px;">${renderRoleBadge(u.role)}</div>
                    </div>
                </div>
            `;
        }).join('');

        if (otherUsers.length === 0) {
            switchListHtml = `<div style="padding: 10px 20px; color: #94a3b8; font-size: 0.85rem;">No other users found</div>`;
        }

        menu.innerHTML = `
            <div class="curr-user-section" style="padding: 18px; border-bottom: 1px solid rgba(0,0,0,0.05); display: flex; align-items: center; gap: 15px;">
                <img src="${avatarUrl}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 2px solid #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
                <div style="display: flex; flex-direction: column; justify-content: center;">
                    <span style="font-weight: 800; color: #1e293b; font-size: 1.05rem; line-height: 1.2;" class="curr-name">${uName}</span>
                    <span style="font-size: 0.85rem; color: #64748b; margin-top: 2px;">${uEmail}</span>
                    <div style="margin-top: 8px;">${renderRoleBadge(uRole)}</div>
                </div>
            </div>

            <div style="padding: 16px 18px 8px; font-size: 0.75rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-users-viewfinder" style="font-size: 0.85rem;"></i>
                Switch Account
            </div>

            <div class="account-switch-list" style="padding: 0 10px 10px; max-height: 220px; overflow-y: auto;">
                ${switchListHtml}
            </div>

            <div style="padding: 12px 18px 18px;">
                <button onclick="window.logout()" class="logout-pill" style="width: 100%; border: 1.5px solid #f1f5f9; background: #fff; color: #64748b; padding: 12px; border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer; font-weight: 600; transition: all 0.2s ease; font-size: 0.9rem;">
                    <i class="fa-solid fa-power-off" style="font-size: 0.85rem;"></i>
                    <span>Logout Session</span>
                </button>
            </div>
        `;
        wrapper.appendChild(menu);

        if (!adminLink._hasListener) {
            adminLink.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                const isOpen = menu.style.display === 'block';
                document.querySelectorAll('.user-list').forEach(m => m.style.display = 'none');
                document.querySelectorAll('.admin-link-wrapper').forEach(w => w.classList.remove('active'));
                if (!isOpen) { 
                    menu.style.display = 'block'; 
                    wrapper.classList.add('active'); 
                }
            });
            adminLink._hasListener = true;
        }
    });

    if (!window._initGlobalDropdownCloser) {
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.admin-link-wrapper')) {
                document.querySelectorAll('.user-list').forEach(m => m.style.display = 'none');
                document.querySelectorAll('.admin-link-wrapper').forEach(w => w.classList.remove('active'));
            }
        });
        window._initGlobalDropdownCloser = true;
    }
};

window.switchUser = function(email, name, img = 'default') {
    if (window.Utils && window.Utils.customPrompt) {
        window.Utils.customPrompt({
            title: `Verify it's you`,
            message: `Enter the password for <strong>${name}</strong> to switch profiles.`,
            placeholder: 'Enter password',
            type: 'password',
            avatar: img,
            userName: name,
            userEmail: email,
            confirmText: 'Switch Account',
            onConfirm: async (password) => {
                if (!password) return;
                try {
                    const res = await window.apiFetch('auth.php?action=login', {
                        method: 'POST',
                        body: { email, password }
                    });
                    if (res.success) {
                        // Create switching animation overlay
                        const overlay = document.createElement('div');
                        overlay.style.cssText = `
                            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                            background: #ffffff; display: flex; flex-direction: column;
                            align-items: center; justify-content: center; z-index: 1000000;
                            opacity: 0; transition: opacity 0.5s ease;
                        `;
                        const memojiLady = "https://img.freepik.com/premium-vector/vector-flat-icon-young-woman-with-glasses-suit_98402-45731.jpg";
                        const finalImg = img === 'default' ? memojiLady : img;
                        
                        overlay.innerHTML = `
                            <div style="text-align: center; animation: switchSlideUp 0.6s ease-out; display: flex; flex-direction: column; align-items: center;">
                                <div style="position: relative; width: 130px; height: 130px; margin-bottom: 30px;">
                                    <div style="position: absolute; top: -8px; left: -8px; right: -8px; bottom: -8px; border: 2.5px solid #fcb800; border-radius: 50%; animation: switch-pulse-ring 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>
                                    <img src="${finalImg}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%; border: 4px solid #fff; box-shadow: 0 10px 30px rgba(0,0,0,0.08); position: relative; z-index: 2;">
                                </div>
                                <h2 style="color: #232f3e; font-weight: 800; font-size: 1.8rem; margin: 0; letter-spacing: -0.01em;">Switching to ${name}</h2>
                                <p style="color: #64748b; margin-top: 10px; font-size: 1rem; font-weight: 500;">Preparing your personalized workspace...</p>
                                <div style="margin-top: 40px; display: flex; gap: 8px;">
                                    <div class="switch-dot" style="width: 8px; height: 8px; background: #fcb800; border-radius: 50%; animation: switch-dot-bounce 1.4s infinite ease-in-out both;"></div>
                                    <div class="switch-dot" style="width: 8px; height: 8px; background: #fcb800; border-radius: 50%; animation: switch-dot-bounce 1.4s infinite ease-in-out both 0.2s;"></div>
                                    <div class="switch-dot" style="width: 8px; height: 8px; background: #fcb800; border-radius: 50%; animation: switch-dot-bounce 1.4s infinite ease-in-out both 0.4s;"></div>
                                </div>
                            </div>
                            <style>
                                @keyframes switch-pulse-ring {
                                    0% { transform: scale(0.95); opacity: 0.8; }
                                    100% { transform: scale(1.15); opacity: 0; }
                                }
                                @keyframes switch-dot-bounce {
                                    0%, 80%, 100% { transform: scale(0); }
                                    40% { transform: scale(1.0); }
                                }
                                @keyframes switchSlideUp {
                                    from { transform: translateY(20px); opacity: 0; }
                                    to { transform: translateY(0); opacity: 1; }
                                }
                                @keyframes switchFadeIn {
                                    from { opacity: 0; }
                                    to { opacity: 1; }
                                }
                            </style>
                        `;
                        document.body.appendChild(overlay);
                        setTimeout(() => overlay.style.opacity = '1', 50);

                        localStorage.setItem('currentUser', JSON.stringify(res.user));
                        setTimeout(() => window.location.reload(), 2000);
                    } else {
                        alert("Invalid password. Please try again.");
                    }
                } catch(e) {
                    alert("Switch failed: " + (e.message || "Unknown error"));
                }
            }
        });
    } else {
        const pass = prompt(`Enter password for ${name}:`);
        if (pass) {
            window.apiFetch('auth.php?action=login', {
                method: 'POST',
                body: { email, password: pass }
            }).then(res => {
                if (res.success) {
                    localStorage.setItem('currentUser', JSON.stringify(res.user));
                    window.location.reload();
                } else {
                    alert("Invalid password");
                }
            });
        }
    }
}

window.logout = async function() {
    try {
        await window.apiFetch('auth.php?action=logout', { method: 'POST' });
        localStorage.removeItem('currentUser');
        sessionStorage.removeItem('system_preloader_done'); // Reset preloader for next login
        window.location.href = 'login.html';
    } catch(e) {
        console.error("Logout error", e);
        localStorage.removeItem('currentUser');
        sessionStorage.removeItem('system_preloader_done');
        window.location.href = 'login.html';
    }
}
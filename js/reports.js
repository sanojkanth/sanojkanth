document.addEventListener('DOMContentLoaded', async () => {
    // Initial data load
    await loadInitialData();
    
});

let orders = [];
let invoices = [];
let products = [];
let activityLogs = [];
let users = [];
let currentUserActivityPage = 1;
let currentTopProductsPage = 1;
let currentLowStockPage = 1;
const REPORT_ITEMS_PER_PAGE = 5;

// Load Initial Data
async function loadInitialData() {
    try {
        const [ordRes, invRes, prodRes, actRes, usrRes] = await Promise.all([
            window.apiFetch('orders.php'),
            window.apiFetch('invoices.php'),
            window.apiFetch('products.php'),
            window.apiFetch('activity.php'),
            window.apiFetch('users.php')
        ]);

        if (ordRes.success) orders = ordRes.data;
        if (invRes.success) invoices = invRes.data;
        if (prodRes.success) products = prodRes.data;
        if (actRes.success) activityLogs = actRes.data;
        if (usrRes.success) users = usrRes.data;

        renderKPICards();
        renderUserActivity();
        renderTopSellingProducts();
        renderLowStockReport();
        updateReportStats();
    } catch (e) {
        console.error('Failed to load report data', e);
    }
}

// =============================================
// KPI SUMMARY CARDS
// =============================================
function renderKPICards() {
    // Total Revenue from orders (only completed ones usually, but here using all for dashboard)
    const totalRevenue = orders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
    setTextSafe('rpt-total-revenue', 'LKR ' + totalRevenue.toLocaleString());

    // Total Invoices
    const totalInvoices = invoices.length;
    setTextSafe('rpt-total-orders', totalInvoices);

    // Active Users - users currently logged in (from activity logs)
    const activeUsers = activityLogs.filter(l => l.status === 'Active').length;
    setTextSafe('rpt-active-users', activeUsers || 1); // Fallback to 1 (self)

    // Low Stock Items (using 15 as threshold)
    const lowStockCount = products.filter(p => (parseInt(p.stock) || 0) < 15).length;
    setTextSafe('rpt-low-stock', lowStockCount);

    // Nav bar stats are now handled centrally by script.js
}

// =============================================
// USER ACTIVITY REPORT
// =============================================
function renderUserActivity() {
    const tbody = document.getElementById('userActivityBody');
    const paginationContainer = document.getElementById('reports-user-pagination');
    if (!tbody) return;

    // Build user map
    const userMap = {};

    // Seed from user list
    users.forEach(u => {
        const name = u.username || 'Unknown';
        userMap[name] = {
            name: name,
            role: u.role || 'Staff',
            lastLogin: null,
            lastLoginDisplay: u.last_login || 'Never',
            lastDateDisplay: '',
            lastDuration: u.duration || '-',
            status: u.last_login !== 'Never' ? 'Closed' : 'Offline',
            totalLogins: 0
        };
    });

    // Process activity logs to update status and total logins
    activityLogs.forEach(log => {
        const name = log.user || 'Unknown';
        if (!userMap[name]) {
            userMap[name] = {
                name: name,
                role: 'Staff',
                lastLogin: null,
                lastLoginDisplay: 'Never',
                lastDateDisplay: '',
                lastDuration: '-',
                status: 'Offline',
                totalLogins: 0
            };
        }

        if (log.action === 'User Login' || log.action === 'Login') {
            userMap[name].totalLogins++;
        }

        if (log.status === 'Active') {
            userMap[name].status = 'Active';
        }
    });

    let userList = Object.values(userMap);

    // Sort by most active
    userList.sort((a, b) => {
        if (a.status === 'Active' && b.status !== 'Active') return -1;
        if (b.status === 'Active' && a.status !== 'Active') return 1;
        return (b.totalLogins || 0) - (a.totalLogins || 0);
    });

    if (!userList.length) {
        if (paginationContainer) paginationContainer.innerHTML = '';
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-dimmed">No user activity data available</td></tr>';
        return;
    }

    const paginated = window.Utils.paginate(userList, currentUserActivityPage, REPORT_ITEMS_PER_PAGE);
    currentUserActivityPage = paginated.currentPage;

    tbody.innerHTML = paginated.items.map(u => {
        const isOnline = u.status === 'Active';
        const statusClass = isOnline ? 'complete' : (u.status === 'Closed' ? 'pending' : 'cancelled');
        const statusLabel = isOnline ? 'ONLINE' : (u.status === 'Closed' ? 'OFFLINE' : 'NEVER');
        
        // Detailed activity level calculation (just a demo mockup based on total visits)
        const activityLevel = u.totalLogins > 10 ? 'Elite' : (u.totalLogins > 5 ? 'Power' : 'Standard');
        let activityColor = '#94a3b8';
        if(activityLevel === 'Elite') activityColor = '#1f6feb';
        else if(activityLevel === 'Power') activityColor = '#238636';

        return `
            <tr>
                <td><strong>${u.name}</strong></td>
                <td><span class="category-badge">${u.role}</span></td>
                <td class="text-muted-alt">${u.lastLoginDisplay}</td>
                <td style="text-align: center;">${u.totalLogins}</td>
                <td style="text-align: center;">${u.lastDuration}</td>
                <td style="text-align: right; color: ${activityColor}; font-weight: 600;">${activityLevel}</td>
                <td style="text-align: right;"><span class="status ${statusClass}">${statusLabel}</span></td>
            </tr>
        `;
    }).join('');

    window.Utils.renderPagination('reports-user-pagination', paginated, (newPage) => {
        currentUserActivityPage = newPage;
        renderUserActivity();
    });
}

// =============================================
// TOP SELLING PRODUCTS
// =============================================
function renderTopSellingProducts() {
    const tbody = document.getElementById('topSellingBody');
    const paginationContainer = document.getElementById('reports-top-pagination');
    if (!tbody) return;

    // Sort products by sold count (which is tracked in DB)
    let productList = [...products];
    productList.sort((a, b) => (parseInt(b.sold) || 0) - (parseInt(a.sold) || 0));
    productList = productList.slice(0, 10);

    if (productList.length === 0) {
        if (paginationContainer) paginationContainer.innerHTML = '';
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-dimmed">No product data available</td></tr>';
        return;
    }

    const paginated = window.Utils.paginate(productList, currentTopProductsPage, REPORT_ITEMS_PER_PAGE);
    currentTopProductsPage = paginated.currentPage;

    tbody.innerHTML = paginated.items.map((p) => {
        const stock = parseInt(p.stock) || 0;
        // Revenue
        const revenue = (parseFloat(p.sold) || 0) * (parseFloat(p.price) || 0);

        return `
            <tr>
                <td><strong>${p.name}</strong></td>
                <td style="font-weight: 600;">${p.sold || 0}</td>
                <td>${parseFloat(p.price || 0).toLocaleString()}</td>
                <td style="text-align: right; font-weight: 700;">LKR ${revenue.toLocaleString()}</td>
            </tr>
        `;
    }).join('');

    window.Utils.renderPagination('reports-top-pagination', paginated, (newPage) => {
        currentTopProductsPage = newPage;
        renderTopSellingProducts();
    });
}

// =============================================
// REPORT NAV STATS (Sidebar/Header counters)
// =============================================
    // Central nav stats handled by script.js

// =============================================
// LOW STOCK REPORT
// =============================================
function renderLowStockReport() {
    const tableBody = document.querySelector('#lowStockReportTable tbody');
    const paginationContainer = document.getElementById('reports-stock-pagination');
    if(!tableBody) return;
    tableBody.innerHTML = '';

    const lowStockItems = products.filter(p => (parseInt(p.stock) || 0) < 15);

    if (lowStockItems.length === 0) {
        if (paginationContainer) paginationContainer.innerHTML = '';
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;" class="text-dimmed"><i class="fa-solid fa-circle-check"></i> All stock levels are healthy.</td></tr>';
        return;
    }

    const paginated = window.Utils.paginate(lowStockItems, currentLowStockPage, REPORT_ITEMS_PER_PAGE);
    currentLowStockPage = paginated.currentPage;

    paginated.items.forEach(p => {
        const currentStock = parseInt(p.stock) || 0;
        let statusLabel = currentStock === 0 ? 'OUT' : (currentStock <= 5 ? 'CRIT' : 'LOW');
        let statusClass = currentStock === 0 ? 'cancelled' : (currentStock <= 5 ? 'cancelled' : 'pending');

        const row = `
            <tr>
                <td><strong>${p.name}</strong></td>
                <td><span class="stock-count-val ${currentStock < 5 ? 'out' : 'low'}">${currentStock}</span></td>
                <td>15</td>
                <td style="text-align: right;"><span class="status ${statusClass}">${statusLabel}</span></td>
            </tr>
        `;
        tableBody.innerHTML += row;
    });

    window.Utils.renderPagination('reports-stock-pagination', paginated, (newPage) => {
        currentLowStockPage = newPage;
        renderLowStockReport();
    });
}

// =============================================
// ACTIONS (Export/Print)
// =============================================
window.exportReports = function() {
    // Generate a combined export of KPIs and Low Stock items
    const rows = [
        ['--- KEY PERFORMANCE INDICATORS ---'],
        ['Total Revenue', document.getElementById('rpt-total-revenue')?.textContent || '0'],
        ['Total Invoices', document.getElementById('rpt-total-orders')?.textContent || '0'],
        ['Active Users', document.getElementById('rpt-active-users')?.textContent || '0'],
        ['Low Stock Count', document.getElementById('rpt-low-stock')?.textContent || '0'],
        [''],
        ['--- LOW STOCK REPORT ---'],
        ['Product Name', 'Current Stock', 'Threshold', 'Status']
    ];

    const lowStockItems = products.filter(p => (parseInt(p.stock) || 0) < 15);
    lowStockItems.forEach(p => {
        const stock = parseInt(p.stock) || 0;
        const status = stock === 0 ? 'OUT' : (stock <= 5 ? 'CRITICAL' : 'LOW');
        rows.push([p.name, stock, 15, status]);
    });

    window.ExportUtils.toExcel({
        fileName: 'business_reports.xls',
        sheetName: 'Reports Summary',
        headers: ['Metric / Item', 'Value / Stock', 'Min Threshold', 'Status'],
        rows: rows
    });
};

// Set Text Safe
function setTextSafe(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}
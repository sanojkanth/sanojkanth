/**
 * Dashboard Analytics Module (Optimized for Speed & Smoothness)
 * Features: Live Sales Ticker, Revenue Comparison, Profit Calculator
 */

document.addEventListener('DOMContentLoaded', async function() {
    
    // ================== UTILITIES & DATA FETCHING ==================
    async function getOrders() {
        try { return (await window.apiFetch('orders.php')).data || []; } catch (e) { return []; }
    }
    // Get Products
    async function getProducts() {
        try { return (await window.apiFetch('products.php')).data || []; } catch (e) { return []; }
    }
    // Get Services
    async function getServices() {
        try { return (await window.apiFetch('services.php?type=service')).data || []; } catch (e) { return []; }
    }
    // Get Invoices
    async function getInvoices() {
        try { return (await window.apiFetch('invoices.php')).data || []; } catch (e) { return []; }
    }
    // Get Income
    async function getIncome() {
        try { return (await window.apiFetch('finance.php?type=income')).data || []; } catch (e) { return []; }
    }

    // Common Time Ago Utility
    window.getTimeAgo = function(date) {
        if (!date) return '---';
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        return date.toLocaleDateString();
    };

    // ================== DATA REFRESHER & CACHING ==================
    async function refreshDashboardData(isInitial = false) {
        // 1. Initial render from cache if available (for immediate feedback)
        if(isInitial) {
            try {
                const cached = JSON.parse(localStorage.getItem('dashboard_analytics_cache'));
                if (cached) {
                    renderAll(cached);
                }
            } catch(e) {}
        }

        // 2. Fetch fresh data in parallel
        try {
            const [orders, products, services, invoices, income] = await Promise.all([
                getOrders(),
                getProducts(),
                getServices(),
                getInvoices(),
                getIncome()
            ]);

            const dashboardData = { orders, products, services, invoices, income, updatedAt: new Date().toISOString() };
            localStorage.setItem('dashboard_analytics_cache', JSON.stringify(dashboardData));

            renderAll(dashboardData);
        } catch (e) {
            console.error('Error refreshing dashboard data:', e);
        }
    }

    // Render All
    function renderAll(data) {
        renderSalesTicker(data.invoices);
        renderRecentOrdersTable(data.orders);
        renderLowStockAlerts(data.products);
        renderServiceWorkflowWidget(data.services);
        initRevenueComparison(data.income); 
        initProfitCalculator(data.products);
    }

    // ================== RENDERERS ==================
    function renderSalesTicker(invoices) {
        const container = document.getElementById('live-sales-ticker');
        if (!container) return;

        const sales = invoices
            .filter(i => i.status === 'Paid' || i.status === 'Unpaid')
            .map(i => ({
                customer: i.customer || 'Walk-in Customer', 
                items: (i.items && i.items.length) || 1,
                amount: parseFloat(calculateInvoiceTotal(i)) || 0,
                time: new Date(i.invoice_date || i.date) 
            }))
            .sort((a, b) => b.time - a.time)
            .slice(0, 10);

        if (sales.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">No recent sales found.</div>';
            return;
        }

        container.innerHTML = sales.map(sale => `
            <div class="ticker-item animate-reveal">
                <div class="ticker-icon"><i class="fa-solid fa-shopping-cart"></i></div>
                <div class="ticker-info">
                    <div class="ticker-customer">${sale.customer}</div>
                    <div class="ticker-details">${sale.items} item(s)</div>
                </div>
                <div class="ticker-amount-wrap">
                    <div class="ticker-amount">LKR ${Math.round(sale.amount).toLocaleString()}</div>
                    <div class="ticker-time">${getTimeAgo(sale.time)}</div>
                </div>
            </div>
        `).join('');

        // Summary stats - Use invoices for today's orders
        const todayStr = new Date().toISOString().split('T')[0];
        const todayCount = invoices.filter(i => (i.invoice_date || i.date) === todayStr).length;
        const totalSalesAmt = invoices.reduce((sum, i) => sum + (parseFloat(calculateInvoiceTotal(i)) || 0), 0);
        const avgValue = invoices.length > 0 ? totalSalesAmt / invoices.length : 0;
        
        const todayOrdersEl = document.getElementById('today-orders');
        const avgValueEl = document.getElementById('avg-order-value');
        if (todayOrdersEl) todayOrdersEl.textContent = todayCount;
        if (avgValueEl) avgValueEl.textContent = 'LKR ' + Math.round(avgValue).toLocaleString();
    }

    // Calculate Invoice Total
    function calculateInvoiceTotal(inv) {
        let subtotal = 0;
        if (inv.items) {
            inv.items.forEach(it => subtotal += (it.qty * it.price));
        }
        return subtotal + (subtotal * (parseFloat(inv.tax) || 0) / 100);
    }

    // Render Recent Orders Table
    function renderRecentOrdersTable(orders) {
        const tbody = document.getElementById('recent-orders-list');
        if (!tbody) return; 

        // Sort by ID descending (most recent first) to match main orders page
        const recentOrders = [...orders]
            .sort((a, b) => (parseInt(b.id) || 0) - (parseInt(a.id) || 0))
            .slice(0, 5);

        if (recentOrders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted" style="padding: 20px;">No orders found.</td></tr>';
            return;
        }

        tbody.innerHTML = recentOrders.map(o => {
            let statusClass = 'pending';
            let statusText = o.status || 'Pending';
            let dotColor = '#f59e0b'; // Amber

            if (statusText === 'Completed') {
                statusText = 'DONE';
                statusClass = 'complete';
                dotColor = '#10b981'; // Green
            } else if (statusText === 'Pending' || statusText === 'Shipping') {
                statusText = 'WAIT';
                statusClass = 'pending';
                dotColor = '#f97316'; // Orange
            } else if (statusText === 'Cancelled') {
                statusText = 'VOID';
                statusClass = 'cancelled';
                dotColor = '#ef4444'; // Red
            }

            return `
            <tr class="animate-reveal">
                <td style="color: #475569; font-weight: 700; width: 60px;">#${o.id}</td>
                <td class="text-center">
                    <div style="display: flex; align-items: center; justify-content: center;">
                        <div class="status-pill status-${statusClass}" style="
                            background: rgba(0,0,0,0.03); 
                            border: 1px solid rgba(0,0,0,0.05);
                            padding: 4px 12px;
                            border-radius: 20px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        ">
                            <span style="font-weight: 700; font-size: 0.72rem; letter-spacing: 0.03em; color: #64748b;">${statusText}</span>
                        </div>
                    </div>
                </td>
                <td class="text-right" style="font-weight: 700; color: #1e293b; font-size: 1.05rem;">LKR ${parseFloat(o.total || 0).toLocaleString()}</td>
            </tr>
            `;
        }).join('');
    }

    // Render Low Stock Alerts
    function renderLowStockAlerts(products) {
        const container = document.getElementById('low-stock-list');
        if (!container) return;

        const threshold = 15;
        const lowStockItems = products
            .filter(p => (parseInt(p.stock) || 0) <= threshold)
            .sort((a, b) => (parseInt(a.stock) || 0) - (parseInt(b.stock) || 0));

        if (lowStockItems.length === 0) {
            container.innerHTML = `
                <div class="empty-alert-state">
                    <i class="fa-solid fa-circle-check empty-alert-icon"></i>
                    <div class="empty-alert-text">All items are sufficiently stocked!</div>
                </div>
            `;
            return;
        }

        container.innerHTML = lowStockItems.map(p => {
            const stock = parseInt(p.stock) || 0;
            const statusClass = stock === 0 ? 'out-of-stock' : 'low-stock';
            const statusLabel = stock === 0 ? 'OUT' : stock + ' Left';

            return `
            <div class="alert-item animate-reveal">
                <div class="alert-name">${p.name}</div>
                <div class="alert-badge">${statusLabel}</div>
                <button class="btn-reorder" onclick="window.location.href='orders.html?reorder=${p.id}'" title="Reorder Required">
                    <i class="fa-solid fa-cart-plus"></i>
                </button>
            </div>
            `;
        }).join('');
    }

    let revChartInstance = null;
    // Init Revenue Comparison
    function initRevenueComparison(income) {
        const canvas = document.getElementById('revenueComparisonChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const isDark = document.body.classList.contains('dark-mode');
        const gridColor = isDark ? '#2d333b' : '#f1f5f9';
        const textColor = isDark ? '#adb9c7' : '#94a3b8';

        const now = new Date();
        const dayOfWeek = now.getDay() || 7; 
        const currentWeekStart = new Date(now);
        currentWeekStart.setDate(now.getDate() - dayOfWeek + 1);
        currentWeekStart.setHours(0,0,0,0);
        
        const lastWeekStart = new Date(currentWeekStart);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);

        const currentWeekData = [0,0,0,0,0,0,0];
        const lastWeekData = [0,0,0,0,0,0,0];

        income.forEach(o => {
            const d = new Date(o.income_date || o.date);
            const amt = parseFloat(o.amount) || 0;
            if (d >= currentWeekStart && d < new Date(currentWeekStart.getTime() + 7*24*60*60*1000)) {
                const day = d.getDay() || 7; 
                currentWeekData[day - 1] += amt;
            }
            if (d >= lastWeekStart && d < currentWeekStart) {
                const day = d.getDay() || 7; 
                lastWeekData[day - 1] += amt;
            }
        });

        if (revChartInstance) revChartInstance.destroy();

        revChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [
                    {
                        label: 'This Week',
                        data: currentWeekData,
                        backgroundColor: '#10b981',
                        hoverBackgroundColor: '#059669',
                        borderRadius: 6,
                        barPercentage: 0.6,
                        categoryPercentage: 0.8
                    },
                    {
                        label: 'Last Week',
                        data: lastWeekData,
                        backgroundColor: isDark ? '#2d333b' : '#e2e8f0',
                        hoverBackgroundColor: isDark ? '#3d444d' : '#cbd5e1',
                        borderRadius: 6,
                        barPercentage: 0.6,
                        categoryPercentage: 0.8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8, color: textColor } }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: gridColor, drawBorder: false },
                        ticks: { font: { size: 10, family: 'Inter' }, color: textColor, callback: (v) => (v / 1000) + 'K' },
                        border: { display: false }
                    },
                    x: { grid: { display: false }, ticks: { font: { size: 10, family: 'Inter' }, color: textColor }, border: { display: false } }
                }
            }
        });

        const currentTotal = currentWeekData.reduce((a, b) => a + b, 0);
        const lastTotal = lastWeekData.reduce((a, b) => a + b, 0);
        let changePercent = lastTotal > 0 ? (((currentTotal - lastTotal) / lastTotal) * 100).toFixed(1) : (currentTotal > 0 ? 100 : 0);

        if (document.getElementById('current-revenue')) document.getElementById('current-revenue').textContent = 'LKR ' + Math.round(currentTotal).toLocaleString();
        if (document.getElementById('last-revenue')) document.getElementById('last-revenue').textContent = 'LKR ' + Math.round(lastTotal).toLocaleString();
        const changeEl = document.getElementById('revenue-change');
        if (changeEl) {
            changeEl.textContent = (changePercent >= 0 ? '+' : '') + changePercent + '%';
            const trendDiv = changeEl.closest('.comparison-trend');
            if (trendDiv) {
                trendDiv.className = 'comparison-trend ' + (changePercent >= 0 ? 'up' : 'down');
                const icon = trendDiv.querySelector('i');
                if (icon) icon.className = 'fa-solid ' + (changePercent >= 0 ? 'fa-arrow-up' : 'fa-arrow-down');
            }
        }
    }

    // Init Profit Calculator
    function initProfitCalculator(products) {
        const productSelect = document.getElementById('profit-product');
        if (!productSelect) return;

        productSelect.innerHTML = '<option value="">Select a product...</option>' + 
            products.map(p => {
                const cost = p.cost || Math.round(p.price * 0.7);
                return `<option value="${p.id}" data-cost="${cost}" data-price="${p.price}">${p.name}</option>`;
            }).join('');

        productSelect.onchange = function() {
            const selected = this.options[this.selectedIndex];
            document.getElementById('profit-cost').value = selected.dataset.cost || 0;
            document.getElementById('profit-sell').value = selected.dataset.price || 0;
            calculateProfit();
        };
    }

    window.calculateProfit = function() {
        const cost = parseFloat(document.getElementById('profit-cost').value) || 0;
        const sell = parseFloat(document.getElementById('profit-sell').value) || 0;
        const qty = parseInt(document.getElementById('profit-qty').value) || 1;
        // Profit
        const profit = (sell - cost) * qty;
        const margin = sell > 0 ? (((sell - cost) / sell) * 100).toFixed(1) : 0;
        
        document.getElementById('profit-per-unit').textContent = 'LKR ' + (sell - cost).toLocaleString();
        document.getElementById('profit-margin').textContent = margin + '%';
        document.getElementById('profit-total').textContent = 'LKR ' + profit.toLocaleString();
    };

    // Render Service Workflow Widget
    function renderServiceWorkflowWidget(services) {
        const container = document.getElementById('service-workflow-container');
        if (!container) return;

        const activeServices = services
            .filter(s => s.status !== 'Cancelled')
            .sort((a, b) => new Date(b.service_date || b.date) - new Date(a.service_date || a.date))
            .slice(0, 5);

        if (activeServices.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">No active services.</div>';
            return;
        }

        container.innerHTML = activeServices.map(s => {
            let statusColor = 'text-warning'; let progress = '25%'; let statusText = 'Pending';
            if (s.status === 'In Progress') { statusColor = 'text-primary'; progress = '60%'; statusText = 'In Progress'; }
            else if (s.status === 'Completed') { statusColor = 'text-success'; progress = '100%'; statusText = 'Finished'; }

            return `
            <div class="workflow-card animate-reveal" style="display: flex; gap: 15px; padding: 15px; border-bottom: 1px solid #f0f0f0; align-items: center;">
                <div class="wf-icon" style="width: 40px; height: 40px; border-radius: 8px; background: #eef2ff; color: #4338ca; display: flex; align-items: center; justify-content: center;">
                    <i class="fa-solid fa-${getServiceIcon(s.type)}"></i>
                </div>
                <div class="wf-details" style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <strong style="color: #1f2937; font-size: 0.85rem;">${s.type} - ${s.customer}</strong>
                        <span style="font-size: 0.75rem; font-weight: 700;" class="${statusColor}">${statusText}</span>
                    </div>
                    <div class="wf-progress-bar" style="height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden; margin-bottom: 5px;">
                        <div style="width: ${progress}; height: 100%; background: var(--primary-blue); border-radius: 3px; transition: width 0.8s ease;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #6b7280;">
                        <span><i class="fa-solid fa-user-gear"></i> ${s.staff || s.driver || 'Unassigned'}</span>
                        <span>${new Date(s.service_date || s.date).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    // Get Service Icon
    function getServiceIcon(type) {
        const map = { 'Repair': 'screwdriver-wrench', 'Installation': 'plug', 'Delivery Only': 'truck', 'Maintenance': 'clipboard-check' };
        return map[type] || 'bell';
    }

    // ================== INITIALIZATION ==================
    refreshDashboardData(true);
    setInterval(() => refreshDashboardData(false), 30000);

    window.addEventListener('themeChanged', () => {
        const cached = JSON.parse(localStorage.getItem('dashboard_analytics_cache'));
        if (cached) initRevenueComparison(cached.orders);
    });
});
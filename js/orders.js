document.addEventListener('DOMContentLoaded', function() {
    let orders = [];
    let products = [];
    let suppliers = [];
    let currentFilter = 'All';
    let currentPage = 1;
    let itemsPerPage = 6;

    // ── Fetch supporting data (products & suppliers) ──────────────────────
    async function fetchData() {
        try {
            const [prodRes, suppRes] = await Promise.all([
                window.apiFetch('products.php'),
                window.apiFetch('suppliers.php')
            ]);
            
            if (prodRes && prodRes.success) {
                products = prodRes.data;
                populateProductsDropdown();
            }
            if (suppRes && suppRes.success) {
                suppliers = suppRes.data;
                populateSuppliersDropdown();
            }
        } catch(e) { console.error('Error fetching meta data', e); }
    }

    // Populate Products Dropdown
    function populateProductsDropdown() {
        const productSelect = document.getElementById('item-product');
        if(productSelect) {
            productSelect.innerHTML = '<option value="">Select Product...</option>';
            products.forEach(p => {
                productSelect.innerHTML += `<option value="${p.id}" data-price="${p.price}">${p.name} (Stock: ${p.stock})</option>`;
            });
        }
    }

    // Populate Suppliers Dropdown
    function populateSuppliersDropdown(selectId = 'ord-supplier') {
        const sel = document.getElementById(selectId);
        if (!sel) return;
        sel.innerHTML = '<option value="">-- Select Supplier --</option>';
        suppliers.forEach(s => {
            sel.innerHTML += `<option value="${s.name}">${s.name}</option>`;
        });
    }



    // Load Orders
    async function loadOrders(page = 1) {
        currentPage = page;
        renderTable([], true);
        try {
            const searchInput = document.getElementById('order-search');
            let query = searchInput ? searchInput.value.trim() : '';
            
            let url = `orders.php?filter=${currentFilter}`;
            if (query) url += `&search=${encodeURIComponent(query)}`;

            const data = await window.apiFetch(url);
            if (data && data.success) {
                orders = data.data;
                renderTable(orders);
            }
        } catch(e) { console.error(e); renderTable([]); }
        updateOrderStats();
    }

    // Update Order Stats
    async function updateOrderStats() {
        try {
            const data = await window.apiFetch('orders.php?action=stats');
            if (data && data.success) {
                const s = data.data;
                // Set Txt
                const setTxt = (id, val) => { window.animateStat(id, val); };
                
                setTxt('total-orders-count', s.total);
                setTxt('pending-orders-count', s.pending);
                setTxt('completed-orders-count', s.completed);
                setTxt('cancelled-orders-count', s.cancelled);
                
                const revEl = document.getElementById('total-revenue-count');
                if (revEl) window.animateStat('total-revenue-count', s.totalRevenue || 0, 'LKR ');
            }
        } catch(e) {}
    }

    // Get Suggested Reorder Qty
    function getSuggestedReorderQty(stock) {
        if (stock === 0) return 50;
        if (stock <= 5) return 30;
        if (stock <= 15) return 20;
        return 10;
    }

    window.exportOrders = window.exportToCSV = function() {
        if (orders.length === 0) { alert("No data to export!"); return; }

        window.ExportUtils.toExcel({
            fileName: 'orders_report.xls',
            sheetName: 'Orders',
            headers: ['Order ID', 'Supplier', 'Date', 'Total', 'Status'],
            rows: orders.map(o => [
                Number(o.id) || o.id || '',
                o.supplier || '',
                o.order_date || o.date || '',
                Number(o.total) || 0,
                o.status || ''
            ])
        });
    };

    const tableBody = document.getElementById('order-table-body');
    const modal = document.getElementById('order-modal');
    const form = document.getElementById('order-form');

    window.printInvoice = function(passedId = null) {
        let id = passedId;
        if(!id) id = document.getElementById('ord-id').value;
        if(!id) { alert("Please save the order first or select an existing order."); return; }

        const order = orders.find(o => o.id == id);
        if(!order) return;

        // Items Html
        const itemsHtml = (order.items && order.items.length > 0)
            ? `<table style="width:100%;border-collapse:collapse;margin-top:20px;">
                    <thead>
                        <tr style="background:#f8fafc;text-align:left;">
                            <th style="padding:10px;border-bottom:2px solid #ddd;">Item</th>
                            <th style="padding:10px;border-bottom:2px solid #ddd;">Qty</th>
                            <th style="padding:10px;border-bottom:2px solid #ddd;text-align:right;">Price</th>
                            <th style="padding:10px;border-bottom:2px solid #ddd;text-align:right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${order.items.map(item => `
                            <tr>
                                <td style="padding:10px;border-bottom:1px solid #eee;">${item.product_name || item.name}</td>
                                <td style="padding:10px;border-bottom:1px solid #eee;">${item.qty}</td>
                                <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">${parseFloat(item.price).toFixed(2)}</td>
                                <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">${parseFloat(item.total || (item.price*item.qty)).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`
            : `<p style="color:#64748b;margin-top:16px;"><em>Details not available for legacy orders.</em></p>`;

        const content = `
            <div style="padding:0 12px;color:#1f2937;">
                <div style="text-align:center;margin-bottom:22px;">
                    <h2 style="margin:0;">Purchase Order Preview</h2>
                    <p style="margin:8px 0 0 0;color:#64748b;">Order #${order.id}</p>
                </div>
                <table style="width:100%;border-collapse:collapse;">
                    ${['Order ID','Supplier','Date','Status','Total'].map((label, idx) => {
                        const keys = ['id','supplier','order_date','status','total'];
                        const value = keys[idx] === 'total'
                            ? `LKR ${parseFloat(order.total || 0).toLocaleString()}`
                            : (order[keys[idx]] || (label === 'Supplier' ? 'Walk-in' : 'N/A'));
                        return `<tr style="border-top:1px solid #e5e7eb;"><td style="padding:10px 8px;color:#64748b;width:35%;">${label}</td><td style="padding:10px 8px;font-weight:600;text-align:right;">${value}</td></tr>`;
                    }).join('')}
                </table>
                <div style="margin-top:18px;"><h3 style="margin:0 0 10px 0;color:#1f2937;">Items</h3>${itemsHtml}</div>
            </div>
        `;

        window.openPrintPreviewModal({
            reportTitle: `Purchase Order #${order.id}`,
            headline: `Order Print Preview`,
            contentHtml: content,
            width: '920px'
        });
    }

    let searchTimer;
    window.searchOrders = function() {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(loadOrders, 300);
    }
    const internalSearch = document.getElementById('order-search');
    if(internalSearch) {
        internalSearch.addEventListener('input', window.searchOrders);
    }

    // Get Status Class
    function getStatusClass(status) {
        if(status === 'Completed') return 'complete';

        if(status === 'Cancelled') return 'cancelled';
        return 'pending';
    }



    // Render Table
    function renderTable(data = orders, isLoading = false) {
        if(!tableBody) return;
        tableBody.innerHTML = "";
        
        if (isLoading) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;" class="text-dimmed">Loading orders...</td></tr>';
            return;
        }

        if (!data || data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;" class="text-dimmed">No orders found</td></tr>';
            return;
        }

        // Sort by ID descending (most recent first)
        const sortedData = [...data].sort((a, b) => (parseInt(b.id) || 0) - (parseInt(a.id) || 0));

        // Apply pagination
        const paginated = Utils.paginate(sortedData, currentPage, itemsPerPage);

        paginated.items.forEach((o, idx) => {
            const tr = document.createElement('tr');
            let statusColor = '#f59e0b'; // Amber
            if(o.status === 'Completed') { statusLabel = 'DONE'; statusClass = 'complete'; statusColor = '#10b981'; }
            else if(o.status === 'Ordered') { statusLabel = 'ORDERED'; statusClass = 'pending'; statusColor = '#2563eb'; }
            else if(o.status === 'Pending' || o.status === 'Shipping') { statusLabel = 'WAIT'; statusClass = 'pending'; statusColor = '#f97316'; }
            else if(o.status === 'Cancelled') { statusLabel = 'VOID'; statusClass = 'cancelled'; statusColor = '#ef4444'; }

            const itemCount = o.items ? o.items.length : 0;
            const itemsText = itemCount === 1 ? '1 item' : itemCount + ' items';

            // Row Index
            const rowIndex = (currentPage - 1) * itemsPerPage + (idx + 1);

            tr.innerHTML = `
                <td class="text-xs text-dimmed">${rowIndex}</td>
                <td>${o.supplier || '<span class="text-dimmed">Walk-in</span>'}</td>
                <td class="text-muted-alt" style="font-size: 0.85rem;">${o.order_date || o.date || '-'}${o.expected_delivery_date ? `<div class="text-dimmed" style="font-size: 0.74rem; margin-top: 4px;">ETA: ${o.expected_delivery_date}</div>` : ''}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span class="status ${statusClass}" style="font-weight: 700; font-size: 0.75rem; color: ${statusColor};">${statusLabel}</span>
                    </div>
                </td>
                <td><span class="category-badge">${itemsText}</span></td>
                <td style="text-align: right; font-weight: 700;">LKR ${parseFloat(o.total || 0).toLocaleString()}</td>
                <td>
                    <div class="action-btns" style="justify-content: flex-end;">
                        <button class="btn-action btn-view" title="View Order" onclick="viewOrder(${o.id})"><i class="fa-regular fa-eye"></i></button>
                        <button class="btn-action btn-edit" title="Edit Order" onclick="editOrder(${o.id})"><i class="fa-regular fa-pen-to-square"></i></button>
                        <button class="btn-action btn-print" title="Print Invoice" onclick="printInvoice(${o.id})"><i class="fa-solid fa-print"></i></button>

                        ${o.tracking_number ? `<button class="btn-action btn-track" title="Track Shipment" onclick="trackShipment('${o.tracking_number}')"><i class="fa-solid fa-truck"></i></button>` : ''}
                        <button class="btn-action btn-delete" title="Delete" onclick="deleteOrder(${o.id})"><i class="fa-regular fa-trash-can"></i></button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        // Render Pagination UI
        Utils.renderPagination('orders-pagination', paginated, (newPage) => {
            currentPage = newPage;
            renderTable(orders);
        });
    }

    window.filterOrders = function(status, btn) {
        const buttons = document.querySelectorAll('.filter-tabs button');
        buttons.forEach(b => b.classList.remove('active'));
        if(btn) btn.classList.add('active');
        currentFilter = status;
        loadOrders();
    }

    // --- ITEMS LOGIC ---
    let currentOrderItems = [];
    const productSelect = document.getElementById('item-product');
    const unitCostInput = document.getElementById('item-cost');
    
    if(productSelect) {
        productSelect.addEventListener('change', function() {
            const selected = this.options[this.selectedIndex];
            const price = selected.dataset.price || 0;
            unitCostInput.value = price;
        });
    }

    const btnAddItem = document.getElementById('btn-add-item');
    if(btnAddItem) {
        btnAddItem.addEventListener('click', function() {
            const prodId = productSelect.value;
            const prodName = productSelect.options[productSelect.selectedIndex].text.split(' (')[0]; 
            const qty = parseInt(document.getElementById('item-qty').value) || 0;
            const cost = parseFloat(unitCostInput.value) || 0;

            if(!prodId || qty <= 0) {
                alert("Please select a product and valid quantity.");
                return;
            }

            currentOrderItems.push({
                productId: Number(prodId),
                name: prodName,
                qty: qty,
                price: cost,
                total: qty * cost
            });

            renderOrderItems();
            
            productSelect.value = "";
            document.getElementById('item-qty').value = "1";
            unitCostInput.value = "";
        });
    }

    // Render Order Items
    function renderOrderItems() {
        const tbody = document.getElementById('order-items-list');
        const totalEl = document.getElementById('ord-total');
        const displayTotalEl = document.getElementById('display-total');

        if(!tbody || !totalEl || !displayTotalEl) return;

        if(currentOrderItems.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 10px;" class="text-dimmed">No items added</td></tr>';
            totalEl.value = 0;
            displayTotalEl.innerText = "LKR 0.00";
            return;
        }

        let grandTotal = 0;
        tbody.innerHTML = currentOrderItems.map((item, index) => {
            const itemTotal = parseFloat(item.total || (item.qty * item.price) || 0);
            grandTotal += itemTotal;
            return `
                <tr>
                    <td style="padding: 6px;">${item.name || item.product_name}</td>
                    <td style="padding: 6px;">${item.qty}</td>
                    <td style="padding: 6px; text-align: right;">${itemTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td><i class="fa-solid fa-times text-danger" style="cursor: pointer;" onclick="removeOrderItem(${index})"></i></td>
                </tr>
            `;
        }).join('');

        totalEl.value = grandTotal;
        displayTotalEl.innerText = "LKR " + grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2});
    }

    window.removeOrderItem = function(index) {
        currentOrderItems.splice(index, 1);
        renderOrderItems();
    }

    window.openOrderModal = function() {
        if(!modal) return;
        modal.classList.add('show');
        populateSuppliersDropdown();
        
        if(form) form.reset();
        currentOrderItems = [];
        renderOrderItems();
        document.getElementById('ord-id').value = '';
        document.getElementById('ord-date').value = new Date().toISOString().split('T')[0];
    }

    window.closeModal = window.closeOrderModal = function() { if(modal) modal.classList.remove('show'); }

    window.deleteOrder = async function(id) {
        if(await window.Utils.showConfirm('Delete Order Record?')) {
            try {
                await window.apiFetch(`orders.php?id=${id}`, { method: 'DELETE' });
                showToast('Order deleted');
                loadOrders();
                if(window.updateGlobalNavStats) window.updateGlobalNavStats();
            } catch(e) {
                showToast(e.message, 'error');
            }
        }
    };

    // ── Reorder Modal ─────────────────────────────────────────────────────
    window.openReorderModal = function(productId, productName, currentStock) {
        // Populate supplier list inside reorder modal
        const reorderSupplierSel = document.getElementById('reorder-supplier-select');
        if (reorderSupplierSel) {
            reorderSupplierSel.innerHTML = '<option value="">-- Select Supplier --</option>';
            suppliers.forEach(s => {
                reorderSupplierSel.innerHTML += `<option value="${s.name}">${s.name}</option>`;
            });
        }

        // Fill hidden fields & product info banner
        document.getElementById('reorder-product-id').value          = productId;
        document.getElementById('reorder-product-name-hidden').value = productName;
        document.getElementById('reorder-quantity').value            = getSuggestedReorderQty(parseInt(currentStock) || 0);
        document.getElementById('reorder-unit-cost').value           = '';
        document.getElementById('reorder-expected-date').value       = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
        document.getElementById('reorder-notes').value               = '';

        const infoBanner  = document.getElementById('reorder-product-info');
        const nameEl      = document.getElementById('reorder-product-name');
        const stockBadge  = document.getElementById('reorder-stock-badge');
        if (infoBanner) {
            infoBanner.style.display = 'block';
            nameEl.textContent  = productName;
            stockBadge.textContent = currentStock == 0 ? 'OUT OF STOCK' : `Current Stock: ${currentStock}`;
        }

        // Try to pre-fill the cost from the products array
        const product = products.find(p => p.id == productId);
        if (product && product.cost) {
            document.getElementById('reorder-unit-cost').value = parseFloat(product.cost).toFixed(2);
        }

        document.getElementById('reorder-modal').classList.add('show');
    };

    window.closeReorderModal = function() {
        document.getElementById('reorder-modal').classList.remove('show');
    };

    window.confirmReorder = async function() {
        const productId   = document.getElementById('reorder-product-id').value;
        const productName = document.getElementById('reorder-product-name-hidden').value;
        const supplier    = document.getElementById('reorder-supplier-select').value;
        const qty         = parseInt(document.getElementById('reorder-quantity').value) || 0;
        const unitCost    = parseFloat(document.getElementById('reorder-unit-cost').value) || 0;
        const expectedDate = document.getElementById('reorder-expected-date').value || '';

        if (!supplier) { showToast('Please select a supplier.', 'error'); return; }
        if (qty < 1)   { showToast('Quantity must be at least 1.', 'error'); return; }

        const total = qty * unitCost;
        const orderPayload = {
            supplier: supplier,
            date:     new Date().toISOString().split('T')[0],
            expected_delivery_date: expectedDate || null,
            status:   'Ordered',
            total:    total,
            items: [{
                productId: Number(productId),
                name:      productName,
                qty:       qty,
                price:     unitCost,
                total:     total
            }]
        };

        try {
            await window.apiFetch('orders.php', { method: 'POST', body: orderPayload });
            showToast(`Re-order created for "${productName}" — ${qty} units added to inventory`, 'success');
            closeReorderModal();
            // Refresh everything
            await fetchData();
            loadOrders();
            if (window.updateGlobalNavStats) window.updateGlobalNavStats();
        } catch(e) {
            showToast(e.message || 'Failed to create re-order.', 'error');
        }
    };

    if(form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            const id = document.getElementById('ord-id').value;
            const data = {
                supplier: document.getElementById('ord-supplier').value || null,
                date: document.getElementById('ord-date').value,
                total: parseFloat(document.getElementById('ord-total').value),
                status: document.getElementById('ord-status').value,
                items: currentOrderItems
            };
            if (id) data.id = id;
            
            try {
                await window.apiFetch(`orders.php`, { method: 'POST', body: data });
                const isEdit = id ? true : false;
                showToast(isEdit ? 'Order updated successfully' : 'Order created successfully');
                closeModal();
                loadOrders();
                if(window.updateGlobalNavStats) window.updateGlobalNavStats();
            } catch(e) {
                showToast(e.message, 'error');
            }
        });
    }

    window.viewOrder = function(id) {
        const order = orders.find(o => o.id == id);
        if(!order) return;
        
        // Items List
        const itemsList = (order.items && order.items.length > 0)
            ? `<table style="width:100%; border-collapse:collapse; margin-top:10px;">
                <thead>
                    <tr style="background:#f8fafc; border-bottom: 1px solid #e2e8f0;">
                        <th style="padding:8px 12px; font-size:0.7rem; color:#64748b; text-transform:uppercase; text-align:left;">Item</th>
                        <th style="padding:8px 12px; font-size:0.7rem; color:#64748b; text-transform:uppercase; text-align:center;">Qty</th>
                        <th style="padding:8px 12px; font-size:0.7rem; color:#64748b; text-transform:uppercase; text-align:right;">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${order.items.map(item => `
                        <tr style="border-bottom:1px solid #f1f5f9;">
                            <td style="padding:8px 12px; font-weight:600; color:#1e293b; font-size:0.9rem;">${item.product_name || item.name}</td>
                            <td style="padding:8px 12px; color:#475569; text-align:center; font-size:0.9rem;">${item.qty}</td>
                            <td style="padding:8px 12px; font-weight:700; color:#0f172a; text-align:right; font-size:0.9rem;">LKR ${parseFloat(item.total || (item.price*item.qty)).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
              </table>`
            : `<p style="padding:15px; text-align:center; color:#94a3b8; font-style:italic; font-size:0.9rem;">No items recorded for this order.</p>`;

        const content = `
            <div style="color: #1e293b; max-width: 440px; margin: 0 auto;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #f1f5f9;">
                    <div style="width: 48px; height: 48px; border-radius: 12px; background: #f0f9ff; color: #0369a1; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                        <i class="fa-solid fa-cart-shopping"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Order Summary</div>
                        <div style="font-size: 1.1rem; font-weight: 800; color: #0f172a;">#${order.id}</div>
                    </div>
                    <div style="margin-left: auto;">
                        <span style="display:inline-block; padding:4px 12px; border-radius:8px; font-size:0.75rem; font-weight:700; background:#f1f5f9; color:#475569; border:1px solid #e2e8f0;">${order.status}</span>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 14px; margin-bottom: 20px;">
                    <div style="display: flex; gap: 12px; align-items: flex-start;">
                        <i class="fa-solid fa-building-columns" style="color: #94a3b8; width: 16px; margin-top: 4px;"></i>
                        <div>
                            <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 2px;">Supplier / Origin</div>
                            <div style="font-size: 0.95rem; font-weight: 700; color: #1e293b;">${order.supplier || 'Walk-in'}</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 12px; align-items: flex-start;">
                        <i class="fa-solid fa-calendar-day" style="color: #94a3b8; width: 16px; margin-top: 4px;"></i>
                        <div>
                            <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 2px;">Order Date</div>
                            <div style="font-size: 0.9rem; color: #475569;">${order.order_date || order.date}</div>
                        </div>
                    </div>
                </div>

                <div style="background:#f8fafc; border-radius:12px; border:1px solid #f1f5f9; padding:12px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                        <i class="fa-solid fa-list-ul" style="font-size: 0.75rem; color: #64748b;"></i>
                        <h4 style="margin:0; font-size:0.75rem; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">Purchased Items</h4>
                    </div>
                    
                    <div style="max-height: 200px; overflow-y: auto; margin-bottom: 10px;">
                        ${itemsList}
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; padding-top:12px; border-top:2px dashed #e2e8f0; margin-top:8px;">
                        <span style="font-weight:700; color:#64748b; font-size:0.85rem;">Grand Total:</span>
                        <strong style="font-weight:800; color:#0f172a; font-size:1.2rem;">LKR ${parseFloat(order.total || 0).toLocaleString()}</strong>
                    </div>
                </div>
            </div>`;

        window.showCenteredModal({
            title: `Order Details`,
            content: content,
            primaryText: 'Print',
            primaryAction: function() { window.printOrder(id); },
            secondaryText: 'Close',
            secondaryAction: window.closeCenteredModal,
            width: '500px'
        });
    };

    window.editOrder = function(id) {
        const order = orders.find(o => o.id == id);
        if(!order) return;
        
        // Populate the modal with order data
        document.getElementById('ord-id').value = order.id;
        document.getElementById('ord-supplier').value = order.supplier || '';
        document.getElementById('ord-date').value = order.order_date || order.date;
        document.getElementById('ord-status').value = order.status;
        document.getElementById('ord-total').value = order.total || 0;
        
        // For items, if available, populate currentOrderItems
        if(order.items) {
            currentOrderItems = order.items.map(item => ({
                productId: item.productId || item.id,
                name: item.product_name || item.name,
                qty: item.qty,
                price: item.price,
                total: item.total || (item.price * item.qty)
            }));
            renderOrderItems();
        }
        
        // Open modal
        if(modal) modal.classList.add('show');
    }

    window.printOrder = function(id) {
        const order = orders.find(o => o.id == id);
        if(!order) return;

        // Items Html
        const itemsHtml = (order.items && order.items.length > 0)
            ? `<table style="width:100%; border-collapse:collapse; margin-top:20px;">
                    <thead>
                        <tr style="background:#f8fafc; text-align:left;">
                            <th style="padding:12px 10px; border-bottom:2px solid #e2e8f0; color: #64748b; font-size: 0.8rem; text-transform: uppercase;">Item</th>
                            <th style="padding:12px 10px; border-bottom:2px solid #e2e8f0; color: #64748b; font-size: 0.8rem; text-transform: uppercase;">Qty</th>
                            <th style="padding:12px 10px; border-bottom:2px solid #e2e8f0; color: #64748b; font-size: 0.8rem; text-transform: uppercase; text-align:right;">Price</th>
                            <th style="padding:12px 10px; border-bottom:2px solid #e2e8f0; color: #64748b; font-size: 0.8rem; text-transform: uppercase; text-align:right;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${order.items.map(item => `
                            <tr>
                                <td style="padding:12px 10px; border-bottom:1px solid #f1f5f9; color: #1e293b; font-weight: 600;">${item.product_name || item.name}</td>
                                <td style="padding:12px 10px; border-bottom:1px solid #f1f5f9; color: #334155;">${item.qty}</td>
                                <td style="padding:12px 10px; border-bottom:1px solid #f1f5f9; color: #334155; text-align:right;">${parseFloat(item.price).toFixed(2)}</td>
                                <td style="padding:12px 10px; border-bottom:1px solid #f1f5f9; color: #1e293b; font-weight: 700; text-align:right;">${parseFloat(item.total || (item.price*item.qty)).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`
            : `<div style="padding: 20px; background: #f8fafc; border-radius: 8px; text-align: center; color: #94a3b8; font-style: italic; margin-top: 20px;">Details not available for legacy orders.</div>`;

        const detailsTableHtml = `
            <table style="width:100%; border-collapse:collapse; margin-bottom: 30px;">
                ${['Order ID','Supplier','Date','Status','Total Amount'].map((label, idx) => {
                    const keys = ['id','supplier','order_date','status','total'];
                    const value = keys[idx] === 'total'
                        ? `LKR ${parseFloat(order.total || 0).toLocaleString()}`
                        : (order[keys[idx]] || (label === 'Supplier' ? 'Generic Supplier' : 'N/A'));
                    return `
                        <tr>
                            <td style="padding: 12px 8px; color: #64748b; width: 35%; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem;">${label}</td>
                            <td style="padding: 12px 8px; font-weight: 700; text-align: right; color: #1e293b; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem;">
                                ${label === 'Order ID' ? '#' + value : value}
                            </td>
                        </tr>`;
                }).join('')}
            </table>
        `;

        window.openPrintPreviewModal({
            reportTitle: `Purchase Order - #${order.id}`,
            headline: 'Order Details',
            subHeadline: `Supplier: ${order.supplier || 'Generic'} | Date: ${order.order_date || order.date}`,
            contentHtml: `
                <div style="padding: 0 5px;">
                    <div style="display: flex; gap: 40px; align-items: flex-start; margin-bottom: 20px;">
                        <div style="flex: 1;">
                            <h3 style="font-size: 0.85rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">Order Summary</h3>
                            ${detailsTableHtml}
                        </div>
                    </div>
                    <h3 style="font-size: 0.85rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">Order Line Items</h3>
                    ${itemsHtml}
                </div>
            `,
            width: '850px'
        });
    }

    window.closeViewOrderModal = function() {
        const viewModal = document.getElementById('view-order-modal');
        if(viewModal) viewModal.classList.remove('show');
    }

    // Add event listeners for view modal
    document.addEventListener('DOMContentLoaded', function() {
        const closeViewBtn = document.querySelector('.close-view-btn');
        if(closeViewBtn) closeViewBtn.addEventListener('click', window.closeViewOrderModal);
        window.addEventListener('click', (e) => {
            const viewModal = document.getElementById('view-order-modal');
            if(viewModal && e.target == viewModal) window.closeViewOrderModal();
        });
    });

    fetchData().then(() => {
        // Handle direct reorder request from URL (e.g. from Dashboard)
        const params = new URLSearchParams(window.location.search);
        const reorderId = params.get('reorder');
        if (reorderId) {
            const p = products.find(prod => prod.id == reorderId);
            if (p) {
                setTimeout(() => openReorderModal(p.id, p.name, p.stock), 500);
            }
        }
    });

    window.trackShipment = async function(trackingNumber) {
        try {
            const response = await window.apiFetch(`shipping.php?action=track&tracking_number=${trackingNumber}`);
            if (response.success) {
                const data = response.data;
                alert(`Tracking Info:\nStatus: ${data.status}\nEstimated Delivery: ${data.estimated_delivery}\nEvents: ${data.events.map(e => `${e.date}: ${e.status}`).join('\n')}`);
            } else {
                showToast(response.error, 'error');
            }
        } catch (err) {
            showToast('Tracking failed: ' + err.message, 'error');
        }
    };

    window.openReorderModal = function(productId, productName, currentStock) {
        const reorderSupplierSel = document.getElementById('reorder-supplier-select');
        if (reorderSupplierSel) {
            reorderSupplierSel.innerHTML = '<option value="">-- Select Supplier --</option>';
            suppliers.forEach(s => {
                reorderSupplierSel.innerHTML += `<option value="${s.name}">${s.name}</option>`;
            });
        }

        document.getElementById('reorder-product-id').value = productId;
        document.getElementById('reorder-product-name-hidden').value = productName;
        document.getElementById('reorder-quantity').value = getSuggestedReorderQty(parseInt(currentStock) || 0);
        document.getElementById('reorder-unit-cost').value = '';
        document.getElementById('reorder-expected-date').value = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
        document.getElementById('reorder-notes').value = '';

        const infoBanner = document.getElementById('reorder-product-info');
        const nameEl = document.getElementById('reorder-product-name');
        const stockBadge = document.getElementById('reorder-stock-badge');
        if (infoBanner) {
            infoBanner.style.display = 'block';
            nameEl.textContent = productName;
            stockBadge.textContent = currentStock == 0 ? 'OUT OF STOCK' : `Current Stock: ${currentStock}`;
        }

        const product = products.find(p => p.id == productId);
        if (product && product.cost) {
            document.getElementById('reorder-unit-cost').value = parseFloat(product.cost).toFixed(2);
        }

        document.getElementById('reorder-modal').classList.add('show');
    };

    window.confirmReorder = async function() {
        const productId = document.getElementById('reorder-product-id').value;
        const productName = document.getElementById('reorder-product-name-hidden').value;
        const supplier = document.getElementById('reorder-supplier-select').value;
        const qty = parseInt(document.getElementById('reorder-quantity').value) || 0;
        const unitCost = parseFloat(document.getElementById('reorder-unit-cost').value) || 0;
        const expectedDate = document.getElementById('reorder-expected-date').value || '';

        if (!supplier) { showToast('Please select a supplier.', 'error'); return; }
        if (qty < 1) { showToast('Quantity must be at least 1.', 'error'); return; }

        const total = qty * unitCost;
        const orderPayload = {
            supplier: supplier,
            date: new Date().toISOString().split('T')[0],
            expected_delivery_date: expectedDate || null,
            status: 'Ordered',
            total: total,
            items: [{
                productId: Number(productId),
                name: productName,
                qty: qty,
                price: unitCost,
                total: total
            }]
        };

        try {
            await window.apiFetch('orders.php', { method: 'POST', body: orderPayload });
            showToast(`Purchase order created for "${productName}"`, 'success');
            closeReorderModal();
            await fetchData();
            loadOrders();
            if (window.updateGlobalNavStats) window.updateGlobalNavStats();
        } catch (e) {
            showToast(e.message || 'Failed to create re-order.', 'error');
        }
    };


    loadOrders();
});
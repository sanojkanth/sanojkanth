document.addEventListener('DOMContentLoaded', function() {
    // El
    const el = (id) => document.getElementById(id);
    let invoices = [];
    let products = [];
    let currentFilter = 'all';
    let currentPage = 1;
    const itemsPerPage = 6;

    // Fetch Products
    async function fetchProducts() {
        try {
            const data = await window.apiFetch('products.php');
            if (data.success) {
                products = data.data;
            }
        } catch(e) {}
    }

    // Load Invoices
    async function loadInvoices() {
        renderTable([], true);
        try {
            const searchInput = document.getElementById('invoice-search');
            let url = `invoices.php?filter=${currentFilter}`;
            if (searchInput && searchInput.value) {
                url += `&search=${encodeURIComponent(searchInput.value.trim())}`;
            }
            const data = await window.apiFetch(url);
            if (data.success) {
                invoices = data.data;
                renderTable(invoices);
            }
        } catch(e) { console.error('Failed to load invoices', e); renderTable([]); }
        updateStats();
    }

    // Update Stats
    async function updateStats() {
        try {
            const data = await window.apiFetch('invoices.php?action=stats');
            if (data.success) {
                const s = data.data;
                // Fmt
                const fmt = (v) => window.Utils.formatCurrency(v);

                if(el('stat-total')) window.animateStat('stat-total', s.total);
                const currency = window.Utils.getSettings().currency || 'LKR';
                if(el('stat-total')) window.animateStat('stat-total', s.total);
                if(el('stat-paid')) window.animateStat('stat-paid', s.paidTotal, currency + ' ');
                if(el('stat-paid-count')) el('stat-paid-count').textContent = s.paid + ' invoices';
                if(el('stat-unpaid')) window.animateStat('stat-unpaid', s.unpaidTotal, currency + ' ');
                if(el('stat-unpaid-count')) el('stat-unpaid-count').textContent = s.unpaid + ' invoices';
                if(el('stat-overdue')) window.animateStat('stat-overdue', s.overdueTotal, currency + ' ');
                if(el('stat-overdue-count')) el('stat-overdue-count').textContent = s.overdue + ' invoices';

                if(el('nav-total-invoices')) window.animateStat('nav-total-invoices', s.total);
                if(el('nav-paid-invoices')) window.animateStat('nav-paid-invoices', s.paid);
                if(el('nav-unpaid-invoices')) window.animateStat('nav-unpaid-invoices', s.unpaid);
                if(el('nav-overdue-invoices')) window.animateStat('nav-overdue-invoices', s.overdue);
            }
        } catch(e) { console.error('Failed to load stats', e); }
    }

    // Calc Invoice Total
    function calcInvoiceTotal(inv) {
        let items = inv.items || [];
        if (typeof items === 'string') {
            try { items = JSON.parse(items); } catch(e) { items = []; }
        }
        const subtotal = items.reduce((sum, item) => sum + ((item.qty||0) * (item.price||0)), 0);
        const taxAmt = subtotal * (inv.tax || 0) / 100;
        return subtotal + taxAmt;
    }

    // --- RENDER TABLE ---
    const tableBody = document.getElementById('invoice-table-body');
    const paginationContainer = document.getElementById('invoices-pagination');
    // Render Table
    function renderTable(data = invoices, isLoading = false) {
        if(!tableBody) return;
        tableBody.innerHTML = '';

        if (isLoading) {
            if (paginationContainer) paginationContainer.innerHTML = '';
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 40px;" class="text-dimmed">Loading records...</td></tr>`;
            return;
        }

        if (!data || data.length === 0) {
            if (paginationContainer) paginationContainer.innerHTML = '';
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; padding: 40px;" class="text-dimmed">
                        <i class="fa-solid fa-file-circle-plus" style="font-size: 28px; margin-bottom: 12px; display:block;"></i>
                        No invoices found. Click "Create Invoice" to get started.
                    </td>
                </tr>`;
            return;
        }

        const paginated = window.Utils.paginate(data, currentPage, itemsPerPage);
        currentPage = paginated.currentPage;

        paginated.items.forEach((inv, idx) => {
            const total = calcInvoiceTotal(inv);
            const status = inv.status || 'Unpaid';
            const statusClass = status.toLowerCase();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:700; color: #64748b;">${inv.id || `#${idx+1}`}</td>
                <td>
                    <div class="item-name">${inv.customer}</div>
                    <small class="text-muted-alt">${inv.phone || ''}</small>
                </td>
                <td>${formatDate(inv.invoice_date || inv.date)}</td>
                <td>${formatDate(inv.due_date)}</td>
                <td><strong class="price-text">${Utils.formatCurrency(total)}</strong></td>
                <td><span class="status ${statusClass}">${status.toUpperCase()}</span></td>
                <td class="text-center">
                    <div class="action-btns justify-center">
                        <button class="btn-action btn-view" title="View Invoice" onclick="previewInvoice('${inv.id}')"><i class="fa-regular fa-eye"></i></button>
                        <button class="btn-action btn-edit" title="Edit Invoice" onclick="editInvoice('${inv.id}')"><i class="fa-regular fa-pen-to-square"></i></button>
                        <button class="btn-action btn-print" title="Print Invoice" onclick="printInvoice('${inv.id}')"><i class="fa-solid fa-print"></i></button>
                        <button class="btn-action btn-delete" title="Delete" onclick="deleteInvoice('${inv.id}')"><i class="fa-regular fa-trash-can"></i></button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        window.Utils.renderPagination('invoices-pagination', paginated, (newPage) => {
            currentPage = newPage;
            renderTable(invoices);
        });
    }

    // Format Date
    function formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    window.filterInvoices = function(type) {
        currentFilter = type;
        currentPage = 1;
        const buttons = document.querySelectorAll('#invoice-tabs button');
        buttons.forEach(btn => btn.classList.remove('active'));
        
        if (type === 'all') {
            buttons[0].classList.add('active');
        } else {
            buttons.forEach(btn => {
                if (btn.textContent.trim().toUpperCase() === type.toUpperCase()) btn.classList.add('active');
            });
        }
        loadInvoices();
    };

    let searchTimer;
    window.searchInvoices = function() {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            currentPage = 1;
            loadInvoices();
        }, 300);
    };

    const searchInput = document.getElementById('invoice-search');
    if (searchInput) {
        searchInput.addEventListener('input', window.searchInvoices);
    }

    // --- MODAL LINE ITEMS ---
    let modalLineItems = [];

    // Render Line Items
    function renderLineItems() {
        const container = document.getElementById('line-items-body');
        if (!container) return;
        container.innerHTML = '';

        modalLineItems.forEach((item, idx) => {
            // Line Total
            const lineTotal = (item.qty || 0) * (item.price || 0);
            const row = document.createElement('div');
            row.className = 'line-item-row';

            let optionsHtml = '<option value="">-- Select Product --</option>';
            products.forEach(p => {
                // Selected
                const selected = (item.name === p.name) ? 'selected' : '';
                optionsHtml += `<option value="${p.name}" data-price="${p.price}" ${selected}>${p.name} (${Utils.formatCurrency(p.price)})</option>`;
            });
            const isCustom = item.name && !products.find(p => p.name === item.name);
            optionsHtml += `<option value="__custom__" ${isCustom ? 'selected' : ''}>✏️ Custom Item...</option>`;

            row.innerHTML = `
                <div>
                    <select class="line-product-select" onchange="selectProduct(${idx}, this)" title="Select product" 
                            style="width:100%; padding:6px 8px; border:1px solid #e0e0e0; border-radius:6px; font-size:0.85rem; font-family:inherit; margin-bottom: ${isCustom ? '4px' : '0'};">
                        ${optionsHtml}
                    </select>
                    ${isCustom ? `<input type="text" placeholder="Type custom item name" value="${item.name || ''}" 
                        oninput="updateLineItem(${idx}, 'name', this.value)" title="Custom item name"
                        style="width:100%; padding:5px 8px; border:1px solid #e0e0e0; border-radius:6px; font-size:0.82rem; font-family:inherit;">` : ''}
                </div>
                <input type="number" min="1" value="${item.qty || 1}" 
                       oninput="updateLineItem(${idx}, 'qty', this.value)" title="Quantity">
                <input type="number" min="0" step="0.01" value="${item.price || 0}" 
                       oninput="updateLineItem(${idx}, 'price', this.value)" title="Unit price">
                <div class="line-item-total">${Utils.formatCurrency(lineTotal)}</div>
                <button type="button" class="btn-remove-line" onclick="removeLineItem(${idx})" title="Remove item">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            `;
            container.appendChild(row);
        });

        recalcTotals();
    }

    window.selectProduct = function(idx, selectEl) {
        const val = selectEl.value;
        if (val === '__custom__' || val === '') {
            modalLineItems[idx].name = '';
            modalLineItems[idx].price = 0;
            renderLineItems();
            return;
        }
        const selectedOption = selectEl.options[selectEl.selectedIndex];
        const price = parseFloat(selectedOption.getAttribute('data-price')) || 0;
        modalLineItems[idx].name = val;
        modalLineItems[idx].price = price;
        renderLineItems();
    };

    window.updateLineItem = function(idx, field, value) {
        if (field === 'qty') modalLineItems[idx].qty = parseInt(value) || 0;
        else if (field === 'price') modalLineItems[idx].price = parseFloat(value) || 0;
        else modalLineItems[idx][field] = value;
        recalcTotals();
        
        const rows = document.querySelectorAll('.line-item-row');
        if (rows[idx]) {
            // Line Total
            const lineTotal = (modalLineItems[idx].qty || 0) * (modalLineItems[idx].price || 0);
            const totalEl = rows[idx].querySelector('.line-item-total');
            if (totalEl) totalEl.textContent = Utils.formatCurrency(lineTotal);
        }
    };

    window.addLineItem = function() {
        modalLineItems.push({ name: '', qty: 1, price: 0 });
        renderLineItems();
    };

    window.removeLineItem = function(idx) {
        if (modalLineItems.length <= 1) {
            const item = modalLineItems[idx];
            if (!item || (!item.name && !item.qty && !item.price)) {
                modalLineItems.splice(idx, 1);
            } else {
                return;
            }
        } else {
            modalLineItems.splice(idx, 1);
        }
        renderLineItems();
    };

    window.recalcTotals = function() {
        const subtotal = modalLineItems.reduce((sum, item) => sum + ((item.qty || 0) * (item.price || 0)), 0);
        const taxPct = parseFloat(el('inv-tax')?.value) || 0;
        const taxAmt = subtotal * taxPct / 100;
        const grandTotal = subtotal + taxAmt;

        // Fmt
        const fmt = (v) => Utils.formatCurrency(v);
        if(el('modal-subtotal')) el('modal-subtotal').textContent = fmt(subtotal);
        if(el('modal-tax')) el('modal-tax').textContent = fmt(taxAmt);
        if(el('modal-grand-total')) el('modal-grand-total').textContent = fmt(grandTotal);
    };

    // --- OPEN / CLOSE MODAL ---
    const modal = document.getElementById('invoice-modal');
    const form = document.getElementById('invoice-form');
    window.openInvoiceModal = function(id = null) {
        if (!modal) return;
        modal.classList.add('show');

        modalLineItems = [];
        const lineItemsContainer = document.getElementById('line-items-body');
        if (lineItemsContainer) {
            lineItemsContainer.innerHTML = '';
        }

        form.reset();
        document.getElementById('inv-id').value = '';
        document.getElementById('inv-tax').value = Utils.getTaxRate();
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('inv-date').value = today;
        const due = new Date();
        due.setDate(due.getDate() + 14);
        el('inv-due-date').value = due.toISOString().split('T')[0];
        el('inv-status').value = 'Unpaid';
        el('invoice-modal-title').textContent = 'Create New Invoice';

        if (id) {
            const inv = invoices.find(item => item.id === id);
            if (inv) {
                document.getElementById('inv-id').value = inv.id;
                document.getElementById('inv-customer').value = inv.customer || '';
                document.getElementById('inv-phone').value = inv.phone || '';
                document.getElementById('inv-date').value = inv.invoice_date || inv.date || today;
                document.getElementById('inv-due-date').value = inv.due_date || due.toISOString().split('T')[0];
                if (el('inv-notes')) el('inv-notes').value = inv.notes || '';
                document.getElementById('inv-status').value = inv.status || 'Unpaid';
                document.getElementById('inv-tax').value = inv.tax || 0;
                modalLineItems = Array.isArray(inv.items) ? inv.items.map(i => ({ name: i.name || '', qty: i.qty || 1, price: i.price || 0 })) : [];
                el('invoice-modal-title').textContent = 'Edit Invoice';
            }
        }
        
        renderLineItems();
    };

    window.closeInvoiceModal = function() {
        modal.classList.remove('show');
    };

    window.saveInvoiceForm = async function() {
        if (!form.reportValidity()) {
            return;
        }

        try {
            const validItems = modalLineItems.filter(i => i.name && i.name.trim() !== '');
            if (validItems.length === 0) {
                alert('Please add at least one line item.');
                return;
            }

            const id = el('inv-id').value;
            const data = {
                id: id || null,
                customer: el('inv-customer').value,
                phone: el('inv-phone').value,
                date: el('inv-date').value,
                dueDate: el('inv-due-date').value,
                items: validItems,
                tax: parseFloat(el('inv-tax').value) || 0,
                notes: el('inv-notes') ? el('inv-notes').value : '',
                status: el('inv-status').value
            };

            try {
                await window.apiFetch('invoices.php', { method: 'POST', body: data });
                showToast(id ? 'Invoice updated successfully' : 'Invoice created successfully');
                closeInvoiceModal();
                loadInvoices();
            } catch (err) {
                console.error(err);
                showToast(err.message, 'error');
            }
        } catch (err) {
            console.error(err);
            showToast(err.message, 'error');
        }
    };
    
    if(form) form.onsubmit = function(e) { e.preventDefault(); };

    // --- ACTIONS ---
    window.deleteInvoice = async function(id) {
        if (await window.Utils.showConfirm('Delete this invoice permanently?')) {
            try {
                await window.apiFetch('invoices.php?id=' + id, { method: 'DELETE' });
                showToast('Invoice deleted');
                loadInvoices();
            } catch (err) {
                showToast(err.message, 'error');
            }
        }
    };


    window.editInvoice = function(id) {
        if (!id) return;
        window.openInvoiceModal(id);
    };

    window.printInvoice = function(id) {
        const inv = invoices.find(i => i.id === id);
        if (!inv) return;
        window.openPrintPreviewModal({
            reportTitle: `Invoice ${id}`,
            headline: 'Tax Invoice',
            contentHtml: window.renderPreviewContent(inv),
            width: '850px'
        });
    };

    window.renderPreviewContent = function(inv) {
        let items = inv.items;
        if (typeof items === 'string') {
            try { items = JSON.parse(items); } catch(e) { items = []; }
        }

        const total = calcInvoiceTotal(inv);
        const subtotal = items.reduce((s, i) => s + (i.qty * i.price), 0);
        const taxAmt = subtotal * (inv.tax || 0) / 100;

        return `
            <div class="invoice-preview-container" style="color: #1e293b;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; padding: 0 10px;">
                    <div class="bill-to">
                        <h4 style="margin: 0 0 8px 0; font-size: 0.8rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Bill To</h4>
                        <p style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #0f172a;">${inv.customer || 'Guest Customer'}</p>
                        ${inv.phone ? `<p style="margin: 4px 0 0 0; font-size: 0.95rem; color: #475569;">${inv.phone}</p>` : ''}
                    </div>
                    <div class="inv-info" style="text-align: right;">
                        <h4 style="margin: 0 0 8px 0; font-size: 0.8rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Invoice Details</h4>
                        <p style="margin: 0; font-size: 0.9rem;">Date: <strong style="color: #0f172a;">${formatDate(inv.invoice_date || inv.date)}</strong></p>
                        <p style="margin: 4px 0 0 0; font-size: 0.9rem;">Due: <strong style="color: #0f172a;">${formatDate(inv.due_date)}</strong></p>
                        <p style="margin: 10px 0 0 0;"><span style="display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; background: ${inv.status==='Paid' ? '#dcfce7' : '#fee2e2'}; color: ${inv.status==='Paid' ? '#15803d' : '#991b1b'}; border: 1px solid currentColor; letter-spacing: 0.5px;">${inv.status}</span></p>
                    </div>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; border-radius: 8px; overflow: hidden;">
                    <thead>
                        <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                            <th style="padding: 14px 12px; font-size: 0.8rem; color: #64748b; text-transform: uppercase; text-align: left; letter-spacing: 0.5px;">Item Description</th>
                            <th style="padding: 14px 12px; font-size: 0.8rem; color: #64748b; text-transform: uppercase; text-align: center; width: 60px;">Qty</th>
                            <th style="padding: 14px 12px; font-size: 0.8rem; color: #64748b; text-transform: uppercase; text-align: right; width: 120px;">Price</th>
                            <th style="padding: 14px 12px; font-size: 0.8rem; color: #64748b; text-transform: uppercase; text-align: right; width: 150px;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => `
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 16px 12px; font-size: 0.95rem; color: #334155;">${item.name}</td>
                            <td style="padding: 16px 12px; text-align: center; color: #475569;">${item.qty}</td>
                            <td style="padding: 16px 12px; text-align: right; color: #475569;">${Utils.formatCurrency(item.price)}</td>
                            <td style="padding: 16px 12px; text-align: right; font-weight: 700; color: #0f172a;">${Utils.formatCurrency(item.qty * item.price)}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div style="display: flex; justify-content: flex-end; margin-bottom: 40px;">
                    <div style="width: 300px; background: #fbfbfb; padding: 20px; border-radius: 12px; border: 1px solid #f1f5f9;">
                        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee;">
                            <span style="color: #64748b; font-size: 0.9rem;">Subtotal</span>
                            <span style="font-weight: 600; font-size: 0.9rem; color: #1e293b;">${Utils.formatCurrency(subtotal)}</span>
                        </div>
                        ${inv.tax > 0 ? `
                        <div style="display: flex; justify-content: space-between; padding: 6px 0; margin-top: 4px;">
                            <span style="color: #64748b; font-size: 0.9rem;">Tax (${inv.tax}%)</span>
                            <span style="font-weight: 600; font-size: 0.9rem; color: #1e293b;">${Utils.formatCurrency(taxAmt)}</span>
                        </div>` : ''}
                        <div style="display: flex; justify-content: space-between; padding: 12px 0 0 0; margin-top: 10px; border-top: 2px solid #0f172a;">
                            <span style="font-weight: 800; font-size: 1.1rem; color: #0f172a; text-transform: uppercase;">Grand Total</span>
                            <span style="font-weight: 800; font-size: 1.3rem; color: #0f172a;">${Utils.formatCurrency(total)}</span>
                        </div>
                    </div>
                </div>


                
                <div style="text-align: center; padding-top: 20px; border-top: 1px dotted #e2e8f0; margin-top: 20px;">
                    <p style="margin: 0; font-size: 0.9rem; color: #94a3b8; font-weight: 500;">Thank you for choosing Central Hardwares!</p>
                </div>
            </div>`;
    };

    window.currentPreviewInv = null;

    window.printCurrentPreview = function() {
        if (window.currentPreviewInv) {
            window.printInvoiceObject(window.currentPreviewInv);
        }
    };

    window.previewInvoice = function(id) {
        const inv = invoices.find(i => i.id === id);
        if (!inv) return;

        window.currentPreviewInv = inv;
        window.openPrintPreviewModal({
            reportTitle: `Invoice ${id}`,
            headline: 'Tax Invoice',
            contentHtml: window.renderPreviewContent(inv),
            width: '850px'
        });
    };

    window.previewFormInvoice = function() {
        const customer = document.getElementById('inv-customer').value || 'Guest';
        const phone = document.getElementById('inv-phone').value;
        const date = document.getElementById('inv-date').value || new Date().toISOString().split('T')[0];
        const due_date = document.getElementById('inv-due-date').value || date;
        const notes = document.getElementById('inv-notes').value;
        const tax = parseFloat(document.getElementById('inv-tax').value) || 0;
        const id = document.getElementById('inv-id').value; 
        const status = document.getElementById('inv-status').value || 'Unpaid'; 

        const items = modalLineItems.filter(i => i.name && i.name.trim() !== '');

        if (items.length === 0) {
            alert("Please add at least one item to preview.");
            return;
        }

        const tempInv = {
            id: id || 'DRAFT',
            customer, phone, date, due_date, notes, tax,
            items: items,
            status: status 
        };

        window.currentPreviewInv = tempInv;
        window.openPrintPreviewModal({
            reportTitle: `Invoice ${id || 'DRAFT'}`,
            headline: 'Invoice Preview',
            contentHtml: window.renderPreviewContent(tempInv),
            width: '850px'
        });
    };

    window.closePreviewModal = function() {
        const previewModal = document.getElementById('invoice-preview-modal');
        if (previewModal) previewModal.classList.remove('show');
    };

    window.exportInvoicesCSV = function() {
        if (invoices.length === 0) {
            alert('No invoices to export!');
            return;
        }

        const headers = ['Invoice ID', 'Customer', 'Phone', 'Date', 'Due Date', 'Items', 'Subtotal', 'Tax %', 'Grand Total', 'Status', 'Notes'];
        const rows = invoices.map(inv => {
            const total = calcInvoiceTotal(inv);
            let items = inv.items;
            if (typeof items === 'string') {
                try { items = JSON.parse(items); } catch(e) { items = []; }
            }
            const subtotal = items.reduce((s, i) => s + (i.qty * i.price), 0);
            const itemsStr = items.map(i => `${i.name} x${i.qty}`).join('; ');
            return [
                Number(inv.id) || inv.id || '',
                inv.customer || '',
                inv.phone || '',
                inv.date || '',
                inv.due_date || '',
                itemsStr,
                Number(subtotal.toFixed(2)),
                Number(inv.tax) || 0,
                Number(total.toFixed(2)),
                inv.status || '',
                inv.notes || ''
            ];
        });

        window.ExportUtils.toExcel({
            fileName: 'invoices_export.xls',
            sheetName: 'Invoices',
            headers,
            rows
        });
    };

    fetchProducts();
    loadInvoices();
});
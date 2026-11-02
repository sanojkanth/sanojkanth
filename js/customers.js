document.addEventListener('DOMContentLoaded', function() {
    let customers = [];
    let currentFilter = 'all';
    let currentPage = 1;
    const itemsPerPage = 6;

    const tableBody = document.getElementById('customers-table-body');
    const paginationContainer = document.getElementById('customers-pagination');
    const searchInput = document.getElementById('customer-search');
    const globalSearchInput = document.getElementById('global-header-search');
    const modal = document.getElementById('customer-modal');
    const modalTitle = document.getElementById('modal-title');
    const form = document.getElementById('customer-form');
    const closeBtn = document.querySelector('.close-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const productSelect = document.getElementById('c-product');

    // Load Products For Dropdown
    async function loadProductsForDropdown() {
        if (!productSelect) return;
        try {
            const data = await window.apiFetch('products.php', { method: 'GET' });
            if (data.success && data.data) {
                // Keep the first empty option
                productSelect.innerHTML = '<option value="">Select a product...</option>';
                data.data.forEach(product => {
                    const option = document.createElement('option');
                    option.value = product.name;
                    option.textContent = product.name;
                    productSelect.appendChild(option);
                });
            }
        } catch (e) {
            console.error('Failed to load products for dropdown', e);
        }
    }

    // Load Customers
    async function loadCustomers() {
        renderTable([], true);
        try {
            let url = `customers.php?filter=${currentFilter}`;
            // Query
            const query = (searchInput?.value || globalSearchInput?.value || "").trim();
            if (query) {
                url += `&search=${encodeURIComponent(query)}`;
            }
            const data = await window.apiFetch(url, { method: 'GET' });
            if (data.success) {
                customers = data.data;
                renderTable(customers);
            }
        } catch (e) {
            console.error('Failed to load customers', e);
            renderTable([]);
        }
        updateCustomerStats();
    }

    // Update Customer Stats
    async function updateCustomerStats() {
        try {
            const data = await window.apiFetch('customers.php?action=stats', { method: 'GET' });
            if (data.success) {
                const totalCustomersEl = document.getElementById('nav-cust-total');
                const newCustomersEl = document.getElementById('nav-cust-new');
                const activeTodayEl = document.getElementById('nav-cust-active');

                if(totalCustomersEl) window.animateStat('nav-cust-total', data.data.total);
                if(newCustomersEl) window.animateStat('nav-cust-new', data.data.newThisMonth);
                if(activeTodayEl) window.animateStat('nav-cust-active', data.data.activeToday);
            }
        } catch (e) {
            console.error('Failed to load stats', e);
        }
    }

    // Render Table
    function renderTable(data = customers, isLoading = false) {
        if (!tableBody) return;
        tableBody.innerHTML = ''; 

        if (isLoading) {
             if (paginationContainer) paginationContainer.innerHTML = '';
             tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px;">Loading records...</td></tr>`;
             return;
        }

        if (data.length === 0) {
            if (paginationContainer) paginationContainer.innerHTML = '';
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; padding: 30px;" class="text-muted-alt">
                        <i class="fa-solid fa-users-slash" style="font-size: 24px; margin-bottom: 10px; display:block;" class="text-dimmed"></i>
                        No customers found matching your criteria.
                    </td>
                </tr>`;
            return;
        }

        const paginated = window.Utils.paginate(data, currentPage, itemsPerPage);
        currentPage = paginated.currentPage;

        paginated.items.forEach((customer, idx) => {
            // Row Index
            const rowIndex = (currentPage - 1) * itemsPerPage + (idx + 1);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="text-xs text-dimmed">${rowIndex}</td>
                <td>
                    <div class="user-info-cell">
                        <strong class="item-name">${customer.name}</strong>
                        <span class="text-muted-alt">${customer.email || 'No Email'}</span>
                    </div>
                </td>
                <td>${customer.phone}</td>
                <td>${customer.product || '<span class="text-muted">None</span>'}</td>
                <td><span class="status-pill">${customer.warranty || 'No Warranty'}</span></td>
                <td>${customer.buy_date || '-'}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn-action btn-view" onclick="viewCustomer(${customer.id})" title="View Customer"><i class="fa-regular fa-eye"></i></button>
                        <button class="btn-action btn-edit" onclick="editCustomer(${customer.id})" title="Edit Customer"><i class="fa-regular fa-pen-to-square"></i></button>
                        <button class="btn-action btn-print" onclick="printCustomer(${customer.id})" title="Print Customer"><i class="fa-solid fa-print"></i></button>
                        <button class="btn-action btn-delete" onclick="deleteCustomer(${customer.id})" title="Delete Customer"><i class="fa-regular fa-trash-can"></i></button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        window.Utils.renderPagination('customers-pagination', paginated, (newPage) => {
            currentPage = newPage;
            renderTable(customers);
        });
    }

    window.filterCustomers = function(type, btn) {
        currentFilter = type;
        currentPage = 1;
        if(btn) {
            const buttons = document.querySelectorAll('#customer-tabs button');
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        } else {
            const buttons = document.querySelectorAll('#customer-tabs button');
            buttons.forEach(b => {
                if (b.innerText.includes('ALL') && type === 'all') b.classList.add('active');
                else b.classList.remove('active');
            });
        }
        loadCustomers();
    };

    window.searchCustomers = function() {
        currentPage = 1;
        loadCustomers();
    }

    let searchTimer;
    if(searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                currentPage = 1;
                loadCustomers();
            }, 300);
        });
    }

    window.openCustomerModal = function() {
        if(!modal) return;
        modal.classList.add('show');
        if(modalTitle) modalTitle.innerText = "Add New Customer";
        if(form) form.reset();
        const idInput = document.getElementById('c-id');
        if(idInput) idInput.value = "";
    }

    window.closeCustomerModal = function() {
        if(modal) modal.classList.remove('show');
    }

    if(closeBtn) closeBtn.addEventListener('click', window.closeCustomerModal);
    if(cancelBtn) cancelBtn.addEventListener('click', window.closeCustomerModal);
    window.addEventListener('click', (e) => { if(e.target == modal) window.closeCustomerModal(); });

    if(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('c-id').value;
            const payload = {
                name: document.getElementById('c-name').value,
                phone: document.getElementById('c-phone').value,
                email: document.getElementById('c-email').value,
                address: document.getElementById('c-address').value,
                product: document.getElementById('c-product').value,
                warranty: document.getElementById('c-warranty').value,
                buyDate: document.getElementById('c-buy-date').value
            };

            try {
                await window.apiFetch('customers.php', { method: 'POST', body: payload });
                const isEdit = id ? true : false;
                showToast(isEdit ? 'Customer updated successfully' : 'Customer added successfully');
                window.closeCustomerModal();
                loadCustomers();
                if(window.updateGlobalNavStats) window.updateGlobalNavStats();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    window.deleteCustomer = async function(id) {
        if(await window.Utils.showConfirm("Are you sure you want to delete this customer?")) {
            try {
                await window.apiFetch('customers.php?id=' + id, { method: 'DELETE' });
                showToast('Customer deleted');
                loadCustomers();
                if(window.updateGlobalNavStats) window.updateGlobalNavStats();
            } catch (err) {
                showToast(err.message, 'error');
            }
        }
    }

    window.viewCustomer = function(id) {
        const customer = customers.find(c => c.id == id);
        if(!customer) return;
        
        const content = `
            <div style="color: #1e293b; max-width: 440px; margin: 0 auto; padding: 0 5px;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px; padding-bottom: 15px; border-bottom: 1px solid #f1f5f9;">
                    <div style="width: 48px; height: 48px; border-radius: 12px; background: #fffbeb; color: #d97706; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                        <i class="fa-solid fa-user-tag"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 2px;">Customer Profile</div>
                        <div style="font-size: 1.1rem; font-weight: 800; color: #0f172a;">#${customer.id}</div>
                    </div>
                    <div style="margin-left: auto; text-align: right;">
                        <div style="font-size: 0.6rem; color: #94a3b8; text-transform: uppercase; font-weight: 700; margin-bottom: 2px; letter-spacing: 0.5px;">Loyalty</div>
                        <div style="font-size: 0.9rem; font-weight: 800; color: #eab308;">${customer.points || 0} Pts</div>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 18px;">
                    <div style="display: flex; gap: 14px; align-items: flex-start;">
                        <div style="width: 20px; display: flex; justify-content: center; margin-top: 3px;">
                            <i class="fa-solid fa-circle-user" style="color: #94a3b8; font-size: 1.1rem;"></i>
                        </div>
                        <div>
                            <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 2px; letter-spacing: 0.3px;">Customer Name</div>
                            <div style="font-size: 1rem; font-weight: 800; color: #1e293b;">${customer.name}</div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div style="display: flex; gap: 14px; align-items: flex-start;">
                            <div style="width: 20px; display: flex; justify-content: center; margin-top: 3px;">
                                <i class="fa-solid fa-phone" style="color: #94a3b8; font-size: 0.95rem;"></i>
                            </div>
                            <div>
                                <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 2px; letter-spacing: 0.3px;">Phone</div>
                                <div style="font-size: 0.9rem; color: #475569; font-weight: 600;">${customer.phone || 'N/A'}</div>
                            </div>
                        </div>
                        <div style="display: flex; gap: 14px; align-items: flex-start;">
                            <div style="width: 20px; display: flex; justify-content: center; margin-top: 3px;">
                                <i class="fa-solid fa-envelope" style="color: #94a3b8; font-size: 0.95rem;"></i>
                            </div>
                            <div>
                                <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 2px; letter-spacing: 0.3px;">Email</div>
                                <div style="font-size: 0.9rem; color: #475569; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px; font-weight: 600;" title="${customer.email}">${customer.email || 'N/A'}</div>
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 14px; align-items: flex-start;">
                        <div style="width: 20px; display: flex; justify-content: center; margin-top: 3px;">
                            <i class="fa-solid fa-house" style="color: #94a3b8; font-size: 1rem;"></i>
                        </div>
                        <div>
                            <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 2px; letter-spacing: 0.3px;">Home Address</div>
                            <div style="font-size: 0.9rem; color: #475569; line-height: 1.4; font-weight: 500;">${customer.address || 'N/A'}</div>
                        </div>
                    </div>

                    <div style="background:#f8fafc; border-radius:14px; padding:16px; border:1px solid #f1f5f9; margin-top:8px;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                            <i class="fa-solid fa-cart-shopping" style="font-size: 0.75rem; color: #64748b;"></i>
                            <h4 style="margin:0; font-size:0.7rem; color:#64748b; text-transform:uppercase; letter-spacing:0.8px; font-weight: 800;">Purchase History</h4>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                            <div><strong style="display:block; font-size:0.65rem; color:#94a3b8; margin-bottom:4px; text-transform: uppercase; letter-spacing: 0.3px;">Main Product</strong><span style="font-weight:800; color: #334155; font-size: 0.85rem;">${customer.product || 'N/A'}</span></div>
                            <div style="border-left: 1px solid #e2e8f0; padding-left: 12px;"><strong style="display:block; font-size:0.65rem; color:#94a3b8; margin-bottom:4px; text-transform: uppercase; letter-spacing: 0.3px;">Warranty</strong><span style="font-weight:800; color: #334155; font-size: 0.85rem;">${customer.warranty || 'N/A'}</span></div>
                            <div style="grid-column:1/-1; border-top: 1px solid #e2e8f0; pt: 8px; margin-top: 4px; padding-top: 8px;"><strong style="display:block; font-size:0.65rem; color:#94a3b8; margin-bottom:4px; text-transform: uppercase; letter-spacing: 0.3px;">Member Since</strong><span style="font-weight:800; color: #334155; font-size: 0.85rem;">${customer.buy_date || 'N/A'}</span></div>
                        </div>
                    </div>
                </div>
            </div>`;

        window.showCenteredModal({
            title: `Customer Profile`,
            content: content,
            primaryText: 'Print',
            primaryAction: function() { window.printCustomer(id); },
            secondaryText: 'Close',
            secondaryAction: window.closeCenteredModal,
            width: '480px'
        });
    };

    window.editCustomer = function(id) {
        const customer = customers.find(c => c.id == id);
        if(!customer || !modal) return;
        
        // Set modal title
        if (modalTitle) modalTitle.innerText = "Edit Customer";
        
        // Populate form
        document.getElementById('c-id').value = customer.id;
        document.getElementById('c-name').value = customer.name;
        document.getElementById('c-phone').value = customer.phone;
        document.getElementById('c-email').value = customer.email || '';
        document.getElementById('c-address').value = customer.address || '';
        document.getElementById('c-product').value = customer.product || '';
        document.getElementById('c-warranty').value = customer.warranty || '';
        document.getElementById('c-buy-date').value = customer.buy_date || '';
        
        // Open modal
        modal.classList.add('show');
    }

    window.printCustomer = function(id) {
        const customer = customers.find(c => c.id == id);
        if(!customer) return;

        const content = `
            <table style="width:100%; border-collapse:collapse;">
                ${['Customer ID', 'Name', 'Phone', 'Email', 'Address', 'Product', 'Warranty', 'Buy Date', 'Points'].map((label, idx) => {
                    const keys = ['id','name','phone','email','address','product','warranty','buy_date','points'];
                    const value = customer[keys[idx]] || (label === 'Points' ? 0 : 'N/A');
                    return `
                        <tr>
                            <td style="padding: 14px 8px; color: #64748b; width: 35%; border-bottom: 1px solid #f1f5f9;">${label}</td>
                            <td style="padding: 14px 8px; font-weight: 700; text-align: right; color: #1e293b; border-bottom: 1px solid #f1f5f9;">
                                ${label === 'Customer ID' ? '#' + value : value}
                            </td>
                        </tr>`;
                }).join('')}
            </table>
        `;

        window.openPrintPreviewModal({
            reportTitle: `Customer Profile - #${customer.id}`,
            headline: 'Customer Details',
            subHeadline: `${customer.name} (Joined: ${customer.buy_date || 'N/A'})`,
            contentHtml: content,
            width: '850px'
        });
    }

    window.closeViewCustomerModal = function() {
        const viewModal = document.getElementById('view-customer-modal');
        if(viewModal) viewModal.classList.remove('show');
    }

    // Add event listeners for view modal
    const closeViewBtn = document.querySelector('.close-view-btn');
    if(closeViewBtn) closeViewBtn.addEventListener('click', window.closeViewCustomerModal);
    window.addEventListener('click', (e) => {
        const viewModal = document.getElementById('view-customer-modal');
        if(viewModal && e.target == viewModal) window.closeViewCustomerModal();
    });

    window.exportCustomers = function() {
        if (customers.length === 0) return alert("No customer data to export");

        window.ExportUtils.toExcel({
            fileName: `customers_export_${new Date().toISOString().split('T')[0]}.xls`,
            sheetName: 'Customers',
            headers: ['ID', 'Name', 'Phone', 'Email', 'Address', 'Product', 'Warranty', 'Buy Date', 'Points'],
            rows: customers.map(c => [
                Number(c.id) || c.id || '',
                c.name || '',
                c.phone || '',
                c.email || '',
                c.address || '',
                c.product || '',
                c.warranty || '',
                c.buy_date || '',
                Number(c.points) || 0
            ])
        });
    };

    // Export expose
    window.customers = customers;

    // Load initial
    loadProductsForDropdown();
    loadCustomers();
});
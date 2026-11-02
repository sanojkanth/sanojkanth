(function() {
    let suppliers = [];
    let currentFilter = 'All';
    let currentPage = 1;
    const itemsPerPage = 6;

    // Load Suppliers
    async function loadSuppliers() {
        renderSupplierTable([], true);
        try {
            const searchInput = document.getElementById('supplier-search');
            let query = searchInput ? searchInput.value.trim() : '';

            let url = `suppliers.php?filter=${currentFilter}`;
            if (query) url += `&search=${encodeURIComponent(query)}`;

            const data = await window.apiFetch(url);
            if (data && data.success) {
                suppliers = data.data;
                renderSupplierTable(suppliers);
                updateSupplierStats();
            }
        } catch(e) { console.error('Error fetching suppliers', e); renderSupplierTable([]); }
    }

    window.openSupplierModal = function() {
        const modal = document.getElementById('supplier-modal');
        const form = document.getElementById('supplier-form');
        if(!modal || !form) return;

        modal.classList.add('show');
        form.reset();
        document.getElementById('sup-id').value = '';
    }

    window.closeModal = window.closeSupplierModal = function() { 
        const modal = document.getElementById('supplier-modal');
        if(modal) modal.classList.remove('show'); 
    }

    window.deleteSupplier = async function(id) {
        if(await window.Utils.showConfirm("Delete Supplier?")) {
            try {
                await window.apiFetch(`suppliers.php?id=${id}`, { method: 'DELETE' });
                showToast('Supplier deleted');
                loadSuppliers();
                if(window.updateGlobalNavStats) window.updateGlobalNavStats();
            } catch(e) {
                showToast(e.message, 'error');
            }
        }
    }

    // Render Supplier Table
    function renderSupplierTable(data = suppliers, isLoading = false) {
        const tableBody = document.getElementById('supplier-table-body');
        const paginationContainer = document.getElementById('suppliers-pagination');
        if(!tableBody) return;

        tableBody.innerHTML = "";
        
        if (isLoading) {
            if (paginationContainer) paginationContainer.innerHTML = '';
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;" class="text-dimmed">Loading suppliers...</td></tr>';
            return;
        }

        if(!data || data.length === 0) {
            if (paginationContainer) paginationContainer.innerHTML = '';
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;" class="text-dimmed">No suppliers found.</td></tr>';
            return;
        }

        const paginated = window.Utils.paginate(data, currentPage, itemsPerPage);
        currentPage = paginated.currentPage;

        paginated.items.forEach((s, idx) => {
            // Row Index
            const rowIndex = (currentPage - 1) * itemsPerPage + (idx + 1);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="text-xs text-dimmed">${rowIndex}</td>
                <td><strong>${s.name}</strong></td>
                <td>${s.type}</td>
                <td>${s.phone || '-'}</td>
                <td>${s.email || '-'}</td>
                <td>${s.address || '-'}</td>
                <td>
                    <div class="action-btns">
                        <button type="button" class="btn-action btn-view" onclick="viewSupplier(${s.id})" title="View Supplier"><i class="fa-regular fa-eye"></i></button>
                        <button type="button" class="btn-action btn-edit" onclick="editSupplier(${s.id})" title="Edit Supplier"><i class="fa-regular fa-pen-to-square"></i></button>
                        <button type="button" class="btn-action btn-print" onclick="printSupplier(${s.id})" title="Print Supplier"><i class="fa-solid fa-print"></i></button>
                        <button type="button" class="btn-action btn-delete" onclick="deleteSupplier(${s.id})" title="Delete Supplier"><i class="fa-regular fa-trash-can"></i></button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        window.Utils.renderPagination('suppliers-pagination', paginated, (newPage) => {
            currentPage = newPage;
            renderSupplierTable(suppliers);
        });
    }

    window.filterSuppliers = function(type, btn) {
        currentPage = 1;
        if(btn) {
            document.querySelectorAll('.filter-tabs button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }
        currentFilter = type;
        loadSuppliers();
    }

    let searchTimer;
    window.searchSuppliers = function() {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            currentPage = 1;
            loadSuppliers();
        }, 300);
    }

    window.exportSuppliers = function() {
        if (suppliers.length === 0) {
            alert('No supplier data to export!');
            return;
        }

        window.ExportUtils.toExcel({
            fileName: 'suppliers_export.xls',
            sheetName: 'Suppliers',
            headers: ['ID', 'Name', 'Type', 'Phone', 'Email', 'Address', 'Website'],
            rows: suppliers.map(supplier => [
                Number(supplier.id) || supplier.id || '',
                supplier.name || '',
                supplier.type || '',
                supplier.phone || '',
                supplier.email || '',
                supplier.address || '',
                supplier.website || ''
            ])
        });
    };

    // Update Supplier Stats
    async function updateSupplierStats() {
        try {
            const data = await window.apiFetch('suppliers.php?action=stats');
            if(data && data.success) {
                const s = data.data;
                const totalEl = document.getElementById('nav-total-suppliers');
                const mfgEl = document.getElementById('nav-manufacturers');
                const wholeEl = document.getElementById('nav-wholesalers');
                const distEl = document.getElementById('nav-distributors');

                if(totalEl) window.animateStat('nav-total-suppliers', s.total);
                if(mfgEl) window.animateStat('nav-manufacturers', s.manufacturers);
                if(wholeEl) window.animateStat('nav-wholesalers', s.wholesalers);
                if(distEl) window.animateStat('nav-distributors', s.distributors);
            }
        } catch(e) {}
    }

    window.viewSupplier = function(id) {
        const supplier = suppliers.find(s => s.id == id);
        if(!supplier) return;
        
        const content = `
            <div style="color: #1e293b; max-width: 440px; margin: 0 auto; padding: 0 5px;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px; padding-bottom: 15px; border-bottom: 1px solid #f1f5f9;">
                    <div style="width: 48px; height: 48px; border-radius: 12px; background: #f0f9ff; color: #0369a1; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                        <i class="fa-solid fa-building-user"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 2px;">Supplier Profile</div>
                        <div style="font-size: 1.1rem; font-weight: 800; color: #0f172a;">#${supplier.id}</div>
                    </div>
                    <div style="margin-left: auto;">
                        <span style="display:inline-block; padding:4px 12px; border-radius:8px; font-size:0.75rem; font-weight:700; background:#eff6ff; color:#1d4ed8; border:1px solid #dbeafe;">${supplier.type}</span>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 18px;">
                    <div style="display: flex; gap: 14px; align-items: flex-start;">
                        <div style="width: 20px; display: flex; justify-content: center; margin-top: 3px;">
                            <i class="fa-solid fa-briefcase" style="color: #94a3b8; font-size: 1rem;"></i>
                        </div>
                        <div>
                            <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 2px; letter-spacing: 0.3px;">Company Name</div>
                            <div style="font-size: 1rem; font-weight: 700; color: #1e293b;">${supplier.name}</div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div style="display: flex; gap: 14px; align-items: flex-start;">
                            <div style="width: 20px; display: flex; justify-content: center; margin-top: 3px;">
                                <i class="fa-solid fa-phone" style="color: #94a3b8; font-size: 0.95rem;"></i>
                            </div>
                            <div>
                                <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 2px; letter-spacing: 0.3px;">Phone</div>
                                <div style="font-size: 0.9rem; color: #475569; font-weight: 600;">${supplier.phone || 'N/A'}</div>
                            </div>
                        </div>
                        <div style="display: flex; gap: 14px; align-items: flex-start;">
                            <div style="width: 20px; display: flex; justify-content: center; margin-top: 3px;">
                                <i class="fa-solid fa-envelope" style="color: #94a3b8; font-size: 0.95rem;"></i>
                            </div>
                            <div>
                                <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 2px; letter-spacing: 0.3px;">Email</div>
                                <div style="font-size: 0.9rem; color: #475569; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px; font-weight: 600;" title="${supplier.email}">${supplier.email || 'N/A'}</div>
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 14px; align-items: flex-start;">
                        <div style="width: 20px; display: flex; justify-content: center; margin-top: 3px;">
                            <i class="fa-solid fa-map-location-dot" style="color: #94a3b8; font-size: 1rem;"></i>
                        </div>
                        <div>
                            <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 2px; letter-spacing: 0.3px;">Physical Address</div>
                            <div style="font-size: 0.9rem; color: #475569; line-height: 1.4; font-weight: 500;">${supplier.address || 'N/A'}</div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 14px; align-items: flex-start;">
                        <div style="width: 20px; display: flex; justify-content: center; margin-top: 3px;">
                            <i class="fa-solid fa-globe" style="color: #94a3b8; font-size: 1rem;"></i>
                        </div>
                        <div>
                            <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 2px; letter-spacing: 0.3px;">Website</div>
                            <div style="font-size: 0.9rem; color: #3b82f6; font-weight: 600;">${supplier.website || 'N/A'}</div>
                        </div>
                    </div>
                </div>
            </div>`;

        window.showCenteredModal({
            title: `Supplier Profile`,
            content: content,
            primaryText: 'Print',
            primaryAction: function() { window.printSupplier(id); },
            secondaryText: 'Close',
            secondaryAction: window.closeCenteredModal,
            width: '480px'
        });
    };

    window.editSupplier = function(id) {
        const supplier = suppliers.find(s => s.id == id);
        if(!supplier) return;
        
        const modal = document.getElementById('supplier-modal');
        const form = document.getElementById('supplier-form');
        if(!modal || !form) return;
        
        // Set modal title
        const title = modal.querySelector('.modal-header h3');
        if(title) title.innerText = "Edit Supplier";
        
        // Populate form
        document.getElementById('sup-id').value = supplier.id;
        document.getElementById('sup-name').value = supplier.name;
        document.getElementById('sup-type').value = supplier.type;
        document.getElementById('sup-phone').value = supplier.phone || '';
        document.getElementById('sup-email').value = supplier.email || '';
        document.getElementById('sup-address').value = supplier.address || '';
        document.getElementById('sup-website').value = supplier.website || '';
        
        // Open modal
        modal.classList.add('show');
    }

    window.printSupplier = function(id) {
        const supplier = suppliers.find(s => s.id == id);
        if(!supplier) return;

        const content = `
            <table style="width:100%; border-collapse:collapse;">
                ${['Supplier ID', 'Name', 'Type', 'Phone', 'Email', 'Address', 'Website'].map((label, idx) => {
                    const keys = ['id', 'name', 'type', 'phone', 'email', 'address', 'website'];
                    const value = supplier[keys[idx]] || 'N/A';
                    return `
                        <tr>
                            <td style="padding: 14px 8px; color: #64748b; width: 35%; border-bottom: 1px solid #f1f5f9;">${label}</td>
                            <td style="padding: 14px 8px; font-weight: 700; text-align: right; color: #1e293b; border-bottom: 1px solid #f1f5f9;">
                                ${label === 'Supplier ID' ? '#' + value : value}
                            </td>
                        </tr>`;
                }).join('')}
            </table>
        `;

        window.openPrintPreviewModal({
            reportTitle: `Supplier Profile - #${supplier.id}`,
            headline: 'Supplier Details',
            subHeadline: `${supplier.name} (${supplier.type})`,
            contentHtml: content,
            width: '850px'
        });
    }

    window.closeViewSupplierModal = function() {
        const viewModal = document.getElementById('view-supplier-modal');
        if(viewModal) viewModal.classList.remove('show');
    }

    // Add event listeners for view modal
    document.addEventListener('DOMContentLoaded', function() {
        const closeViewBtn = document.querySelector('.close-view-btn');
        if(closeViewBtn) closeViewBtn.addEventListener('click', window.closeViewSupplierModal);
        window.addEventListener('click', (e) => {
            const viewModal = document.getElementById('view-supplier-modal');
            if(viewModal && e.target == viewModal) window.closeViewSupplierModal();
        });
    });

    document.addEventListener('DOMContentLoaded', function() {
        const addSupBtn = document.getElementById('add-supplier-btn');
        if(addSupBtn) {
            addSupBtn.addEventListener('click', () => {
                openSupplierModal();
            });
        }

        const internalSearchInput = document.getElementById('supplier-search');
        if (internalSearchInput) {
            internalSearchInput.addEventListener('input', window.searchSuppliers);
        }

        const form = document.getElementById('supplier-form');
        if(form) {
            form.addEventListener('submit', async function(e) {
                e.preventDefault();
                const id = document.getElementById('sup-id').value;

                const phoneVal = document.getElementById('sup-phone').value;
                const emailVal = document.getElementById('sup-email').value;
                if (phoneVal && !Utils.validatePhone(phoneVal)) {
                    showToast('Please enter a valid phone number', 'error');
                    return;
                }
                if (emailVal && !Utils.validateEmail(emailVal)) {
                    showToast('Please enter a valid email address', 'error');
                    return;
                }

                const data = {
                    name: document.getElementById('sup-name').value,
                    type: document.getElementById('sup-type').value,
                    phone: phoneVal,
                    email: emailVal,
                    address: document.getElementById('sup-address').value,
                    website: document.getElementById('sup-website').value
                };
                if (id) {
                    data.id = id;
                }

                try {
                    await window.apiFetch(`suppliers.php`, { method: 'POST', body: data });
                    const isEdit = id ? true : false;
                    showToast(isEdit ? 'Supplier updated successfully' : 'Supplier added successfully');
                    closeModal();
                    loadSuppliers();
                    if(window.updateGlobalNavStats) window.updateGlobalNavStats();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });
        }

        loadSuppliers();
    });
})();
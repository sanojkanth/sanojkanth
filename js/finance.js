document.addEventListener('DOMContentLoaded', function() {
    let payments = [];
    let expenses = [];
    let currentTab = 'income'; 
    let currentIncomePage = 1;
    let currentExpensePage = 1;
    let approvalThreshold = window.Utils?.getExpenseApprovalThreshold?.() || 50000;
    let canReviewExpenses = false;
    let currentUserName = 'User';
    const itemsPerPage = 6;

    // Format Approval Threshold
    function formatApprovalThreshold() {
        return `LKR ${Number(approvalThreshold || 0).toLocaleString('en-LK', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    // Get Expense Status Badge
    function getExpenseStatusBadge(status) {
        // Normalized
        const normalized = ((status || '').trim() || 'Pending').toLowerCase();
        // Label
        const label = (status || 'Pending').trim() || 'Pending';
        return `<span class="expense-status-badge status-${normalized}">${label}</span>`;
    }

    // Update Pending Approval Bar
    function updatePendingApprovalBar(expenseList = []) {
        const bar = document.getElementById('pending-approval-bar');
        const countEl = document.getElementById('pending-approval-count');
        if (!bar || !countEl) return;

        const pendingCount = expenseList.filter(exp => (exp.approval_status || '').trim().toLowerCase() === 'pending').length;
        countEl.textContent = pendingCount;
        if (pendingCount > 0) {
            bar.style.display = 'flex';
        } else {
            bar.style.display = 'none';
        }
    }

    // Scroll To Pending Expenses
    function scrollToPendingExpenses() {
        const table = document.getElementById('expense-table');
        if (table) {
            table.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        switchTab('expenses');
    }

    // Update Expense Approval Hint
    function updateExpenseApprovalHint(amountOverride) {
        const hint = document.getElementById('expense-approval-hint');
        const thresholdLabel = document.getElementById('expense-threshold-label');
        const amountInput = document.getElementById('exp-amount');
        if (!hint || !thresholdLabel) return;

        const amount = Number(amountOverride ?? amountInput?.value ?? 0);
        thresholdLabel.textContent = formatApprovalThreshold();
        hint.classList.remove('is-pending', 'is-approved');

        if (amount >= approvalThreshold && !canReviewExpenses) {
            hint.classList.add('is-pending');
            hint.innerHTML = `<i class="fa-solid fa-shield-halved"></i> This high-value expense exceeds <strong>${formatApprovalThreshold()}</strong> and will be submitted for admin approval.`;
            return;
        }

        hint.classList.add('is-approved');
        if (amount >= approvalThreshold && canReviewExpenses) {
            hint.innerHTML = `<i class="fa-solid fa-shield-halved"></i> This expense exceeds <strong>${formatApprovalThreshold()}</strong>, but your admin approval will be applied when you save it.`;
        } else {
            hint.innerHTML = `<i class="fa-solid fa-shield-halved"></i> Expenses above <strong>${formatApprovalThreshold()}</strong> require admin approval.`;
        }
    }

    // Get Expense Actions
    function getExpenseActions(expense) {
        const buttons = [];

        if (canReviewExpenses && expense.approval_status === 'Pending') {
            buttons.push(`<button class="btn-action btn-approve" onclick="reviewExpenseApproval(${expense.id}, 'Approved')" title="Approve Expense"><i class="fa-solid fa-check"></i></button>`);
            buttons.push(`<button class="btn-action btn-reject" onclick="reviewExpenseApproval(${expense.id}, 'Rejected')" title="Reject Expense"><i class="fa-solid fa-xmark"></i></button>`);
        } else {
            buttons.push(`<button class="btn-action btn-view" onclick="viewExpense(${expense.id})" title="View Expense"><i class="fa-regular fa-eye"></i></button>`);
            buttons.push(`<button class="btn-action btn-edit" onclick="editExpense(${expense.id})" title="Edit Expense"><i class="fa-regular fa-pen-to-square"></i></button>`);
            buttons.push(`<button class="btn-action btn-print" onclick="printExpense(${expense.id})" title="Print Expense"><i class="fa-solid fa-print"></i></button>`);
            buttons.push(`<button class="btn-action btn-delete" onclick="deleteExpense(${expense.id})" title="Delete Expense"><i class="fa-regular fa-trash-can"></i></button>`);
        }
        return buttons.join('');
    }

    // Load Finance Data
    async function loadFinanceData() {
        const globalSearchInput = document.getElementById('global-header-search');
        const internalSearchInput = document.getElementById('finance-search');
        // Query
        const query = (internalSearchInput?.value || globalSearchInput?.value || "").trim();
        
        let url = 'finance.php';
        if (query) url += `?search=${encodeURIComponent(query)}`;

        try {
            const data = await window.apiFetch(url);
            if (data && data.success) {
                payments = data.data.income || [];
                expenses = data.data.expenses || [];
                approvalThreshold = Number(data.data.meta?.approvalThreshold || approvalThreshold || 50000);
                canReviewExpenses = !!data.data.meta?.canReviewExpenses;
                currentUserName = data.data.meta?.currentUserName || currentUserName;
                
                // Show salary tab only for admins
                const isAdmin = (data.data.meta?.currentUserRole || '').toLowerCase() === 'admin';
                const salaryTabBtn = document.getElementById('salary-tab-btn');
                if (salaryTabBtn) {
                    salaryTabBtn.style.display = isAdmin ? 'inline-block' : 'none';
                }

                updateExpenseApprovalHint();
                renderTables(payments, expenses);
                updatePendingApprovalBar(expenses);
                updateFinanceStats();
                loadRecentOrders();
            }
        } catch (e) {
            console.error('Error loading finance data', e);
            if (incomeBody) incomeBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;" class="text-danger">Unable to load income data.</td></tr>';
            if (expenseBody) expenseBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;" class="text-danger">Unable to load expense data.</td></tr>';
        }
    }

    // Load Recent Orders
    async function loadRecentOrders() {
        const list = document.getElementById('finance-recent-orders-list');
        if (!list) return;

        try {
            const res = await window.apiFetch('orders.php');
            if (res && res.success) {
                const orders = res.data || [];
                const sorted = [...orders].sort((a, b) => (parseInt(b.id) || 0) - (parseInt(a.id) || 0));
                const recent = sorted.slice(0, 5);

                if (recent.length === 0) {
                    list.innerHTML = '<tr><td colspan="3" class="text-center text-muted" style="padding: 20px;">No recent orders.</td></tr>';
                    return;
                }

                list.innerHTML = recent.map(o => {
                    let statusClass = 'pending';
                    let statusText = o.status || 'Pending';

                    if (statusText === 'Completed') {
                        statusText = 'DONE';
                        statusClass = 'complete';
                    } else if (statusText === 'Pending' || statusText === 'Shipping') {
                        statusText = 'WAIT';
                        statusClass = 'pending';
                    } else if (statusText === 'Cancelled') {
                        statusText = 'VOID';
                        statusClass = 'cancelled';
                    }

                    return `
                    <tr class="animate-reveal">
                        <td style="font-weight: 700; width: 60px;">#${o.id}</td>
                        <td class="text-center">
                            <div style="display: flex; align-items: center; justify-content: center;">
                                <div class="status-pill status-${statusClass}" style="
                                    background: rgba(128,128,128,0.05); 
                                    border: 1px solid rgba(128,128,128,0.1);
                                    padding: 4px 12px;
                                    border-radius: 20px;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                ">
                                    <span style="font-weight: 700; font-size: 0.72rem; letter-spacing: 0.03em;">${statusText}</span>
                                </div>
                            </div>
                        </td>
                        <td class="text-right" style="font-weight: 700; font-size: 1.05rem;">LKR ${parseFloat(o.total || 0).toLocaleString()}</td>
                    </tr>
                    `;
                }).join('');
            }
        } catch (e) {
            console.error('Failed to load recent orders on finance page', e);
        }
    }

    // Update Finance Stats
    async function updateFinanceStats() {
        try {
            const data = await window.apiFetch('finance.php?action=stats');
            if (data && data.success) {
                const s = data.data;

                // Point to the correct IDs used in the finance nav bar
                const incEl = document.getElementById('nav-fin-revenue');
                const expEl = document.getElementById('nav-fin-expenses');
                const taxEl = document.getElementById('nav-fin-tax');
                const profitEl = document.getElementById('nav-fin-profit');

                if (incEl) window.animateStat('nav-fin-revenue', parseFloat(s.totalRevenue || 0));
                if (expEl) window.animateStat('nav-fin-expenses', parseFloat(s.totalExpenses || 0));
                if (taxEl) window.animateStat('nav-fin-tax', parseFloat(s.totalTax || 0));
                if (profitEl) {
                    const prof = parseFloat(s.netProfit || 0);
                    window.animateStat('nav-fin-profit', prof);
                    profitEl.style.color = prof >= 0 ? '#fcb800' : '#ef4444'; // Using theme colors
                }
            }
        } catch(e) { console.error('Error updating finance stats', e); }
    }

    const incomeBody = document.getElementById('income-table-body');
    const expenseBody = document.getElementById('expense-table-body');
    const incomePagination = document.getElementById('income-pagination');
    const expensePagination = document.getElementById('expense-pagination');
    const paymentModal = document.getElementById('payment-modal');
    const expenseModal = document.getElementById('expense-modal');
    const payForm = document.getElementById('payment-form');
    const expForm = document.getElementById('expense-form');
    const expenseAmountInput = document.getElementById('exp-amount');

    if (expenseAmountInput) {
        expenseAmountInput.addEventListener('input', function() {
            updateExpenseApprovalHint(this.value);
        });
    }

    const expCategory = document.getElementById('exp-category');
    const expStaffGroup = document.getElementById('exp-staff-group');
    const expStaffId = document.getElementById('exp-staff-id');

    if (expCategory) {
        expCategory.addEventListener('change', async function() {
            const isStaffSalary = this.value === 'StaffSalary';
            if (expStaffGroup) expStaffGroup.style.display = isStaffSalary ? 'block' : 'none';
            
            if (isStaffSalary) {
                await populateStaffDropdown();
            }

            // Existing toggle logic for COGS quantity
            const qtyGroup = document.getElementById('exp-quantity-group');
            if (qtyGroup) qtyGroup.style.display = this.value === 'COGS' ? 'block' : 'none';
        });
    }

    // Populate Staff Dropdown
    async function populateStaffDropdown(selectedId = null) {
        if (!expStaffId) return;
        try {
            const res = await window.apiFetch('services.php?type=staff');
            if (res.success) {
                const staffList = res.data || [];
                let html = '<option value="">-- Choose Staff --</option>';
                staffList.forEach(s => {
                    const sel = selectedId && s.id == selectedId ? 'selected' : '';
                    html += `<option value="${s.id}" ${sel}>${s.name} (${s.role})</option>`;
                });
                expStaffId.innerHTML = html;
            }
        } catch(e) { console.error("Staff fetch error", e); }
    }

    // Render Tables
    function renderTables(pData = payments, eData = expenses) {
        if(incomeBody) {
            incomeBody.innerHTML = "";
            if (!pData.length) {
                if (incomePagination) incomePagination.innerHTML = '';
                incomeBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;" class="text-dimmed">No income records found.</td></tr>';
            } else {
                const incomePage = window.Utils.paginate(pData, currentIncomePage, itemsPerPage);
                currentIncomePage = incomePage.currentPage;

                incomePage.items.forEach((p, idx) => {
                    // Row Index
                    const rowIndex = (currentIncomePage - 1) * itemsPerPage + (idx + 1);
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${rowIndex}</td>
                        <td>${p.income_date || p.date}</td>
                        <td>${p.type}</td>
                        <td>${p.method}</td>
                        <td class="income-text">+${Utils.formatCurrency(p.amount)}</td>
                        <td class="text-center">
                            <div class="action-btns justify-center">
                                <button class="btn-action btn-view" onclick="viewPayment(${p.id})" title="View Invoice"><i class="fa-regular fa-eye"></i></button>
                                <button class="btn-action btn-edit" onclick="editPayment(${p.id})" title="Edit Invoice"><i class="fa-regular fa-pen-to-square"></i></button>
                                <button class="btn-action btn-print" onclick="printPayment(${p.id})" title="Print Invoice"><i class="fa-solid fa-print"></i></button>
                                <button class="btn-action btn-delete" onclick="deletePayment(${p.id})" title="Delete"><i class="fa-regular fa-trash-can"></i></button>
                            </div>
                        </td>
                    `;
                    incomeBody.appendChild(tr);
                });

                window.Utils.renderPagination('income-pagination', incomePage, (newPage) => {
                    currentIncomePage = newPage;
                    renderTables(payments, expenses);
                });
            }
        }

        if(expenseBody) {
            expenseBody.innerHTML = "";
            if (!eData.length) {
                if (expensePagination) expensePagination.innerHTML = '';
                expenseBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;" class="text-dimmed">No expense records found.</td></tr>';
            } else {
                const expensePage = window.Utils.paginate(eData, currentExpensePage, itemsPerPage);
                currentExpensePage = expensePage.currentPage;

                expensePage.items.forEach((e, idx) => {
                    // Row Index
                    const rowIndex = (currentExpensePage - 1) * itemsPerPage + (idx + 1);
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${rowIndex}</td>
                        <td>${e.expense_date || e.date}</td>
                        <td>${e.category}</td>
                        <td>${e.description || e.desc}</td>
                        <td class="expense-text">-${Utils.formatCurrency(e.amount)}</td>
                        <td>${getExpenseStatusBadge(e.approval_status)}</td>
                        <td class="text-center">
                            <div class="action-btns justify-center">
                                ${getExpenseActions(e)}
                            </div>
                        </td>
                    `;
                    expenseBody.appendChild(tr);
                });

                window.Utils.renderPagination('expense-pagination', expensePage, (newPage) => {
                    currentExpensePage = newPage;
                    renderTables(payments, expenses);
                });
            }
        }
    }

    let searchTimer;
    window.searchFinance = function() {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            currentIncomePage = 1;
            currentExpensePage = 1;
            loadFinanceData();
        }, 300);
    };

    const financeSearch = document.getElementById('finance-search');
    if(financeSearch) {
        financeSearch.addEventListener('input', window.searchFinance);
    }

    window.switchTab = function(tab) {
        currentTab = tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        if(tab === 'income') {
            const btn = document.querySelector("button[onclick=\"switchTab('income')\"]");
            if(btn) btn.classList.add('active');
            const content = document.getElementById('tab-income');
            if(content) content.classList.add('active');
        } else if(tab === 'expenses') {
            const btn = document.querySelector("button[onclick=\"switchTab('expenses')\"]");
            if(btn) btn.classList.add('active');
            const content = document.getElementById('tab-expenses');
            if(content) content.classList.add('active');
        } else if(tab === 'salary') {
            const btn = document.querySelector("button[onclick=\"switchTab('salary')\"]");
            if(btn) btn.classList.add('active');
            const content = document.getElementById('tab-salary');
            if(content) content.classList.add('active');
            loadSalaryData();
        }
    }

    window.openPaymentModal = function() {
        if(!paymentModal) return;
        paymentModal.classList.add('show');
        if(payForm) payForm.reset();
        document.getElementById('pay-id').value = '';
        document.getElementById('pay-date').value = new Date().toISOString().split('T')[0];
        const title = paymentModal.querySelector('.modal-header h3');
        if(title) title.innerText = 'Add Payment Record';
    }

    window.viewPayment = function(id) {
        const payment = payments.find(p => p.id == id);
        if (!payment) return;
        
        const content = `
            <div style="color: #1e293b; max-width: 440px; margin: 0 auto;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #f1f5f9;">
                    <div style="width: 48px; height: 48px; border-radius: 12px; background: #ecfdf5; color: #059669; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                        <i class="fa-solid fa-arrow-trend-up"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Income Record</div>
                        <div style="font-size: 1.1rem; font-weight: 800; color: #0f172a;">#${payment.id}</div>
                    </div>
                    <div style="margin-left: auto;">
                        <span style="display:inline-block; padding:4px 12px; border-radius:8px; font-size:0.75rem; font-weight:700; background:#f0fdf4; color:#16a34a; border:1px solid #dcfce7;">Income</span>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px;">
                    <div style="display: flex; gap: 12px; align-items: flex-start;">
                        <i class="fa-solid fa-file-invoice-dollar" style="color: #94a3b8; width: 16px; margin-top: 4px;"></i>
                        <div>
                            <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 2px;">Voucher Description</div>
                            <div style="font-size: 0.95rem; font-weight: 700; color: #1e293b;">${payment.type}</div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div style="display: flex; gap: 12px; align-items: flex-start;">
                            <i class="fa-solid fa-credit-card" style="color: #94a3b8; width: 16px; margin-top: 4px;"></i>
                            <div>
                                <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 2px;">Method</div>
                                <div style="font-size: 0.9rem; color: #475569;">${payment.method}</div>
                            </div>
                        </div>
                        <div style="display: flex; gap: 12px; align-items: flex-start;">
                            <i class="fa-solid fa-calendar-day" style="color: #94a3b8; width: 16px; margin-top: 4px;"></i>
                            <div>
                                <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 2px;">Date</div>
                                <div style="font-size: 0.9rem; color: #475569;">${payment.income_date || payment.date}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="background: #ecfdf5; border-radius: 12px; padding: 15px; border: 1px solid #d1fae5; text-align: center;">
                    <div style="font-size: 0.75rem; color: #059669; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 5px;">Transaction Amount</div>
                    <div style="font-weight: 900; color: #047857; font-size: 1.6rem;">${Utils.formatCurrency(payment.amount)}</div>
                </div>
            </div>`;

        window.showCenteredModal({
            title: `Income Record`,
            content: content,
            primaryText: 'Print',
            primaryAction: function() { window.printPayment(id); },
            secondaryText: 'Close',
            secondaryAction: window.closeCenteredModal,
            width: '480px'
        });
    }

    window.editPayment = function(id) {
        const payment = payments.find(p => p.id == id);
        if (!payment) return;
        window.openPaymentModal();
        document.getElementById('pay-id').value = payment.id;
        document.getElementById('pay-date').value = payment.income_date || payment.date || new Date().toISOString().split('T')[0];
        document.getElementById('pay-type').value = payment.type || 'Product Sale';
        document.getElementById('pay-method').value = payment.method || 'Cash';
        document.getElementById('pay-quantity').value = payment.quantity || '';
        document.getElementById('pay-amount').value = payment.amount || 0;
        const title = paymentModal.querySelector('.modal-header h3');
        if(title) title.innerText = 'Edit Payment Record';
    }

    window.printPayment = function(id) {
        const payment = payments.find(p => p.id == id);
        if (!payment) return;

        const detailsTableHtml = `
            <table style="width:100%; border-collapse:collapse; margin-bottom: 30px;">
                ${[
                    { l: 'Payment ID', v: '#'+payment.id },
                    { l: 'Income Category', v: payment.type },
                    { l: 'Source/Method', v: payment.method },
                    { l: 'Quantity (if app.)', v: payment.quantity || 'N/A' },
                    { l: 'Transaction Date', v: payment.income_date || payment.date },
                    { l: 'Total Amount', v: Utils.formatCurrency(payment.amount), b: true }
                ].map(item => `
                    <tr>
                        <td style="padding: 14px 0; color: #64748b; width: 35%; border-bottom: 2px solid #f1f5f9; font-size: 0.95rem;">${item.l}</td>
                        <td style="padding: 14px 0; font-weight: ${item.b ? '800' : '700'}; text-align: right; color: ${item.b ? '#15803d' : '#0f172a'}; border-bottom: 2px solid #f1f5f9; font-size: ${item.b ? '1.1rem' : '0.95rem'};">${item.v}</td>
                    </tr>
                `).join('')}
            </table>
        `;

        window.openPrintPreviewModal({
            reportTitle: `Income Voucher - #${payment.id}`,
            headline: 'Payment Receipt',
            subHeadline: `Category: ${payment.type} | Method: ${payment.method}`,
            contentHtml: `
                <div style="padding: 0 5px;">
                    <h3 style="font-size: 0.85rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">Financial Entry</h3>
                    ${detailsTableHtml}
                    <div style="margin-top: 30px; border-top: 1px dotted #cbd5e1; padding-top: 15px; text-align: right;">
                        <span style="font-size: 0.85rem; color: #64748b; font-style: italic;">Verified by Central Hardwares Finance</span>
                    </div>
                </div>
            `,
            width: '850px'
        });
    }

    window.deletePayment = async function(id) {
        if(await window.Utils.showConfirm("Delete this payment record?")) {
            try {
                await window.apiFetch(`finance.php?type=income&id=${id}`, { method: 'DELETE' });
                showToast("Payment deleted");
                loadFinanceData();
                if(window.updateGlobalNavStats) window.updateGlobalNavStats();
            } catch(e) { showToast(e.message, 'error'); }
        }
    }

    if(payForm) {
        payForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const id = document.getElementById('pay-id').value;
            const quantityVal = document.getElementById('pay-quantity').value;
            const data = {
                id: id || null,
                date: document.getElementById('pay-date').value,
                type: document.getElementById('pay-type').value,
                method: document.getElementById('pay-method').value,
                quantity: quantityVal ? parseInt(quantityVal) : null,
                amount: document.getElementById('pay-amount').value
            };

            try {
                await window.apiFetch(`finance.php?type=income`, { method: 'POST', body: data });
                showToast(id ? 'Income record updated' : 'Income logged');
                closeModals();
                loadFinanceData();
                if(window.updateGlobalNavStats) window.updateGlobalNavStats();
            } catch(err) { showToast(err.message, 'error'); }
        });
    }

    window.openExpenseModal = function() {
        if(!expenseModal) return;
        expenseModal.classList.add('show');
        if(expForm) expForm.reset();
        if (expStaffGroup) expStaffGroup.style.display = 'none';
        const qtyGroup = document.getElementById('exp-quantity-group');
        if (qtyGroup) qtyGroup.style.display = 'none';
        document.getElementById('exp-id').value = '';
        document.getElementById('exp-date').value = new Date().toISOString().split('T')[0];
        const title = expenseModal.querySelector('.modal-header h3');
        if(title) title.innerText = 'Add Expense Record';
        updateExpenseApprovalHint(0);
    }

    window.viewExpense = function(id) {
        const expense = expenses.find(e => e.id == id);
        if (!expense) return;
        
        const content = `
            <div style="color: #1e293b; max-width: 440px; margin: 0 auto;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #f1f5f9;">
                    <div style="width: 48px; height: 48px; border-radius: 12px; background: #fef2f2; color: #dc2626; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                        <i class="fa-solid fa-arrow-trend-down"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Expense Record</div>
                        <div style="font-size: 1.1rem; font-weight: 800; color: #0f172a;">#${expense.id}</div>
                    </div>
                    <div style="margin-left: auto;">
                        <span style="display:inline-block; padding:4px 12px; border-radius:8px; font-size:0.75rem; font-weight:700; background:#fff1f2; color:#be123c; border:1px solid #fecdd3;">${expense.approval_status || 'Approved'}</span>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px;">
                    <div style="display: flex; gap: 12px; align-items: flex-start;">
                        <i class="fa-solid fa-tags" style="color: #94a3b8; width: 16px; margin-top: 4px;"></i>
                        <div>
                            <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 2px;">Category</div>
                            <div style="font-size: 0.95rem; font-weight: 700; color: #1e293b;">${expense.category}</div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 12px; align-items: flex-start; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #f1f5f9;">
                        <i class="fa-solid fa-align-left" style="color: #94a3b8; width: 16px; margin-top: 4px;"></i>
                        <div>
                            <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">Description</div>
                            <div style="font-size: 0.85rem; color: #475569; line-height: 1.5;">${expense.description || expense.desc || 'No description provided.'}</div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div style="display: flex; gap: 12px; align-items: flex-start;">
                            <i class="fa-solid fa-user-pen" style="color: #94a3b8; width: 16px; margin-top: 4px;"></i>
                            <div>
                                <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 2px;">Submitter</div>
                                <div style="font-size: 0.9rem; color: #475569;">${expense.submitted_by || 'System'}</div>
                            </div>
                        </div>
                        <div style="display: flex; gap: 12px; align-items: flex-start;">
                            <i class="fa-solid fa-calendar-day" style="color: #94a3b8; width: 16px; margin-top: 4px;"></i>
                            <div>
                                <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 2px;">Date</div>
                                <div style="font-size: 0.9rem; color: #475569;">${expense.expense_date || expense.date}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="background: #fff1f2; border-radius: 12px; padding: 15px; border: 1px solid #fecdd3; text-align: center;">
                    <div style="font-size: 0.75rem; color: #be123c; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 5px;">Expense Amount</div>
                    <div style="font-weight: 900; color: #9f1239; font-size: 1.6rem;">${Utils.formatCurrency(expense.amount)}</div>
                </div>
            </div>`;

        window.showCenteredModal({
            title: `Expense Details`,
            content: content,
            primaryText: 'Print',
            primaryAction: function() { window.printExpense(id); },
            secondaryText: 'Close',
            secondaryAction: window.closeCenteredModal,
            width: '480px'
        });
    }

    window.editExpense = function(id) {
        const expense = expenses.find(e => e.id == id);
        if (!expense) return;
        window.openExpenseModal();
        document.getElementById('exp-id').value = expense.id;
        document.getElementById('exp-date').value = expense.expense_date || expense.date || new Date().toISOString().split('T')[0];
        document.getElementById('exp-category').value = expense.category || 'COGS';
        document.getElementById('exp-quantity').value = expense.quantity || '';
        document.getElementById('exp-desc').value = expense.description || expense.desc || '';
        document.getElementById('exp-amount').value = expense.amount || 0;
        
        const isStaffSalary = expense.category === 'StaffSalary';
        if (expStaffGroup) expStaffGroup.style.display = isStaffSalary ? 'block' : 'none';
        if (isStaffSalary) populateStaffDropdown(expense.staff_id);

        const title = expenseModal.querySelector('.modal-header h3');
        if(title) title.innerText = 'Edit Expense Record';
        updateExpenseApprovalHint(expense.amount || 0);
    }

    window.printExpense = function(id) {
        const expense = expenses.find(e => e.id == id);
        if (!expense) return;

        const detailsTableHtml = `
            <table style="width:100%; border-collapse:collapse; margin-bottom: 30px;">
                ${[
                    { l: 'Expense ID', v: '#'+expense.id },
                    { l: 'Category', v: expense.category },
                    { l: 'Status', v: expense.approval_status || 'Approved' },
                    { l: 'Submitted By', v: expense.submitted_by || 'System' },
                    { l: 'Transaction Date', v: expense.expense_date || expense.date },
                    { l: 'Total Amount', v: Utils.formatCurrency(expense.amount), b: true }
                ].map(item => `
                    <tr>
                        <td style="padding: 14px 0; color: #64748b; width: 35%; border-bottom: 2px solid #f1f5f9; font-size: 0.95rem;">${item.l}</td>
                        <td style="padding: 14px 0; font-weight: ${item.b ? '800' : '700'}; text-align: right; color: ${item.b ? '#b91c1c' : '#0f172a'}; border-bottom: 2px solid #f1f5f9; font-size: ${item.b ? '1.1rem' : '0.95rem'};">${item.v}</td>
                    </tr>
                `).join('')}
            </table>
        `;

        window.openPrintPreviewModal({
            reportTitle: `Expense Voucher - #${expense.id}`,
            headline: 'Expense Receipt',
            subHeadline: `Category: ${expense.category} | Managed By: ${expense.submitted_by || 'System'}`,
            contentHtml: `
                <div style="padding: 0 5px;">
                    <h3 style="font-size: 0.85rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">Financial Entry</h3>
                    ${detailsTableHtml}
                    <div style="margin-top: 20px; padding: 20px; background: #fafafa; border-radius: 12px; border: 1px solid #f1f5f9;">
                        <h4 style="margin: 0 0 10px 0; font-size: 0.8rem; color: #64748b; text-transform: uppercase;">Expense Description</h4>
                        <p style="margin: 0; color: #475569; font-size: 0.95rem; line-height: 1.6;">${expense.description || expense.desc || 'No additional details provided.'}</p>
                    </div>
                </div>
            `,
            width: '850px'
        });
    }

    window.deleteExpense = async function(id) {
         if(await window.Utils.showConfirm("Delete this expense record?")) {
            try {
                await window.apiFetch(`finance.php?type=expense&id=${id}`, { method: 'DELETE' });
                showToast("Expense deleted");
                loadFinanceData();
                if (window.checkSystemAlerts) window.checkSystemAlerts();
                if(window.updateGlobalNavStats) window.updateGlobalNavStats();
            } catch(e) { showToast(e.message, 'error'); }
        }
    }

    window.reviewExpenseApproval = async function(id, status) {
        const expense = expenses.find(e => e.id == id);
        if (!expense) return;

        let note = '';
        if (status === 'Rejected') {
            note = window.prompt('Reason for rejection (optional):', '') || '';
        }

        const confirmed = await window.Utils.showConfirm({
            title: `${status} Expense?`,
            message: `Apply ${status.toLowerCase()} status to expense #${expense.id}?`,
            okText: status === 'Approved' ? 'Approve' : 'Reject',
            cancelText: 'Cancel',
            type: status === 'Approved' ? 'info' : 'warning'
        });
        if (!confirmed) return;

        try {
            const res = await window.apiFetch(`finance.php?type=expense&action=review&id=${id}`, {
                method: 'POST',
                body: { status, note }
            });
            showToast(res.message || `Expense ${status.toLowerCase()}.`, 'success');
            loadFinanceData();
            if (window.checkSystemAlerts) window.checkSystemAlerts();
            if(window.updateGlobalNavStats) window.updateGlobalNavStats();
        } catch (err) {
            showToast(err.message || 'Unable to review expense.', 'error');
        }
    }

    if(expForm) {
        expForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const id = document.getElementById('exp-id').value;
            const quantityVal = document.getElementById('exp-quantity').value;
            const data = {
                id: id || null,
                date: document.getElementById('exp-date').value,
                category: document.getElementById('exp-category').value,
                quantity: quantityVal ? parseInt(quantityVal) : null,
                description: document.getElementById('exp-desc').value,
                amount: document.getElementById('exp-amount').value,
                staff_id: document.getElementById('exp-staff-id')?.value || null,
                submittedBy: currentUserName
            };

            try {
                const res = await window.apiFetch(`finance.php?type=expense`, { method: 'POST', body: data });
                showToast(res.message || (id ? 'Expense record updated' : 'Expense logged'));
                closeModals();
                loadFinanceData();
                if (window.checkSystemAlerts) window.checkSystemAlerts();
                if(window.updateGlobalNavStats) window.updateGlobalNavStats();
            } catch(err) { showToast(err.message, 'error'); }
        });
    }

    window.closeModals = function() {
        if(paymentModal) paymentModal.classList.remove('show');
        if(expenseModal) expenseModal.classList.remove('show');
    }

    window.addEventListener('click', (e) => {
        if(e.target == paymentModal || e.target == expenseModal) closeModals();
    });
    // ── SALARY FUNCTIONS ───────────────────────────────────────────────
    let salaryData = { staffs: [], meta: {} };

    // Load Salary Data
    async function loadSalaryData() {
        try {
            const res = await window.apiFetch('salary.php?action=list');
            if (res && res.success) {
                salaryData = res.data;
                renderSalaryTable(salaryData.staffs);
                updateSalarySummary(salaryData.meta);
            } else {
                showToast(res?.error || 'Failed to load salary data', 'error');
            }
        } catch(e) {
            console.error('Error loading salary data', e);
            showToast('Failed to load salary data', 'error');
        }
    }

    // Update Salary Summary
    function updateSalarySummary(meta = {}) {
        const totalEl = document.getElementById('total-salary-amount');
        const hoursEl = document.getElementById('total-hours-amount');
        const countEl = document.getElementById('total-staff-count');

        if(totalEl) totalEl.textContent = parseFloat(meta.total_salary || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if(hoursEl) hoursEl.textContent = parseFloat(meta.total_hours || 0).toFixed(1);
        if(countEl) countEl.textContent = meta.staff_count || 0;
    }

    // Render Salary Table
    function renderSalaryTable(staffList = []) {
        const tbody = document.getElementById('salary-table-body');
        if(!tbody) return;

        if (staffList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 20px;" class="text-dimmed">No staff records found.</td></tr>';
            return;
        }

        tbody.innerHTML = staffList.map(staff => {
            const totalHours = parseFloat(staff.total_hours || 0);
            const totalSalary = parseFloat(staff.total_salary || 0);
            const hourlyRate = parseFloat(staff.hourly_rate || 500);
            const workingDays = parseInt(staff.login_days || 0);

            return `
            <tr class="animate-reveal">
                <td>${staff.id}</td>
                <td><strong>${escapeHtml(staff.name)}</strong></td>
                <td>
                    <span class="badge" style="background: ${
                        staff.role === 'Technician' ? '#3b82f6' : 
                        staff.role === 'Driver' ? '#10b981' : 
                        staff.role === 'Helper' ? '#f59e0b' : 
                        '#8b5cf6'
                    }; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem;">
                        ${escapeHtml(staff.role)}
                    </span>
                </td>
                <td>LKR ${hourlyRate.toLocaleString()}/hr</td>
                <td><strong>${workingDays}</strong></td>
                <td>${totalHours.toFixed(1)} hrs</td>
                <td class="salary-amount"><strong>LKR ${totalSalary.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                <td>
                    <span class="badge" style="background: ${staff.status === 'Active' ? '#10b981' : '#f59e0b'}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem;">
                        ${escapeHtml(staff.status)}
                    </span>
                </td>
                <td class="text-center">
                    <div class="action-btns justify-center">
                        <button class="btn-action btn-view" onclick="viewSalaryDetail(${staff.id})" title="View Invoice">
                            <i class="fa-regular fa-eye"></i>
                        </button>
                        <button class="btn-action btn-edit" onclick="openEditRateModal(${staff.id})" title="Edit Invoice">
                            <i class="fa-regular fa-pen-to-square"></i>
                        </button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');
    }

    window.viewSalaryDetail = function(staffId) {
        const staff = salaryData.staffs.find(s => s.id === staffId);
        if (!staff) {
            showToast('Staff not found', 'error');
            return;
        }

        const modal = document.getElementById('salary-detail-modal');
        const content = document.getElementById('salary-detail-content');
        if (!modal || !content) return;

        const totalHours = parseFloat(staff.total_hours || 0);
        const hourlyRate = parseFloat(staff.hourly_rate || 500);
        const totalSalary = parseFloat(staff.total_salary || 0);
        const logs = staff.logs || [];

        let logsHtml = logs.length === 0 
            ? '<tr><td colspan="5" style="text-align:center; padding: 15px;">No work logs found</td></tr>'
            : logs.map(log => {
                let hours = 0;
                let mins = 0;
                
                // H Match
                const hMatch = (log.duration || '').match(/(\d+)h/);
                // M Match
                const mMatch = (log.duration || '').match(/(\d+)m/);
                
                if (hMatch) hours = parseInt(hMatch[1]);
                if (mMatch) mins = parseInt(mMatch[1]);
                
                const hoursDecimal = hours + (mins / 60);

                return `
                <tr>
                    <td>${log.log_date}</td>
                    <td>${log.login_time || '---'}</td>
                    <td>${log.logout_time || '---'}</td>
                    <td>${log.duration || '---'}</td>
                    <td>LKR ${(hoursDecimal * hourlyRate).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                `;
            }).join('');

        content.innerHTML = `
        <div class="salary-detail-grid">
            <div class="salary-info-card">
                <p>Staff Name</p>
                <h3>${escapeHtml(staff.name)}</h3>
            </div>
            <div class="salary-info-card accent-purple">
                <p>Role</p>
                <h3>${escapeHtml(staff.role)}</h3>
            </div>
            <div class="salary-info-card accent-indigo">
                <p>Hourly Rate</p>
                <h3>LKR ${hourlyRate.toLocaleString('en-LK')}/hr</h3>
            </div>
            <div class="salary-info-card accent-blue">
                <p>Total Hours Worked</p>
                <h3>${Number(staff.total_hours || 0).toFixed(1)} hours</h3>
            </div>
            <div class="salary-info-card accent-green">
                <p>Total Salary Due</p>
                <h3>LKR ${totalSalary.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            </div>
        </div>

        <h4 style="margin-bottom: 15px; color: var(--text-color);">Work Logs (Last 30 Days)</h4>
        <div class="table-container shadow-sm" style="max-height: 400px; overflow-y: auto;">
            <table id="salary-detail-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Login Time</th>
                        <th>Logout Time</th>
                        <th>Duration</th>
                        <th>Wage for Day</th>
                    </tr>
                </thead>
                <tbody>
                    ${logsHtml}
                </tbody>
            </table>
        </div>
        `;

        modal.classList.add('show');
    }

    window.closeSalaryDetailModal = function() {
        const modal = document.getElementById('salary-detail-modal');
        if (modal) modal.classList.remove('show');
    }

    // --- EDIT RATE MODAL FUNCTIONS ---
    window.openEditRateModal = function(staffId) {
        const staff = salaryData.staffs.find(s => s.id === staffId);
        if (!staff) return;

        const modal = document.getElementById('edit-rate-modal');
        if (!modal) return;

        document.getElementById('rate-staff-id').value = staff.id;
        document.getElementById('rate-staff-name').value = staff.name;
        document.getElementById('new-hourly-rate').value = staff.hourly_rate || 500;

        modal.classList.add('show');
    }

    window.closeEditRateModal = function() {
        const modal = document.getElementById('edit-rate-modal');
        if (modal) modal.classList.remove('show');
    }

    const editRateForm = document.getElementById('edit-rate-form');
    if (editRateForm) {
        editRateForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const staffId = document.getElementById('rate-staff-id').value;
            const newRate = document.getElementById('new-hourly-rate').value;

            try {
                const res = await window.apiFetch('salary.php?action=update-rates', {
                    method: 'POST',
                    body: {
                        updates: [
                            { staff_id: staffId, hourly_rate: newRate }
                        ]
                    }
                });

                if (res.success) {
                    showToast('Hourly rate updated successfully');
                    closeEditRateModal();
                    loadSalaryData();
                } else {
                    showToast(res.error || 'Failed to update rate', 'error');
                }
            } catch (err) {
                console.error('Error updating rate:', err);
                showToast('An error occurred while updating the rate', 'error');
            }
        });
    }

    // Escape Html
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return (text || '').replace(/[&<>"']/g, m => map[m]);
    }
    window.exportFinance = function() {
        if (payments.length === 0 && expenses.length === 0) { alert("No data to export!"); return; }

        const rows = [
            ...payments.map(i => [
                'Income',
                Number(i.id) || i.id || '',
                i.income_date || '',
                i.type || '',
                i.method || '',
                Number(i.amount) || 0
            ]),
            ...expenses.map(e => [
                'Expense',
                Number(e.id) || e.id || '',
                e.expense_date || '',
                e.category || '',
                `${e.description || ''} (${e.approval_status || 'Approved'})`,
                -(Number(e.amount) || 0)
            ])
        ];

        window.ExportUtils.toExcel({
            fileName: 'finance_report.xls',
            sheetName: 'Finance',
            headers: ['Type', 'ID', 'Date', 'Category/Type', 'Method/Desc', 'Amount'],
            rows
        });
    };

    loadFinanceData();
    switchTab('income'); 
});
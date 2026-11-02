document.addEventListener('DOMContentLoaded', function() {
    let services = [];
    let trackedServices = [];
    let warranties = [];
    let staffMembers = [];
    let currentFilter = 'all';
    let routeBoardRefreshHandle = null;
    let currentPerformanceView = 'dispatch';
    let currentServicesPage = 'records';
    let currentRouteLanePages = {
        en_route: 1,
        on_site: 1,
        delayed: 1,
        finished: 1
    };
    const routeLaneItemsPerPage = 1;
    let currentPerformancePage = 1;
    const performanceItemsPerPage = 5;
    let performanceRows = [];
    let currentServicesTablePage = 1;
    let currentWarrantiesPage = 1;
    const servicesItemsPerPage = 6;
    const warrantiesItemsPerPage = 6;

    const driverSelect = document.getElementById('del-driver');

    // Get Current Sql Date Time
    function getCurrentSqlDateTime() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    // Normalize Sql Date Time
    function normalizeSqlDateTime(value) {
        if (!value) return null;
        return value.toString().includes('T') ? value.toString().replace('T', ' ') : value;
    }

    // Format Eta For Input
    function formatEtaForInput(value) {
        if (!value) return '';
        return value.toString().replace('T', ' ').split(' ')[0];
    }

    // Build Service Payload
    function buildServicePayload(source = {}, overrides = {}) {
        const payload = {
            id: source.id || '',
            customer: source.customer || '',
            email: source.email || null,
            type: source.type || 'Repair',
            priority: source.priority || 'Medium',
            status: source.status || 'Requested',
            delivery: source.delivery || 'Pending',
            staff: source.staff || 'Unassigned',
            cost: source.cost || 0,
            phone: source.phone || null,
            address: source.address || null,
            eta: source.eta || null,
            assigned_at: source.assigned_at || null,
            en_route_at: source.en_route_at || null,
            on_site_at: source.on_site_at || null,
            completed_at: source.completed_at || null,
            notes: source.notes || null,
            rating: source.rating ?? null,
            date: source.date || source.service_date || new Date().toISOString().split('T')[0]
        };

        const merged = { ...payload, ...overrides };
        merged.cost = Number.isNaN(parseFloat(merged.cost)) ? 0 : parseFloat(merged.cost || 0);
        merged.eta = normalizeSqlDateTime(merged.eta);
        merged.assigned_at = normalizeSqlDateTime(merged.assigned_at);
        merged.en_route_at = normalizeSqlDateTime(merged.en_route_at);
        merged.on_site_at = normalizeSqlDateTime(merged.on_site_at);
        merged.completed_at = normalizeSqlDateTime(merged.completed_at);

        return merged;
    }

    // Find Service By Id
    function findServiceById(id) {
        return services.find(item => item.id === id) || trackedServices.find(item => item.id === id) || null;
    }

    // Fetch Staff
    async function fetchStaff() {
        try {
            const res = await window.apiFetch('services.php?type=staff');
            if(res && res.success) {
                staffMembers = res.data;
                renderStaff();
                populateDriverSelect();
            }
        } catch(e) { console.error(e); }
    }

    // Populate Driver Select
    function populateDriverSelect() {
        if (!driverSelect) return;
        driverSelect.innerHTML = '<option value="">Select Staff...</option>' + staffMembers.map(s => {
            return `<option value="${s.name}">${s.name} (${s.role})</option>`;
        }).join('');
    }

    // Find Staff By Name
    function findStaffByName(name) {
        return staffMembers.find(s => s.name === name) || null;
    }

    // Get Staff Phone
    function getStaffPhone(name) {
        const staff = findStaffByName(name);
        return staff && staff.phone ? staff.phone : null;
    }

    // Refresh Service Views
    async function refreshServiceViews() {
        await Promise.all([loadServices(), loadRouteBoard()]);
    }

    // Helper: Clean phone number for sms: link
    function cleanPhone(phone) {
        if (!phone) return '';
        return phone.replace(/[^0-9+]/g, '');
    }

    // Trigger SMS app using a hidden <a> tag click - most reliable for protocol handlers
    function triggerSms(phone, message) {
        var clean = cleanPhone(phone);
        if (!clean) return;
        
        // Copy message to clipboard as backup
        try {
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(message).catch(function(){});
            } else {
                var ta = document.createElement('textarea');
                ta.value = message;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
            }
        } catch(e) {}

        // Create hidden <a> and click it to trigger sms: protocol
        var link = document.createElement('a');
        link.href = 'sms:' + clean + '?body=' + encodeURIComponent(message);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(function() { if (link.parentNode) link.parentNode.removeChild(link); }, 100);
    }

    // Show a modal with two SMS buttons (customer + technician)
    // Buttons auto-trigger Phone Link via sms: protocol using hidden link injection
    function showSmsModal(customerPhone, customerMsg, techPhone, techMsg, customerName, techName) {
        var existing = document.getElementById('sms-send-modal');
        if (existing) existing.remove();

        var cleanCustPhone = cleanPhone(customerPhone);
        var cleanTechPhone = cleanPhone(techPhone);
        var hasCustomer = !!cleanCustPhone;

        // Store messages for button handlers
        window._smsCustPhone = cleanCustPhone;
        window._smsCustMsg = customerMsg;
        window._smsTechPhone = cleanTechPhone;
        window._smsTechMsg = techMsg;

        const contentHtml = `
            <div class="modal-header">
                <h3><i class="fa-solid fa-message" style="color:var(--primary-blue, #3b82f6);margin-right:8px;"></i>Send Assignment Messages</h3>
                <span class="close-btn" onclick="document.getElementById('sms-send-modal').remove()">&times;</span>
            </div>
            <div class="modal-body">
                ${hasCustomer ? `
                <div style="background:var(--sms-cust-bg, #f0f9ff); border:1px solid var(--sms-cust-border, #bae6fd); border-radius:12px; padding:16px; margin-bottom:14px;">
                    <div style="font-size:0.75rem;text-transform:uppercase;color:var(--sms-cust-label, #0284c7);font-weight:700;margin-bottom:8px;">Message to Customer - ${escapeHtml(customerName)}</div>
                    <p style="margin:0 0 12px;color:var(--sms-text-color, #334155);font-size:0.85rem;line-height:1.5;background:var(--sms-text-bg, #fff);padding:10px;border-radius:6px;border:1px solid var(--sms-cust-border, #e0e7ff);">${escapeHtml(customerMsg)}</p>
                    <button id="sms-btn-customer" onclick="window._copyMessageForSms('customer')" style="display:block;text-align:center;border:none;cursor:pointer;background:var(--sms-cust-btn, #0284c7);color:#fff;padding:12px 20px;border-radius:8px;font-weight:600;font-size:0.9rem;width:100%;transition:0.2s;">
                        <i class="fa-solid fa-paper-plane"></i> Send to Customer (${cleanCustPhone})
                    </button>
                </div>
                ` : `
                <div style="background:var(--sms-no-bg, #fef3c7); border:1px solid var(--sms-no-border, #fde68a); border-radius:12px; padding:14px; margin-bottom:14px; color:var(--sms-no-text, #92400e);">
                    <p style="margin:0;font-size:0.85rem;"><i class="fa-solid fa-triangle-exclamation"></i> Customer has no phone number.</p>
                </div>
                `}

                <div style="background:var(--sms-tech-bg, #f0fdf4); border:1px solid var(--sms-tech-border, #bbf7d0); border-radius:12px; padding:16px; margin-bottom:14px;">
                    <div style="font-size:0.75rem;text-transform:uppercase;color:var(--sms-tech-label, #16a34a);font-weight:700;margin-bottom:8px;">Message to Technician - ${escapeHtml(techName)}</div>
                    <p style="margin:0 0 12px;color:var(--sms-text-color, #334155);font-size:0.85rem;line-height:1.5;background:var(--sms-text-bg, #fff);padding:10px;border-radius:6px;border:1px solid var(--sms-tech-border, #dcfce7);">${escapeHtml(techMsg)}</p>
                    <button id="sms-btn-tech" onclick="window._copyMessageForSms('tech')" style="display:block;text-align:center;border:none;cursor:pointer;background:var(--sms-tech-btn, #16a34a);color:#fff;padding:12px 20px;border-radius:8px;font-weight:600;font-size:0.9rem;width:100%;transition:0.2s;">
                        <i class="fa-solid fa-paper-plane"></i> Send to Technician (${cleanTechPhone})
                    </button>
                </div>
            </div>
            <div class="modal-footer" style="justify-content: flex-end;">
                <button type="button" class="btn-secondary" onclick="document.getElementById('sms-send-modal').remove()">Close</button>
            </div>
        `;

        var modal = document.createElement('div');
        modal.id = 'sms-send-modal';
        modal.className = 'modal show';
        modal.innerHTML = `<div class="modal-content" style="max-width: 500px;">${contentHtml}</div>`;
        
        modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
        document.body.appendChild(modal);
    }

    // Open Phone Link with number and message pre-loaded via sms: protocol
    window._copyMessageForSms = function(type) {
        var phone, message, btn;
        if (type === 'customer') {
            phone = window._smsCustPhone;
            message = window._smsCustMsg;
            btn = document.getElementById('sms-btn-customer');
        } else {
            phone = window._smsTechPhone;
            message = window._smsTechMsg;
            btn = document.getElementById('sms-btn-tech');
        }

        if (!phone || !message) return;

        // Open Phone Link with number + message via sms: protocol
        window.open('sms:' + phone + '?body=' + encodeURIComponent(message), '_self');

        // Update button feedback
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Opened in Phone Link';
            btn.style.background = 'var(--sms-sent, #059669)';
        }
        showToast('Opening Phone Link for ' + phone, 'success');
    };

    window.sendAssignmentNotifications = async function(id) {
        const svc = findServiceById(id);
        if (!svc) return showToast('Service record not found', 'error');
        if (!svc.staff || svc.staff === 'Unassigned') return showToast('No technician assigned yet', 'error');

        const techPhone = getStaffPhone(svc.staff);
        if (!techPhone) return showToast('Assigned technician has no mobile number', 'error');

        const assignedAt = svc.assigned_at || getCurrentSqlDateTime();
        const updatedService = buildServicePayload(svc, {
            status: svc.status === 'Requested' ? 'In Progress' : svc.status,
            assigned_at: assignedAt
        });

        try {
            await window.apiFetch('services.php?type=service', { method: 'POST', body: updatedService });
            await refreshServiceViews();

            var etaText = svc.eta ? ' Expected arrival: ' + svc.eta + '.' : '';
            var customerMsg = 'Hello ' + svc.customer + ', your service request #' + svc.id + ' (' + svc.type + ') has been assigned to ' + svc.staff + ' (' + techPhone + ').' + etaText + ' We will keep you updated. Thank you - Central Hardwares';
            var techMsg = 'New Job #' + svc.id + ' - ' + svc.type + '. Customer: ' + svc.customer + ', Phone: ' + (svc.phone || 'N/A') + ', Address: ' + (svc.address || 'Not provided') + '.' + (svc.notes ? ' Notes: ' + svc.notes : '') + ' Please confirm when you arrive.';

            showSmsModal(svc.phone, customerMsg, techPhone, techMsg, svc.customer, svc.staff);
        } catch (err) {
            showToast(err.message, 'error');
        }
    };



    window.finishServiceWork = async function(id) {
        const svc = findServiceById(id);
        if (!svc) return showToast('Service record not found', 'error');
        if (svc.status === 'Completed') return showToast('Work is already marked as finished');

        const completedAt = getCurrentSqlDateTime();
        const updatedService = buildServicePayload(svc, {
            status: 'Completed',
            delivery: svc.type === 'Delivery Only' ? 'Delivered' : (svc.delivery || 'Delivered'),
            completed_at: completedAt
        });

        try {
            await window.apiFetch('services.php?type=service', { method: 'POST', body: updatedService });
            showToast('Service marked as finished and updated');
            if (svc.email) sendCustomerNotification(id, 'finished');
            await refreshServiceViews();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    // Load Services
    async function loadServices() {
        try {
            const searchInput = document.getElementById('service-search');
            let query = searchInput ? searchInput.value.trim() : '';
            let url = `services.php?type=service&filter=${currentFilter}`;
            if(query) url += `&search=${encodeURIComponent(query)}`;

            const data = await window.apiFetch(url);
            if(data && data.success) {
                services = data.data || [];
                const isWarrantyView = !document.getElementById('warranties-table-container').classList.contains('d-none');
                if(!isWarrantyView) {
                    renderServices(services);
                }
            }
        } catch(e) { console.error(e); }
        await updateStats();
        return services;
    }

    // Load Route Board
    async function loadRouteBoard() {
        try {
            const data = await window.apiFetch('services.php?type=service&filter=all');
            if (data && data.success) {
                trackedServices = data.data || [];
                renderRouteBoard(trackedServices);
            }
        } catch (e) {
            console.error('Failed to load route board', e);
            if (routeBoardStatus) {
                routeBoardStatus.textContent = 'Route board refresh failed. Check the service API and try again.';
            }
        }
        return trackedServices;
    }

    // Load Warranties
    async function loadWarranties() {
        try {
            const searchInput = document.getElementById('service-search');
            let query = searchInput ? searchInput.value.trim() : '';
            let url = `services.php?type=warranty`;
            if(query) url += `&search=${encodeURIComponent(query)}`;

            const data = await window.apiFetch(url);
            if(data && data.success) {
                warranties = data.data;
                const isWarrantyView = !document.getElementById('warranties-table-container').classList.contains('d-none');
                if(isWarrantyView) {
                    renderWarranties(warranties);
                }
            }
        } catch(e) { console.error(e); }
    }

    window.exportServicesData = function() {
        const warrantiesTable = document.getElementById('warranties-table-container');
        const isWarrantyView = warrantiesTable && !warrantiesTable.classList.contains('d-none');

        if (isWarrantyView) {
            if (warranties.length === 0) {
                alert('No warranty data to export!');
                return;
            }

            window.ExportUtils.toExcel({
                fileName: 'service_warranties_export.xls',
                sheetName: 'Warranties',
                headers: ['ID', 'Serial Number', 'Product', 'Customer', 'Service Cycle', 'Next Service', 'Status'],
                rows: warranties.map(item => [
                    Number(item.id) || item.id || '',
                    item.serial_number || item.sn || '',
                    item.product || '',
                    item.customer || '',
                    item.cycle || '',
                    item.next_service || item.nextService || '',
                    item.status || ''
                ])
            });
            return;
        }

        if (services.length === 0) {
            alert('No service data to export!');
            return;
        }

        window.ExportUtils.toExcel({
            fileName: 'services_export.xls',
            sheetName: 'Services',
            headers: ['ID', 'Customer', 'Service Type', 'Priority', 'Service Status', 'Delivery Status', 'Staff', 'Phone', 'Address', 'ETA', 'Cost', 'Rating', 'Notes'],
            rows: services.map(item => [
                item.id || '',
                item.customer || '',
                item.type || '',
                item.priority || '',
                item.status || '',
                item.delivery || '',
                item.staff || '',
                item.phone || '',
                item.address || '',
                item.eta || '',
                Number(item.cost) || 0,
                item.rating ?? '',
                item.notes || ''
            ])
        });
    };

    // Update Stats
    async function updateStats() {
        try {
            const data = await window.apiFetch('services.php?action=stats');
            if(data && data.success) {
                const s = data.data;
                // Set Txt
                const setTxt = (id, val) => { window.animateStat(id, val); };
                
                // Content area stats
                if (document.getElementById('svc-stat-repairs')) setTxt('svc-stat-repairs', s.repairs);
                if (document.getElementById('svc-stat-deliveries')) setTxt('svc-stat-deliveries', s.deliveries);
                if (document.getElementById('svc-stat-completed')) setTxt('svc-stat-completed', s.completed);
                if (document.getElementById('svc-stat-revenue')) window.animateStat('svc-stat-revenue', parseFloat(s.revenue || 0), 'LKR ');

                // Nav bar stats (Correct IDs from services.html)
                setTxt('nav-svc-repairs', s.repairs);
                setTxt('nav-svc-delivery', s.deliveries);
                setTxt('nav-svc-install', s.pending);
                setTxt('nav-svc-done', s.completed);

                // Performance nav stats
                setTxt('nav-perf-total', s.completed);
                if (document.getElementById('nav-perf-time')) {
                    const hrs = s.avg_minutes ? (s.avg_minutes / 60).toFixed(1) : '0.0';
                    document.getElementById('nav-perf-time').textContent = hrs + ' hrs';
                }
                if (document.getElementById('nav-perf-rating')) {
                    document.getElementById('nav-perf-rating').textContent = (s.avg_rating || 0) + ' / 5';
                }
                
                await loadPerformanceMetrics();
            }
        } catch(e) { console.error('Failed to load stats', e); }
    }

    // Load Performance Metrics
    async function loadPerformanceMetrics() {
        if (!performanceTableBody) return;
        try {
            const data = await window.apiFetch('services.php?action=performance');
            if (data && data.success) {
                performanceRows = data.data.staff || [];
                renderPerformanceTable();
            }
        } catch (e) {
            console.error('Failed to load performance metrics', e);
        }
    }

    // Render Performance Table
    function renderPerformanceTable() {
        if (!performanceTableBody) return;

        if (!performanceRows.length) {
            performanceTableBody.innerHTML = '<tr><td colspan="4" class="text-center text-dimmed">No technician performance data available</td></tr>';
            const emptyPagination = document.getElementById('performance-pagination');
            if (emptyPagination) emptyPagination.innerHTML = '';
            return;
        }

        const paginated = window.Utils.paginate(performanceRows, currentPerformancePage, performanceItemsPerPage);
        currentPerformancePage = paginated.currentPage;

        performanceTableBody.innerHTML = paginated.items.map((row) => {
            const avgTime = row.avg_minutes ? `${(row.avg_minutes / 60).toFixed(1)} hrs` : '-';
            const avgRating = row.avg_rating ? parseFloat(row.avg_rating).toFixed(1) : '-';
            return `<tr>
                <td>${row.staff}</td>
                <td>${row.completed_jobs}</td>
                <td>${avgTime}</td>
                <td>${avgRating}</td>
            </tr>`;
        }).join('');

        window.Utils.renderPagination('performance-pagination', paginated, (newPage) => {
            currentPerformancePage = newPage;
            renderPerformanceTable();
        });
    }

    // Load Service History
    async function loadServiceHistory() {
        if (!serviceHistoryBody) return;
        try {
            const data = await window.apiFetch('services.php?type=service&filter=Completed');
            if (data && data.success) {
                const rows = data.data || [];
                if (historyProductName) historyProductName.textContent = 'Completed Service Archive';
                if (historySubtitle) historySubtitle.textContent = 'Review completed repairs, deliveries, installations, and technician assignments.';
                if (historyTotalJobs) historyTotalJobs.textContent = rows.length;
                if (historyLastService) {
                    const lastCompleted = rows.length ? (rows[0].completed_at || rows[0].service_date || rows[0].created_at) : null;
                    historyLastService.textContent = lastCompleted && window.Utils && typeof window.Utils.formatDate === 'function'
                        ? window.Utils.formatDate(lastCompleted)
                        : (lastCompleted ? formatStageDate(lastCompleted) : '-');
                }
                serviceHistoryBody.innerHTML = rows.length ? rows.map(svc => {
                    const rawHistoryDate = svc.completed_at || svc.service_date || svc.created_at;
                    const historyDate = rawHistoryDate && window.Utils && typeof window.Utils.formatDateTime === 'function'
                        ? window.Utils.formatDateTime(rawHistoryDate)
                        : (rawHistoryDate ? formatStageDate(rawHistoryDate) : '-');
                    return `<tr>
                        <td>${historyDate}</td>
                        <td>${svc.type}</td>
                        <td>${svc.staff || 'Unassigned'}</td>
                    </tr>`;
                }).join('') : '<tr><td colspan="3" class="text-center text-dimmed">No completed service history available</td></tr>';
            }
        } catch (e) {
            console.error('Failed to load service history', e);
        }
    }

    window.openHistoryModal = function() {
        if (serviceHistoryModal) {
            loadServiceHistory();
            serviceHistoryModal.classList.add('show');
        }
    };

    window.closeServiceHistory = function() {
        if (serviceHistoryModal) serviceHistoryModal.classList.remove('show');
    };

    // Open Performance Modal
    function openPerformanceModal() {
        window.openPerformanceModal('dispatch');
    }

    // Close Performance Modal
    function closePerformanceModal() {
        window.closePerformanceModal();
    }

    const serviceTableBody = document.getElementById('service-table-body');
    const warrantyTableBody = document.getElementById('warranty-table-body');
    const serviceHistoryBody = document.getElementById('service-history-body');
    const historyProductName = document.getElementById('history-product-name');
    const historySubtitle = document.getElementById('history-sn');
    const historyTotalJobs = document.getElementById('history-total-jobs');
    const historyLastService = document.getElementById('history-last-service');
    const staffListContainer = document.getElementById('staff-list');
    const deliveryQueueList = document.getElementById('delivery-queue-list');
    const serviceHistoryModal = document.getElementById('service-history-modal');
    const performanceModal = document.getElementById('performance-modal');
    const performanceModalTitle = document.getElementById('performance-modal-title');
    const performanceTabDispatch = document.getElementById('performance-tab-dispatch');
    const performanceTabMetrics = document.getElementById('performance-tab-metrics');
    const performancePanelDispatch = document.getElementById('performance-panel-dispatch');
    const performancePanelMetrics = document.getElementById('performance-panel-metrics');
    const performanceTableBody = document.getElementById('performance-table-body');
    const servicesPageTitle = document.getElementById('services-page-title');
    const servicesRecordsView = document.getElementById('services-records-view');
    const servicesPerformanceView = document.getElementById('services-performance-view');
    const headerPersonnelBtn = document.getElementById('header-personnel-btn');
    const headerQueueBtn = document.getElementById('header-queue-btn');
    const headerServicesBtn = document.getElementById('header-services-btn');
    const headerPerformanceBtn = document.getElementById('header-performance-btn');
    const serviceNavLinks = {
        records: document.querySelector('[data-service-nav="records"]'),
        performance: document.querySelector('[data-service-nav="performance"]')
    };
    const routeBoardStatus = document.getElementById('route-board-status');
    const routeBoardLanes = {
        en_route: document.getElementById('route-board-en-route'),
        on_site: document.getElementById('route-board-on-site'),
        delayed: document.getElementById('route-board-delayed'),
        finished: document.getElementById('route-board-finished')
    };
    const routeBoardCounts = {
        en_route: document.getElementById('route-count-en-route'),
        on_site: document.getElementById('route-count-on-site'),
        delayed: document.getElementById('route-count-delayed'),
        finished: document.getElementById('route-count-finished')
    };
    const routeSummaryActive = document.getElementById('route-summary-active');
    const routeSummaryDelayed = document.getElementById('route-summary-delayed');

    // Get Requested Services Page
    function getRequestedServicesPage() {
        const params = new URLSearchParams(window.location.search);
        return params.get('view') === 'performance' ? 'performance' : 'records';
    }

    // Get Requested Performance Panel
    function getRequestedPerformancePanel() {
        const params = new URLSearchParams(window.location.search);
        return params.get('panel') === 'metrics' ? 'metrics' : 'dispatch';
    }

    // Sync Services Page Url
    function syncServicesPageUrl() {
        if (!window.history || typeof window.history.replaceState !== 'function') return;

        const url = new URL(window.location.href);
        if (currentServicesPage === 'performance') {
            url.searchParams.set('view', 'performance');
            if (currentPerformanceView === 'metrics') {
                url.searchParams.set('panel', 'metrics');
            } else {
                url.searchParams.delete('panel');
            }
        } else {
            url.searchParams.delete('view');
            url.searchParams.delete('panel');
        }

        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }

    // Sync Service Sidebar State
    function syncServiceSidebarState() {
        Object.entries(serviceNavLinks).forEach(([key, item]) => {
            if (item) item.classList.toggle('active', key === currentServicesPage);
        });
    }

    // Is Dispatch Board Visible
    function isDispatchBoardVisible() {
        return currentServicesPage === 'performance' &&
            performancePanelDispatch &&
            !performancePanelDispatch.classList.contains('d-none');
    }

    // Apply Services Page View
    function applyServicesPageView(view = 'records', performanceView = 'dispatch') {
        currentServicesPage = view === 'performance' ? 'performance' : 'records';

        if (servicesRecordsView) {
            servicesRecordsView.classList.toggle('d-none', currentServicesPage !== 'records');
        }
        if (servicesPerformanceView) {
            servicesPerformanceView.classList.toggle('d-none', currentServicesPage !== 'performance');
        }

        if (servicesPageTitle) {
            servicesPageTitle.textContent = currentServicesPage === 'performance' ? 'Service Performance' : 'Services & Delivery';
        }

        if (headerPersonnelBtn) headerPersonnelBtn.classList.toggle('d-none', currentServicesPage === 'performance');
        if (headerQueueBtn) headerQueueBtn.classList.toggle('d-none', currentServicesPage === 'performance');
        if (headerServicesBtn) headerServicesBtn.classList.toggle('d-none', currentServicesPage !== 'performance');
        if (headerPerformanceBtn) headerPerformanceBtn.classList.toggle('d-none', currentServicesPage === 'performance');

        // Toggle Nav Stats
        const navRecords = document.getElementById('nav-stats-records');
        const navPerf = document.getElementById('nav-stats-performance');
        if (navRecords) navRecords.classList.toggle('d-none', currentServicesPage === 'performance');
        if (navPerf) navPerf.classList.toggle('d-none', currentServicesPage !== 'performance');

        syncServiceSidebarState();

        if (currentServicesPage === 'performance') {
            showPerformancePanel(performanceView);
        } else {
            stopRouteBoardAutoRefresh();
            syncServicesPageUrl();
        }
    }

    const routeLaneMeta = {
        en_route: { label: 'En Route', empty: 'No assigned visits in transit.' },
        on_site: { label: 'On Site', empty: 'No teams currently at customer locations.' },
        delayed: { label: 'Delayed', empty: 'No overdue field jobs right now.' },
        finished: { label: 'Finished', empty: 'No completed route jobs to show yet.' }
    };

    // Escape Html
    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Parse Route Date
    function parseRouteDate(value) {
        if (!value) return null;
        const parsed = new Date(value.toString().replace(' ', 'T'));
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    // Format Relative Duration
    function formatRelativeDuration(totalMinutes) {
        const safeMinutes = Math.max(0, totalMinutes);
        if (safeMinutes < 60) return `${safeMinutes} min`;

        const hours = Math.floor(safeMinutes / 60);
        const minutes = safeMinutes % 60;
        if (hours < 24) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;

        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`;
    }

    // Is Tracked Route Service
    function isTrackedRouteService(svc) {
        const hasAssignedStaff = svc.staff && svc.staff !== 'Unassigned';
        return Boolean(
            hasAssignedStaff ||
            svc.assigned_at ||
            svc.en_route_at ||
            svc.on_site_at ||
            svc.completed_at ||
            svc.eta ||
            svc.delivery === 'Out for Delivery' ||
            svc.delivery === 'Delivered'
        );
    }

    // Is Service Finished
    function isServiceFinished(svc) {
        return svc.status === 'Completed' || Boolean(svc.completed_at) || svc.delivery === 'Delivered';
    }

    // Is Service Delayed
    function isServiceDelayed(svc) {
        const etaDate = parseRouteDate(svc.eta);
        return Boolean(etaDate && etaDate.getTime() < Date.now() && !isServiceFinished(svc));
    }

    // Get Route Lane
    function getRouteLane(svc) {
        if (!isTrackedRouteService(svc)) return null;
        if (isServiceFinished(svc)) return 'finished';
        if (isServiceDelayed(svc)) return 'delayed';
        if (svc.on_site_at) return 'on_site';
        if (svc.en_route_at || svc.delivery === 'Out for Delivery' || (svc.staff && svc.staff !== 'Unassigned')) {
            return 'en_route';
        }
        return null;
    }

    // Get Checkpoint Meta
    function getCheckpointMeta(svc) {
        if (isServiceFinished(svc)) {
            return { label: 'Finished', value: formatStageDate(svc.completed_at || svc.updated_at || svc.created_at) };
        }
        if (svc.on_site_at) {
            return { label: 'On Site', value: formatStageDate(svc.on_site_at) };
        }
        if (svc.en_route_at) {
            return { label: 'Departed', value: formatStageDate(svc.en_route_at) };
        }
        if (svc.assigned_at) {
            return { label: 'Assigned', value: formatStageDate(svc.assigned_at) };
        }
        return { label: 'Created', value: formatStageDate(svc.created_at) };
    }

    // Get Delay Message
    function getDelayMessage(svc) {
        const etaDate = parseRouteDate(svc.eta);
        if (!etaDate) return 'ETA pending';
        if (etaDate.getTime() >= Date.now()) return 'On schedule';

        const overdueMinutes = Math.floor((Date.now() - etaDate.getTime()) / 60000);
        return `Overdue by ${formatRelativeDuration(overdueMinutes)}`;
    }

    // Get Route Card Actions
    function getRouteCardActions(svc, lane) {
        const actions = [
            `<button class="route-mini-btn" onclick="viewService('${svc.id}')"><i class="fa-regular fa-eye"></i> View</button>`
        ];

        if (svc.phone) {
            actions.push(`<button class="route-mini-btn" onclick="sendAssignmentNotifications('${svc.id}')" title="Message Customer \u0026 Tech"><i class="fa-solid fa-message"></i> Msg</button>`);
            actions.push(`<button class="route-mini-btn" onclick="showMessageHistory('${svc.phone}', '${svc.customer}')" title="View message history"><i class="fa-solid fa-history"></i> History</button>`);
        }

        if (!isServiceFinished(svc) && !svc.en_route_at && !svc.on_site_at) {
            actions.push(`<button class="route-mini-btn success" onclick="markServiceStage('${svc.id}', 'en_route')"><i class="fa-solid fa-route"></i> Start</button>`);
        }
        if (!isServiceFinished(svc) && !svc.on_site_at) {
            actions.push(`<button class="route-mini-btn success" onclick="markServiceStage('${svc.id}', 'on_site')"><i class="fa-solid fa-location-crosshairs"></i> On Site</button>`);
        }
        if (lane === 'delayed') {
            actions.push(`<button class="route-mini-btn warning" onclick="editService('${svc.id}')"><i class="fa-regular fa-pen-to-square"></i> Update</button>`);
        }
        if (!isServiceFinished(svc)) {
            actions.push(`<button class="route-mini-btn primary" onclick="finishServiceWork('${svc.id}')"><i class="fa-solid fa-circle-check"></i> Finish</button>`);
        }

        return actions.join('');
    }

    // Render Route Card
    function renderRouteCard(svc, lane) {
        const checkpoint = getCheckpointMeta(svc);
        const etaText = svc.eta ? formatStageDate(svc.eta) : 'Not set';
        const addressText = svc.address || 'Address not provided';
        const staffText = svc.staff || 'Unassigned';
        const phoneText = svc.phone || 'No phone';
        const delayText = lane === 'delayed' ? `<div class="route-health route-health-alert"><i class="fa-solid fa-triangle-exclamation"></i><span>${escapeHtml(getDelayMessage(svc))}</span></div>` : '';

        return `
            <article class="route-card route-card-${lane}">
                <div class="route-card-header">
                    <div>
                        <h5 class="route-card-title">${escapeHtml(svc.customer || 'Unknown customer')}</h5>
                        <p class="route-card-subtitle">${escapeHtml(svc.id)} · ${escapeHtml(svc.type || 'Service')}</p>
                    </div>
                    <span class="route-stage-badge stage-${lane}">${routeLaneMeta[lane].label}</span>
                </div>
                <div class="route-card-grid">
                    <div class="route-meta-row">
                        <i class="fa-solid fa-user-gear"></i>
                        <span>${escapeHtml(staffText)}</span>
                    </div>
                    <div class="route-meta-row">
                        <i class="fa-solid fa-location-dot"></i>
                        <span>${escapeHtml(addressText)}</span>
                    </div>
                    <div class="route-meta-row">
                        <i class="fa-solid fa-phone"></i>
                        <span>${escapeHtml(phoneText)}</span>
                    </div>
                </div>
                <div class="route-sla">
                    <div>
                        <span>ETA</span>
                        <strong>${escapeHtml(etaText)}</strong>
                    </div>
                    <div>
                        <span>${escapeHtml(checkpoint.label)}</span>
                        <strong>${escapeHtml(checkpoint.value)}</strong>
                    </div>
                </div>
                ${delayText}
                <div class="route-card-actions">
                    ${getRouteCardActions(svc, lane)}
                </div>
            </article>
        `;
    }

    // Render Dispatch Card
    function renderDispatchCard(svc, lane) {
        const checkpoint = getCheckpointMeta(svc);
        const etaText = svc.eta ? formatStageDate(svc.eta) : 'Not set';
        const addressText = svc.address || 'Address not provided';
        const staffText = svc.staff || 'Unassigned';
        const phoneText = svc.phone || 'No phone';
        const delayText = lane === 'delayed' ? `<div class="route-health route-health-alert"><i class="fa-solid fa-triangle-exclamation"></i><span>${escapeHtml(getDelayMessage(svc))}</span></div>` : '';

        return `
            <article class="route-card route-card-${lane}">
                <div class="route-card-header">
                    <div>
                        <h5 class="route-card-title">${escapeHtml(svc.customer || 'Unknown customer')}</h5>
                        <p class="route-card-subtitle">${escapeHtml(svc.id)} - ${escapeHtml(svc.type || 'Service')}</p>
                    </div>
                    <span class="route-stage-badge stage-${lane}">${routeLaneMeta[lane].label}</span>
                </div>
                <div class="route-card-grid">
                    <div class="route-meta-row">
                        <i class="fa-solid fa-user-gear"></i>
                        <span>${escapeHtml(staffText)}</span>
                    </div>
                    <div class="route-meta-row">
                        <i class="fa-solid fa-location-dot"></i>
                        <span>${escapeHtml(addressText)}</span>
                    </div>
                    <div class="route-meta-row">
                        <i class="fa-solid fa-phone"></i>
                        <span>${escapeHtml(phoneText)}</span>
                    </div>
                </div>
                <div class="route-sla">
                    <div>
                        <span>ETA</span>
                        <strong>${escapeHtml(etaText)}</strong>
                    </div>
                    <div>
                        <span>${escapeHtml(checkpoint.label)}</span>
                        <strong>${escapeHtml(checkpoint.value)}</strong>
                    </div>
                </div>
                ${delayText}
                <div class="route-card-actions">
                    ${getRouteCardActions(svc, lane)}
                </div>
            </article>
        `;
    }

    // Render Route Board
    function renderRouteBoard(data = trackedServices) {
        if (!routeBoardStatus) return;

        const grouped = {
            en_route: [],
            on_site: [],
            delayed: [],
            finished: []
        };

        (data || []).forEach((svc) => {
            const lane = getRouteLane(svc);
            if (lane) grouped[lane].push(svc);
        });

        grouped.en_route.sort((a, b) => {
            const left = parseRouteDate(a.en_route_at || a.assigned_at || a.created_at)?.getTime() || 0;
            const right = parseRouteDate(b.en_route_at || b.assigned_at || b.created_at)?.getTime() || 0;
            return left - right;
        });
        grouped.on_site.sort((a, b) => {
            const left = parseRouteDate(a.on_site_at || a.en_route_at || a.created_at)?.getTime() || 0;
            const right = parseRouteDate(b.on_site_at || b.en_route_at || b.created_at)?.getTime() || 0;
            return left - right;
        });
        grouped.delayed.sort((a, b) => {
            const left = parseRouteDate(a.eta || a.created_at)?.getTime() || 0;
            const right = parseRouteDate(b.eta || b.created_at)?.getTime() || 0;
            return left - right;
        });
        grouped.finished.sort((a, b) => {
            const left = parseRouteDate(a.completed_at || a.updated_at || a.created_at)?.getTime() || 0;
            const right = parseRouteDate(b.completed_at || b.updated_at || b.created_at)?.getTime() || 0;
            return right - left;
        });

        Object.keys(grouped).forEach((lane) => {
            const laneBody = routeBoardLanes[lane];
            if (!laneBody) return;

            const laneItems = grouped[lane];
            if (routeBoardCounts[lane]) {
                routeBoardCounts[lane].textContent = laneItems.length;
            }

            if (!laneItems.length) {
                currentRouteLanePages[lane] = 1;
                laneBody.innerHTML = `<div class="route-empty">${routeLaneMeta[lane].empty}</div>`;
                return;
            }

            const paginated = window.Utils.paginate(laneItems, currentRouteLanePages[lane], routeLaneItemsPerPage);
            currentRouteLanePages[lane] = paginated.currentPage;

            laneBody.innerHTML = `
                <div class="route-lane-cards">
                    ${paginated.items.map((svc) => renderDispatchCard(svc, lane)).join('')}
                </div>
                <div id="route-pagination-${lane}" class="route-lane-pagination pagination-container"></div>
            `;

            window.Utils.renderPagination(`route-pagination-${lane}`, paginated, (newPage) => {
                currentRouteLanePages[lane] = newPage;
                renderRouteBoard(trackedServices);
            });
        });

        if (routeSummaryActive) {
            routeSummaryActive.textContent = grouped.en_route.length + grouped.on_site.length + grouped.delayed.length;
        }
        if (routeSummaryDelayed) {
            routeSummaryDelayed.textContent = grouped.delayed.length;
        }

        routeBoardStatus.textContent = `Live board refreshed at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Auto-refresh every 30 seconds.`;
    }

    // Start Route Board Auto Refresh
    function startRouteBoardAutoRefresh() {
        if (routeBoardRefreshHandle) {
            window.clearInterval(routeBoardRefreshHandle);
        }

        routeBoardRefreshHandle = window.setInterval(() => {
            if (!isDispatchBoardVisible()) {
                stopRouteBoardAutoRefresh();
                return;
            }
            if (!document.hidden) {
                loadRouteBoard();
            }
        }, 30000);
    }

    // Stop Route Board Auto Refresh
    function stopRouteBoardAutoRefresh() {
        if (routeBoardRefreshHandle) {
            window.clearInterval(routeBoardRefreshHandle);
            routeBoardRefreshHandle = null;
        }
    }

    // Show Performance Panel
    function showPerformancePanel(view = 'dispatch') {
        currentPerformanceView = view === 'metrics' ? 'metrics' : 'dispatch';

        if (performanceTabDispatch) performanceTabDispatch.classList.toggle('active', currentPerformanceView === 'dispatch');
        if (performanceTabMetrics) performanceTabMetrics.classList.toggle('active', currentPerformanceView === 'metrics');
        if (performancePanelDispatch) performancePanelDispatch.classList.toggle('d-none', currentPerformanceView !== 'dispatch');
        if (performancePanelMetrics) performancePanelMetrics.classList.toggle('d-none', currentPerformanceView !== 'metrics');
        if (performanceModalTitle) {
            performanceModalTitle.textContent = currentPerformanceView === 'dispatch' ? 'Live Dispatch Board' : 'Technician Performance';
        }

        syncServicesPageUrl();

        if (currentPerformanceView === 'dispatch') {
            loadRouteBoard();
            if (isDispatchBoardVisible()) {
                startRouteBoardAutoRefresh();
            }
        } else {
            stopRouteBoardAutoRefresh();
            loadPerformanceMetrics();
        }
    }

    window.refreshRouteBoard = function() {
        loadRouteBoard();
    };

    window.switchPerformanceView = function(view) {
        showPerformancePanel(view);
    };

    window.openPerformanceModal = function(view = 'dispatch') {
        applyServicesPageView('performance', view);
    };

    window.closePerformanceModal = function() {
        stopRouteBoardAutoRefresh();
        applyServicesPageView('records');
    };

    // Render Services
    function renderServices(data = services) {
        if (!serviceTableBody) return;
        serviceTableBody.innerHTML = '';
        const servicesPagination = document.getElementById('services-pagination');
        
        if (!data || data.length === 0) {
            if (servicesPagination) servicesPagination.innerHTML = '';
            serviceTableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 20px;" class="text-dimmed">No services found</td></tr>';
            renderDeliveryQueue();
            return;
        }

        const paginated = window.Utils.paginate(data, currentServicesTablePage, servicesItemsPerPage);
        currentServicesTablePage = paginated.currentPage;

        paginated.items.forEach((svc, idx) => {
            // Row Index
            const rowIndex = (currentServicesTablePage - 1) * servicesItemsPerPage + (idx + 1);
            const tr = document.createElement('tr');
            const svcStatus = svc.status || '';
            const svcStaff = svc.staff || 'Unassigned';
            const svcDelivery = svc.delivery || 'N/A';
            tr.innerHTML = `
                <td class="text-xs text-dimmed">${rowIndex}</td>
                <td>${svc.customer}</td>
                <td><span class="badge badge-info">${svc.type}</span></td>
                <td><span class="badge ${getPriorityClass(svc.priority)}">${svc.priority}</span></td>
                <td>${svcStatus ? `<span class="status ${getStatusClass(svcStatus)}">${svcStatus}</span>` : '—'}</td>
                <td>${svcDelivery}</td>
                <td>${svcStaff}</td>
                <td class="text-right">LKR ${parseFloat(svc.cost || 0).toLocaleString()}</td>
                <td class="text-center">
                    <div class="action-btns justify-center">
                        <button class="btn-action btn-view" onclick="viewService('${svc.id}')" title="View Service"><i class="fa-regular fa-eye"></i></button>
                        ${svc.phone ? `<button class="btn-action btn-save" onclick="sendAssignmentNotifications('${svc.id}')" title="Message Customer \u0026 Tech"><i class="fa-solid fa-message"></i></button>` : ''}
                        <button class="btn-action btn-edit" onclick="editService('${svc.id}')" title="Edit Service"><i class="fa-regular fa-pen-to-square"></i></button>
                        <button class="btn-action btn-print" onclick="printService('${svc.id}')" title="Print Service"><i class="fa-solid fa-print"></i></button>
                        <button class="btn-action btn-delete" onclick="deleteService('${svc.id}')" title="Delete"><i class="fa-regular fa-trash-can"></i></button>
                    </div>
                </td>
            `;
            serviceTableBody.appendChild(tr);
        });

        window.Utils.renderPagination('services-pagination', paginated, (newPage) => {
            currentServicesTablePage = newPage;
            renderServices(services);
        });

        renderDeliveryQueue();
    }

    // Render Warranties
    function renderWarranties(data = warranties) {
        if (!warrantyTableBody) return;
        warrantyTableBody.innerHTML = '';
        const warrantiesPagination = document.getElementById('warranties-pagination');

        if (!data || data.length === 0) {
            if (warrantiesPagination) warrantiesPagination.innerHTML = '';
            warrantyTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px;" class="text-dimmed">No warranties found</td></tr>';
            return;
        }

        const paginated = window.Utils.paginate(data, currentWarrantiesPage, warrantiesItemsPerPage);
        currentWarrantiesPage = paginated.currentPage;

        paginated.items.forEach((wrn, idx) => {
            // Row Index
            const rowIndex = (currentWarrantiesPage - 1) * warrantiesItemsPerPage + (idx + 1);
            const tr = document.createElement('tr');
            const cycleText = wrn.cycle || '';
            tr.innerHTML = `
                <td class="text-xs text-dimmed">${rowIndex}</td>
                <td><strong>${wrn.serial_number || wrn.sn}</strong></td>
                <td>${wrn.product}</td>
                <td>${wrn.customer}</td>
                <td>${cycleText}</td>
                <td>${wrn.next_service || wrn.nextService || '-'}</td>
                <td><span class="status ${wrn.status === 'Active' ? 'complete' : 'pending'}">${wrn.status}</span></td>
                <td>
                    <div class="action-btns">
                        <button class="btn-action btn-view" onclick="viewWarranty('${wrn.id}')" title="View Warranty"><i class="fa-regular fa-eye"></i></button>
                        <button class="btn-action btn-edit" onclick="editWarranty('${wrn.id}')" title="Edit Warranty"><i class="fa-regular fa-pen-to-square"></i></button>
                        <button class="btn-action btn-print" onclick="printWarranty('${wrn.id}')" title="Print Warranty"><i class="fa-solid fa-print"></i></button>
                        <button class="btn-action btn-delete" onclick="deleteWarranty('${wrn.id}')" title="Delete"><i class="fa-regular fa-trash-can"></i></button>
                    </div>
                </td>
            `;
            warrantyTableBody.appendChild(tr);
        });

        window.Utils.renderPagination('warranties-pagination', paginated, (newPage) => {
            currentWarrantiesPage = newPage;
            renderWarranties(warranties);
        });
    }

    // Render Staff
    function renderStaff() {
        if (!staffListContainer) return;
        staffListContainer.innerHTML = '';
        
        staffMembers.forEach(s => {
            const div = document.createElement('div');
            div.className = 'driver-item';
            div.onclick = () => openStaffDetails(s.name, s.status, s.status === 'Active' ? 'online' : 'busy', s.phone);
            div.innerHTML = `
                <div class="driver-avatar">
                   <div class="avatar-circle">${s.name.charAt(0)}</div>
                   <div class="driver-status-dot ${s.status === 'Active' ? 'online' : 'busy'}"></div>
                </div>
                <div class="driver-info">
                   <h4>${s.name}</h4>
                   <p>${s.role} • ${s.tasks || 0} Tasks</p>
                </div>
                <div class="driver-action">
                   <button class="btn-icon-only" title="View Details"><i class="fa-solid fa-chevron-right"></i></button>
                </div>
            `;
            staffListContainer.appendChild(div);
        });
    }

    // Render Delivery Queue
    function renderDeliveryQueue() {
        if (!deliveryQueueList) return;
        deliveryQueueList.innerHTML = '';
        
        const pendingDeliveries = services.filter(s => s.delivery === 'Out for Delivery');
        
        if (pendingDeliveries.length === 0) {
            deliveryQueueList.innerHTML = '<div class="empty-queue-msg">No pending deliveries</div>';
            return;
        }

        pendingDeliveries.forEach(d => {
            const div = document.createElement('div');
            div.className = 'driver-item'; 
            div.innerHTML = `
                <div class="driver-info" style="margin-left: 0; width: 100%;">
                   <h4 style="margin:0 0 6px 0;">${d.id} — ${d.customer}</h4>
                   <p style="margin:0; color:#64748b;">${d.type} • ${d.delivery} • ${d.staff || 'Unassigned'}</p>
                   <p style="margin:8px 0 0 0; color:#475569; font-size:0.9rem;">Address: ${d.address || 'Not provided'}</p>
                </div>
                <div class="driver-action" style="display:flex;gap:6px;align-items:center; margin-top:12px;">
                    <button class="btn-action btn-view" onclick="viewService('${d.id}')" title="View Service">View</button>
                    <button class="btn-action btn-save" onclick="sendAssignmentNotifications('${d.id}')" title="Send assignment message">Assign</button>
                    <button class="btn-action btn-save" onclick="finishServiceWork('${d.id}')" title="Mark work finished">Done</button>
                </div>
            `;
            deliveryQueueList.appendChild(div);
        });
    }

    window.markDeliveryDelivered = async function(id) {
        const svc = findServiceById(id);
        if (!svc) return;
        const updatedService = buildServicePayload(svc, {
            type: svc.type || 'Delivery Only',
            status: svc.status === 'Completed' ? svc.status : 'Completed',
            delivery: 'Delivered',
            completed_at: svc.completed_at || getCurrentSqlDateTime()
        });

        try {
            await window.apiFetch('services.php?type=service', { method: 'POST', body: updatedService });
            showToast('Delivery marked as delivered');
            await refreshServiceViews();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    // Get Priority Class
    function getPriorityClass(p) {
        if (p === 'High' || p === 'Urgent') return 'badge-danger';
        if (p === 'Medium') return 'badge-warning';
        return 'badge-success'; 
    }

    // Get Status Class
    function getStatusClass(s) {
        if (s === 'Completed') return 'complete';
        if (s === 'In Progress') return 'pending';
        return 'warning'; 
    }

    // Format Stage Date
    function formatStageDate(value) {
        if (!value) return '-';
        const parsed = parseRouteDate(value);
        return parsed ? parsed.toLocaleString() : value;
    }

    window.sendCustomerNotification = async function(id, eventType) {
        const svc = findServiceById(id);
        if (!svc) return showToast('Service record not found', 'error');

        let message = '';
        if (eventType === 'assignment') {
            message = `Hello ${svc.customer}, your service request #${svc.id} has been assigned to ${svc.staff || 'a technician'}. We will keep you informed. Thank you - Central Hardwares`;
        } else if (eventType === 'finished') {
            message = `Hello ${svc.customer}, the work for your service request #${svc.id} has been completed. Please let us know if you need further assistance. Thank you - Central Hardwares`;
        } else {
            message = `Hello ${svc.customer}, there is an update on your service request #${svc.id}. Please contact us if you have any questions. Thank you - Central Hardwares`;
        }

        if (svc.phone) {
            try {
                const success = await sendMessageViaAPI(svc.phone, svc.customer, 'Customer', message, svc.id);
                if (success) {
                    showToast('Notification sent to customer successfully!', 'success');
                }
            } catch (err) {
                showToast('Failed to send notification', 'error');
            }
        } else if (svc.email) {
            const subject = encodeURIComponent(`Update for service ${svc.id}`);
            const emailBody = encodeURIComponent(message);
            window.location.href = `mailto:${svc.email}?subject=${subject}&body=${emailBody}`;
        } else {
            showToast('Customer has no phone or email on file', 'warning');
        }
    };

    window.showMessageHistory = async function(phone, name = 'Contact') {
        if (!phone) {
            showToast('No phone number provided', 'error');
            return;
        }

        const cleanedPhone = cleanPhone(phone);
        if (!cleanedPhone) {
            showToast('Invalid phone number', 'error');
            return;
        }

        try {
            // Remove existing modal if any
            const existing = document.getElementById('message-history-modal');
            if (existing) existing.remove();

            const modal = document.createElement('div');
            modal.id = 'message-history-modal';
            modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:99999;overflow-y:auto;';

            const box = document.createElement('div');
            box.style.cssText = 'background:#fff;border-radius:16px;padding:0;max-width:600px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);font-family:Inter,sans-serif;max-height:85vh;overflow:hidden;display:flex;flex-direction:column;margin:20px auto;';

            // Header
            const header = document.createElement('div');
            header.style.cssText = 'background:linear-gradient(135deg, #3b82f6 0%, #0284c7 100%);color:#fff;padding:20px;border-bottom:none;flex-shrink:0;';
            header.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <h3 style="margin:0 0 4px 0;font-size:1.2rem;"><i class="fa-solid fa-comments" style="margin-right:10px;"></i>Message History</h3>
                        <p style="margin:0;font-size:0.85rem;opacity:0.9;">${name} • ${cleanedPhone}</p>
                    </div>
                    <button onclick="this.closest('#message-history-modal').remove();" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:#fff;opacity:0.8;">×</button>
                </div>
            `;
            box.appendChild(header);

            // Content area
            const content = document.createElement('div');
            content.style.cssText = 'flex:1;overflow-y:auto;padding:20px;';

            // Load messages
            const response = await window.apiFetch(`messages.php?action=history&phone=${encodeURIComponent(cleanedPhone)}`);
            
            if (response.success && response.messages && response.messages.length > 0) {
                content.innerHTML = response.messages.map(msg => `
                    <div style="margin-bottom:16px;padding:12px;background:#f8fafc;border-radius:10px;border-left:4px solid #3b82f6;">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                            <strong style="color:#1e293b;font-size:0.9rem;">${msg.from_username || 'System'}</strong>
                            <span style="font-size:0.75rem;color:#94a3b8;">${new Date(msg.created_at).toLocaleDateString()} ${new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span>
                        </div>
                        <p style="margin:0;color:#475569;font-size:0.9rem;line-height:1.5;word-wrap:break-word;">${msg.message}</p>
                        ${msg.service_type ? `<small style="display:block;margin-top:8px;color:#64748b;">📌 Service: ${msg.service_type}</small>` : ''}
                    </div>
                `).join('');
            } else {
                content.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#94a3b8;"><i class="fa-solid fa-inbox" style="font-size:2.5rem;margin-bottom:10px;display:block;"></i><p>No messages found</p></div>';
            }

            box.appendChild(content);

            // Footer
            const footer = document.createElement('div');
            footer.style.cssText = 'background:#f8fafc;padding:15px 20px;border-top:1px solid #e2e8f0;flex-shrink:0;';
            footer.innerHTML = `
                <button onclick="this.closest('#message-history-modal').remove();" style="background:#e2e8f0;color:#475569;border:1px solid #cbd5e1;padding:10px 20px;border-radius:8px;font-weight:600;cursor:pointer;width:100%;transition:background 0.2s;">Close</button>
            `;
            box.appendChild(footer);

            modal.appendChild(box);

            // Close when clicking backdrop
            modal.addEventListener('click', function(e) {
                if (e.target === modal) modal.remove();
            });

            document.body.appendChild(modal);

        } catch (err) {
            console.error('Failed to load message history:', err);
            showToast('Failed to load message history', 'error');
        }
    };

    window.markServiceStage = async function(id, stage) {
        const svc = findServiceById(id);
        if (!svc) return showToast('Service record not found', 'error');

        const stageKey = {
            en_route: 'en_route_at',
            on_site: 'on_site_at'
        }[stage];

        if (!stageKey) return showToast('Unknown service stage', 'error');

        const updatedService = buildServicePayload(svc, {
            status: 'In Progress',
            assigned_at: svc.assigned_at || getCurrentSqlDateTime(),
            en_route_at: stage === 'en_route' ? getCurrentSqlDateTime() : svc.en_route_at || null,
            on_site_at: stage === 'on_site' ? getCurrentSqlDateTime() : svc.on_site_at || null
        });

        try {
            await window.apiFetch('services.php?type=service', { method: 'POST', body: updatedService });
            showToast(`Service marked as ${stage.replace('_', ' ')}`);
            await refreshServiceViews();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    window.filterServices = function(type) {
        const buttons = document.querySelectorAll('#service-tabs button');
        buttons.forEach(b => b.classList.remove('active'));
        if(event && event.target) {
            if(event.target.tagName==='BUTTON') event.target.classList.add('active');
        }

        document.getElementById('services-table-container').classList.remove('d-none');
        document.getElementById('warranties-table-container').classList.add('d-none');
        const statsGrid = document.getElementById('service-stats-grid');
        if(statsGrid) statsGrid.classList.remove('d-none');
        document.getElementById('warranty-actions').classList.add('d-none');

        currentFilter = type;
        currentServicesTablePage = 1;
        loadServices();
    };

    window.filterWarranties = function() {
        const buttons = document.querySelectorAll('#service-tabs button');
        buttons.forEach(b => b.classList.remove('active'));
        const wBtn = document.querySelector('.btn-warranty-tab');
        if(wBtn) wBtn.classList.add('active');

        document.getElementById('services-table-container').classList.add('d-none');
        document.getElementById('warranties-table-container').classList.remove('d-none');
        document.getElementById('warranty-actions').classList.remove('d-none');
        
        currentWarrantiesPage = 1;
        loadWarranties();
    };

    let searchTimer;
    const searchInput = document.getElementById('service-search');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                const isWarrantyObj = !document.getElementById('warranties-table-container').classList.contains('d-none');
                if (isWarrantyObj) {
                    currentWarrantiesPage = 1;
                    loadWarranties();
                } else {
                    currentServicesTablePage = 1;
                    loadServices();
                }
            }, 300);
        });
    }

    // --- MODALS (SERVICE) ---
    const serviceModal = document.getElementById('service-modal');
    const serviceForm = document.getElementById('service-form');

    window.openServiceModal = function() {
        if(serviceModal) {
            serviceModal.classList.add('show');
            if(serviceForm) serviceForm.reset();
            document.getElementById('srv-id').value = '';
            populateDriverSelect();
            const title = serviceModal.querySelector('.modal-header h3');
            if (title) title.textContent = 'Register New Service';
        }
    };

    window.viewService = function(id) {
        const svc = findServiceById(id);
        if (!svc) return;
        
        const content = `
            <div style="color: #1e293b; max-width: 420px; margin: 0 auto;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #f1f5f9;">
                    <div style="width: 48px; height: 48px; border-radius: 12px; background: #eff6ff; color: #3b82f6; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                        <i class="fa-solid fa-file-invoice"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Service Request</div>
                        <div style="font-size: 1.1rem; font-weight: 800; color: #0f172a;">#${svc.id}</div>
                    </div>
                    <div style="margin-left: auto;">
                        <span style="display:inline-block; padding:4px 12px; border-radius:8px; font-size:0.75rem; font-weight:700; background:#f1f5f9; color:#475569; border:1px solid #e2e8f0;">${svc.status}</span>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 16px;">
                    <div style="display: flex; gap: 12px; align-items: flex-start;">
                        <i class="fa-solid fa-user" style="color: #94a3b8; width: 16px; margin-top: 4px;"></i>
                        <div>
                            <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 2px;">Customer</div>
                            <div style="font-size: 0.95rem; font-weight: 700; color: #1e293b;">${svc.customer}</div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div style="display: flex; gap: 12px; align-items: flex-start;">
                            <i class="fa-solid fa-wrench" style="color: #94a3b8; width: 16px; margin-top: 4px;"></i>
                            <div>
                                <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 2px;">Type</div>
                                <div style="font-size: 0.9rem; font-weight: 600; color: #475569;">${svc.type}</div>
                            </div>
                        </div>
                        <div style="display: flex; gap: 12px; align-items: flex-start;">
                            <i class="fa-solid fa-bolt" style="color: #94a3b8; width: 16px; margin-top: 4px;"></i>
                            <div>
                                <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 2px;">Priority</div>
                                <div style="font-size: 0.9rem; font-weight: 700; color:${svc.priority === 'High' ? '#ef4444' : (svc.priority === 'Urgent' ? '#7c3aed' : '#3b82f6')}">${svc.priority}</div>
                            </div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div style="display: flex; gap: 12px; align-items: flex-start;">
                            <i class="fa-solid fa-user-gear" style="color: #94a3b8; width: 16px; margin-top: 4px;"></i>
                            <div>
                                <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 2px;">Staff</div>
                                <div style="font-size: 0.9rem; color: #475569;">${svc.staff || 'Unassigned'}</div>
                            </div>
                        </div>
                        <div style="display: flex; gap: 12px; align-items: flex-start;">
                            <i class="fa-solid fa-tag" style="color: #94a3b8; width: 16px; margin-top: 4px;"></i>
                            <div>
                                <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 2px;">Cost</div>
                                <div style="font-size: 0.9rem; font-weight: 800; color: #0f172a;">LKR ${parseFloat(svc.cost || 0).toLocaleString()}</div>
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 12px; align-items: flex-start; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #f1f5f9;">
                        <i class="fa-solid fa-location-dot" style="color: #94a3b8; width: 16px; margin-top: 4px;"></i>
                        <div>
                            <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">Address</div>
                            <div style="font-size: 0.85rem; color: #475569; line-height: 1.5;">${svc.address || 'N/A'}</div>
                        </div>
                    </div>
                </div>
            </div>`;

        window.showCenteredModal({
            title: `Service Details`,
            content: content,
            primaryText: 'Print',
            primaryAction: function() { window.printService(id); },
            secondaryText: 'Close',
            secondaryAction: window.closeCenteredModal,
            width: '480px'
        });
    };

    window.editService = function(id) {
        const svc = findServiceById(id);
        if (!svc) return;
        window.openServiceModal();
        document.getElementById('srv-id').value = svc.id;
        document.getElementById('cust-name').value = svc.customer || '';
        document.getElementById('cust-phone').value = svc.phone || '';
        document.getElementById('cust-email').value = svc.email || '';
        document.getElementById('cust-address').value = svc.address || '';
        document.getElementById('srv-type').value = svc.type || 'Repair';
        document.getElementById('srv-priority').value = svc.priority || 'Low';
        document.getElementById('srv-status').value = svc.status || 'Requested';
        document.getElementById('del-status').value = svc.delivery || 'Pending';
        document.getElementById('del-driver').value = svc.staff || '';
        document.getElementById('srv-cost').value = svc.cost || 0;
        if (document.getElementById('srv-notes')) document.getElementById('srv-notes').value = svc.notes || '';
        document.getElementById('srv-eta').value = formatEtaForInput(svc.eta);
        const title = serviceModal.querySelector('.modal-header h3');
        if (title) title.textContent = 'Edit Service';
    };

    window.printService = function(id) {
        const svc = findServiceById(id);
        if (!svc) return;

        const detailsTableHtml = `
            <table style="width:100%; border-collapse:collapse; margin-bottom: 30px;">
                ${[
                    { l: 'Service ID', v: '#'+svc.id },
                    { l: 'Customer Name', v: svc.customer },
                    { l: 'Service Type', v: svc.type },
                    { l: 'Priority Level', v: svc.priority },
                    { l: 'Current Status', v: svc.status },
                    { l: 'Delivery Status', v: svc.delivery },
                    { l: 'Assigned Staff', v: svc.staff },
                    { l: 'Estimated Cost', v: 'LKR ' + parseFloat(svc.cost || 0).toLocaleString() },
                    { l: 'Scheduled ETA', v: svc.eta ? new Date(svc.eta).toLocaleString() : 'Not Scheduled' }
                ].map(item => `
                    <tr>
                        <td style="padding: 12px 0; color: #64748b; width: 35%; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem;">${item.l}</td>
                        <td style="padding: 12px 0; font-weight: 700; text-align: right; color: #1e293b; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem;">${item.v}</td>
                    </tr>
                `).join('')}
            </table>
        `;

        window.openPrintPreviewModal({
            reportTitle: `Service Record - #${svc.id}`,
            headline: 'Service Details',
            subHeadline: `Customer: ${svc.customer} | Type: ${svc.type}`,
            contentHtml: `
                <div style="padding: 0 5px;">
                    <h3 style="font-size: 0.85rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">Operational Summary</h3>
                    ${detailsTableHtml}
                    <div style="margin-top: 20px; padding: 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #f1f5f9;">
                        <h4 style="margin: 0 0 10px 0; font-size: 0.8rem; color: #64748b; text-transform: uppercase;">Service Notes</h4>
                        <p style="margin: 0; color: #475569; font-size: 0.95rem; line-height: 1.6;">${svc.notes || 'No additional notes provided for this service record.'}</p>
                    </div>
                </div>
            `,
            width: '850px'
        });
    };


    window.closeModal = window.closeServiceModal = function() {
        if(serviceModal) serviceModal.classList.remove('show');
    };

    if (serviceForm) {
        serviceForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const id = document.getElementById('srv-id').value;
            const existingService = id ? findServiceById(id) : null;

            const custName = document.getElementById('cust-name').value.trim();
            const custPhone = document.getElementById('cust-phone').value.trim();
            const custEmail = document.getElementById('cust-email').value.trim();

            if (!custName) {
                showToast('Customer Name is required', 'error');
                return;
            }

            if (custPhone && !Utils.validatePhone(custPhone)) {
                showToast('Please enter a valid Sri Lankan phone number', 'error');
                return;
            }

            if (custEmail && !Utils.validateEmail(custEmail)) {
                showToast('Please enter a valid email address', 'error');
                return;
            }

            const rawCost = parseFloat(document.getElementById('srv-cost').value);
            const selectedStaff = document.getElementById('del-driver').value || 'Unassigned';
            const statusValue = document.getElementById('srv-status').value;
            const hasAssignedStaff = selectedStaff && selectedStaff !== 'Unassigned';
            const stageFields = {
                assigned_at: hasAssignedStaff ? ((existingService && existingService.assigned_at) || getCurrentSqlDateTime()) : null,
                en_route_at: hasAssignedStaff && existingService ? existingService.en_route_at || null : null,
                on_site_at: hasAssignedStaff && existingService ? existingService.on_site_at || null : null,
                completed_at: statusValue === 'Completed'
                    ? ((existingService && existingService.completed_at) || getCurrentSqlDateTime())
                    : null
            };

            if (statusValue === 'Requested') {
                stageFields.en_route_at = null;
                stageFields.on_site_at = null;
                stageFields.completed_at = null;
            }

            const newSvc = buildServicePayload(existingService || {}, {
                id: id,
                customer: document.getElementById('cust-name').value,
                email: document.getElementById('cust-email').value || null,
                type: document.getElementById('srv-type').value,
                priority: document.getElementById('srv-priority').value,
                status: statusValue,
                delivery: document.getElementById('del-status').value,
                staff: selectedStaff,
                cost: isNaN(rawCost) ? 0 : rawCost,

                notes: document.getElementById('srv-notes') ? document.getElementById('srv-notes').value : '',
                eta: document.getElementById('srv-eta').value || null,
                date: new Date().toISOString().split('T')[0],
                ...stageFields
            });
            const phoneEl = document.getElementById('cust-phone');
            if(phoneEl) newSvc.phone = phoneEl.value;
            const addrEl = document.getElementById('cust-address');
            if(addrEl) newSvc.address = addrEl.value;

            try {
                const response = await window.apiFetch('services.php?type=service', { method: 'POST', body: newSvc });
                showToast(id ? 'Service updated' : 'Service created');
                closeModal();

                const shouldSendAssignment = newSvc.staff && newSvc.staff !== 'Unassigned' &&
                    getStaffPhone(newSvc.staff) &&
                    (!existingService || existingService.staff !== newSvc.staff);

                if (shouldSendAssignment) {
                    const assignedId = response && response.id ? response.id : newSvc.id;
                    if (assignedId) {
                        await refreshServiceViews();
                        sendAssignmentNotifications(assignedId);
                        return;
                    }
                }

                await refreshServiceViews();
            } catch(err) {
                showToast(err.message, 'error');
            }
        });
    }

    // --- MODALS (WARRANTY) ---
    const warrantyModal = document.getElementById('warranty-modal');
    const warrantyForm = document.getElementById('warranty-form');

    window.openWarrantyModal = function() {
        if (warrantyModal) {
            warrantyModal.classList.add('show');
            if (warrantyForm) warrantyForm.reset();
            const title = warrantyModal.querySelector('.modal-header h3');
            if (title) title.textContent = 'Register New Warranty';
            document.getElementById('wrn-id').value = '';
        }
    };

    window.viewWarranty = function(id) {
        const wrn = warranties.find(item => item.id === id);
        if (!wrn) return;
        
        const content = `
            <div style="color: #1e293b; max-width: 420px; margin: 0 auto;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #f1f5f9;">
                    <div style="width: 48px; height: 48px; border-radius: 12px; background: #fffbeb; color: #b45309; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                        <i class="fa-solid fa-shield-halved"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Warranty Record</div>
                        <div style="font-size: 1.1rem; font-weight: 800; color: #0f172a;">#${wrn.id}</div>
                    </div>
                    <div style="margin-left: auto;">
                        <span style="display:inline-block; padding:4px 12px; border-radius:8px; font-size:0.75rem; font-weight:700; background:#f1f5f9; color:#475569; border:1px solid #e2e8f0;">${wrn.status || 'Active'}</span>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 16px;">
                    <div style="display: flex; gap: 12px; align-items: flex-start;">
                        <i class="fa-solid fa-box" style="color: #94a3b8; width: 16px; margin-top: 4px;"></i>
                        <div>
                            <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 2px;">Product Item</div>
                            <div style="font-size: 0.95rem; font-weight: 700; color: #1e293b;">${wrn.product}</div>
                            <div style="font-size: 0.8rem; color: #3b82f6; font-family: monospace; margin-top: 2px;">${wrn.serial_number || wrn.sn}</div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div style="display: flex; gap: 12px; align-items: flex-start;">
                            <i class="fa-solid fa-user" style="color: #94a3b8; width: 16px; margin-top: 4px;"></i>
                            <div>
                                <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 2px;">Customer</div>
                                <div style="font-size: 0.9rem; color: #475569;">${wrn.customer}</div>
                            </div>
                        </div>
                        <div style="display: flex; gap: 12px; align-items: flex-start;">
                            <i class="fa-solid fa-calendar-check" style="color: #94a3b8; width: 16px; margin-top: 4px;"></i>
                            <div>
                                <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 2px;">Cycle</div>
                                <div style="font-size: 0.9rem; color: #475569;">${wrn.cycle || 'N/A'}</div>
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 12px; align-items: flex-start; padding: 12px; background: #fffbeb; border-radius: 10px; border: 1px solid #fef3c7;">
                        <i class="fa-solid fa-clock-rotate-left" style="color: #b45309; width: 16px; margin-top: 4px;"></i>
                        <div>
                            <div style="font-size: 0.7rem; color: #92400e; text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">Next Scheduled Service</div>
                            <div style="font-weight: 800; color: #92400e; font-size: 1rem;">${wrn.next_service || wrn.nextService || 'Check manual'}</div>
                        </div>
                    </div>
                </div>
            </div>`;

        window.showCenteredModal({
            title: `Warranty Coverage`,
            content: content,
            primaryText: 'Print',
            primaryAction: function() { window.printWarranty(id); },
            secondaryText: 'Close',
            secondaryAction: window.closeCenteredModal,
            width: '480px'
        });
    };

    window.editWarranty = function(id) {
        const wrn = warranties.find(item => item.id === id);
        if (!wrn) return;
        window.openWarrantyModal();
        document.getElementById('wrn-id').value = wrn.id;
        document.getElementById('wrn-sn').value = wrn.serial_number || wrn.sn || '';
        document.getElementById('wrn-product').value = wrn.product || '';
        document.getElementById('wrn-customer').value = wrn.customer || '';
        document.getElementById('wrn-cycle').value = wrn.cycle || wrn.cycle || '6 Months';
        const title = warrantyModal.querySelector('.modal-header h3');
        if (title) title.textContent = 'Edit Warranty';
    };

    window.printWarranty = function(id) {
        const wrn = warranties.find(item => item.id === id);
        if (!wrn) return;

        const detailsTableHtml = `
            <table style="width:100%; border-collapse:collapse; margin-bottom: 30px;">
                ${[
                    { l: 'Warranty ID', v: '#'+wrn.id },
                    { l: 'Serial Number', v: wrn.serial_number || wrn.sn },
                    { l: 'Product Item', v: wrn.product },
                    { l: 'Registered Customer', v: wrn.customer },
                    { l: 'Service Cycle', v: wrn.cycle || 'Standard' },
                    { l: 'Next Service Due', v: wrn.next_service || wrn.nextService || 'TBD' },
                    { l: 'Status', v: wrn.status || 'Active' }
                ].map(item => `
                    <tr>
                        <td style="padding: 14px 0; color: #64748b; width: 35%; border-bottom: 1px solid #f1f5f9; font-size: 0.95rem;">${item.l}</td>
                        <td style="padding: 14px 0; font-weight: 700; text-align: right; color: #0f172a; border-bottom: 1px solid #f1f5f9; font-size: 0.95rem;">${item.v}</td>
                    </tr>
                `).join('')}
            </table>
        `;

        window.openPrintPreviewModal({
            reportTitle: `Warranty Record - #${wrn.id}`,
            headline: 'Warranty Details',
            subHeadline: `Product: ${wrn.product} | S/N: ${wrn.serial_number || wrn.sn}`,
            contentHtml: `
                <div style="padding: 0 5px;">
                    <div style="background: #f8fafc; border-radius: 15px; padding: 25px; border: 1px solid #f1f5f9; margin-bottom: 25px;">
                        <h3 style="font-size: 0.85rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Verification Details</h3>
                        ${detailsTableHtml}
                    </div>
                </div>
            `,
            width: '850px'
        });
    };

    window.closeWarrantyModal = function() {
        if (warrantyModal) warrantyModal.classList.remove('show');
    };

    if (warrantyForm) {
        warrantyForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const newWrn = {
                id: document.getElementById('wrn-id').value || null,
                sn: document.getElementById('wrn-sn').value,
                product: document.getElementById('wrn-product').value,
                customer: document.getElementById('wrn-customer').value,
                cycle: document.getElementById('wrn-cycle').value || '6 Months', 
                status: 'Active'
            };

            try {
                await window.apiFetch('services.php?type=warranty', { method: 'POST', body: newWrn });
                showToast(newWrn.id ? 'Warranty updated' : 'Warranty created');
                closeWarrantyModal();
                loadWarranties();
            } catch(err) {
                showToast(err.message, 'error');
            }
        });
    }

    // --- MODALS (STAFF) ---
    window.addNewStaff = async function() {
        const name = document.getElementById('new-staff-name').value;
        if(name) {
            try {
                await window.apiFetch('services.php?type=staff', { 
                    method: 'POST', 
                    body: { name: name, role: 'Technician', status: 'Active' } 
                });
                showToast('Staff added');
                fetchStaff();
                window.closeAddStaff();
            } catch(err) {
                showToast(err.message, 'error');
            }
        }
    };

    // --- ACTIONS ---
    window.deleteService = async function(id) {
        if(await window.Utils.showConfirm('Are you sure you want to delete this service record?')) {
            try {
                await window.apiFetch(`services.php?type=service&id=${id}`, { method: 'DELETE' });
                showToast('Service deleted');
                await refreshServiceViews();
            } catch(e) { showToast(e.message, 'error'); }
        }
    };

    window.deleteWarranty = async function(id) {
        if(await window.Utils.showConfirm('Delete warranty record?')) {
            try {
                await window.apiFetch(`services.php?type=warranty&id=${id}`, { method: 'DELETE' });
                showToast('Warranty deleted');
                loadWarranties();
            } catch(e) { showToast(e.message, 'error'); }
        }
    };

    document.addEventListener('visibilitychange', function() {
        if (!document.hidden && isDispatchBoardVisible() && currentPerformanceView === 'dispatch') {
            loadRouteBoard();
        }
    });

    applyServicesPageView(getRequestedServicesPage(), getRequestedPerformancePanel());
    fetchStaff();
    loadServices();
    loadPerformanceMetrics();
});
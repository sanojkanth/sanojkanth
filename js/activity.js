document.addEventListener('DOMContentLoaded', function() {
    let logs = [];
    let currentPage = 1;
    const itemsPerPage = 8;

    // Format Exact Date
    function formatExactDate(dateStr) {
        if (!dateStr) return '-';
        if (window.Utils && typeof window.Utils.formatDate === 'function') {
            return window.Utils.formatDate(dateStr);
        }
        return dateStr;
    }

    // Format Exact Time
    function formatExactTime(dateTimeStr) {
        if (!dateTimeStr) return null;
        const normalized = dateTimeStr.toString().replace(' ', 'T');
        const value = new Date(normalized);
        if (Number.isNaN(value.getTime())) return null;
        return value.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    }

    // Get Login Display
    function getLoginDisplay(log) {
        const exactTime = formatExactTime(log.created_at);
        return exactTime || log.login_time || '-';
    }

    // Get Logout Display
    function getLogoutDisplay(log) {
        if (log.logout_at) {
            const exactTime = formatExactTime(log.logout_at);
            if (exactTime) return exactTime;
        }
        if (log.logout_time === '---' || !log.logout_time) return '-';
        return log.logout_time;
    }

    // Load Activity Data
    async function loadActivityData() {
        try {
            const searchInput = document.getElementById('activity-search');
            let url = 'activity.php';
            if (searchInput && searchInput.value) {
                url += '?search=' + encodeURIComponent(searchInput.value.trim());
            }

            const data = await window.apiFetch(url, { method: 'GET' });
            if (data.success) {
                logs = data.data;
                renderActivityTable();
                updateStats();
            }
        } catch (e) {
            console.error('Failed to load activity data', e);
        }
    }

    // Render Activity Table
    function renderActivityTable() {
        const tbody = document.getElementById('activity-table-body');
        const paginationContainer = document.getElementById('activity-pagination');
        if(!tbody) return;

        if (!logs.length) {
            if (paginationContainer) paginationContainer.innerHTML = '';
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 30px;" class="text-dimmed">No activity logs found.</td></tr>';
            return;
        }

        const paginated = window.Utils.paginate(logs, currentPage, itemsPerPage);
        currentPage = paginated.currentPage;

        tbody.innerHTML = paginated.items.map((log, idx) => {
            const user = log.user || 'Unknown';
            const action = log.action || '-';
            const details = log.details || '-';
            const logDate = formatExactDate(log.log_date);
            const loginTime = getLoginDisplay(log);
            const logoutTime = getLogoutDisplay(log);
            
            let status = log.status || 'Closed';
            // Duration
            let duration = (log.duration === '---' || !log.duration) ? '-' : log.duration;
            
            // Handle active sessions
            if (status === 'Active' && (action === 'User Login' || action === 'Login')) {
                duration = log.duration || 'Running...';
            }
            
            const statusClass = status === 'Active' ? 'complete' : 'pending';
            // Row Index
            const rowIndex = (currentPage - 1) * itemsPerPage + (idx + 1);

            return `
            <tr class="fadeIn">
                <td class="text-xs text-dimmed">${rowIndex}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="user-avatar-placeholder" style="width: 34px; height: 34px;">
                            <i class="fa-solid fa-user"></i>
                        </div>
                        <strong class="item-name">${user}</strong>
                    </div>
                </td>
                <td style="font-weight: 500;">${action}</td>
                <td class="text-muted-alt" style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${details}">${details}</td>
                <td class="text-muted-alt">${logDate}</td>
                <td class="text-muted-alt">${loginTime}</td>
                <td class="text-muted-alt">${logoutTime}</td>
                <td><span style="font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;" class="pass-field">${duration}</span></td>
                <td><span class="status ${statusClass}" style="font-size: 0.7rem; padding: 4px 10px; font-weight: 700;">${status.toUpperCase()}</span></td>
            </tr>
        `}).join('');

        window.Utils.renderPagination('activity-pagination', paginated, (newPage) => {
            currentPage = newPage;
            renderActivityTable();
        });
    }

    window.searchActivity = function() {
        currentPage = 1;
        loadActivityData();
    };

    const activitySearch = document.getElementById('activity-search');
    if(activitySearch) {
        let debounceTimer;
        activitySearch.addEventListener('input', function() {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                currentPage = 1;
                loadActivityData();
            }, 300);
        });
    }

    // Update Stats
    async function updateStats() {
        try {
            const data = await window.apiFetch('activity.php?action=stats', { method: 'GET' });
            if (data.success) {
                const activeEl = document.getElementById('active-sessions');
                const loginEl = document.getElementById('total-logins');
                const entryEl = document.getElementById('log-entries');

                if(activeEl) activeEl.innerText = data.data.active;
                if(loginEl) loginEl.innerText = data.data.loginsToday;
                if(entryEl) entryEl.innerText = data.data.total;
            }
        } catch (e) {
            console.error('Failed to load activity stats', e);
        }
    }

    window.exportActivity = function() {
        if (logs.length === 0) {
            alert('No activity data to export.');
            return;
        }

        window.ExportUtils.toExcel({
            fileName: 'activity_login_report.xls',
            sheetName: 'Activity',
            headers: ['User', 'Date', 'Login Time', 'Logout Time', 'Duration', 'Status'],
            rows: logs.map(l => [
                l.user || '',
                formatExactDate(l.log_date),
                getLoginDisplay(l),
                getLogoutDisplay(l),
                l.duration || '',
                l.status || ''
            ])
        });
    };

    window.clearActivity = async function() {
        if(await window.Utils.showConfirm("Clear all activity history?")) {
            try {
                await window.apiFetch('activity.php', { method: 'DELETE' });
                showToast('Activity logs cleared');
                loadActivityData();
            } catch (e) {
                showToast(e.message, 'error');
            }
        }
    };


    loadActivityData();
});
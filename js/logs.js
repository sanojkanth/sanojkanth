document.addEventListener('DOMContentLoaded', () => {
    let logs = [];
    let currentPage = 1;
    const itemsPerPage = 8;

    // Load Logs
    async function loadLogs() {
        const query = document.getElementById('log-search')?.value.trim() || '';
        let url = 'activity.php';
        if (query) url += `?search=${encodeURIComponent(query)}`;

        try {
            const res = await window.apiFetch(url);
            if (res && res.success) {
                logs = res.data;
                renderLogs(logs);
            }
        } catch(e) {
            console.error(e);
            renderLogs([]);
        }
    }

    // Render Logs
    function renderLogs(data) {
        const tableBody = document.getElementById('logs-table-body');
        const totalLogsEl = document.getElementById('total-logs');
        const paginationContainer = document.getElementById('logs-pagination');

        if(totalLogsEl) totalLogsEl.textContent = data.length;
        if(!tableBody) return;
        tableBody.innerHTML = '';

        if(data.length === 0) {
            if (paginationContainer) paginationContainer.innerHTML = '';
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;" class="text-dimmed">No activity logs found</td></tr>';
            return;
        }

        const paginated = window.Utils.paginate(data, currentPage, itemsPerPage);
        currentPage = paginated.currentPage;

        paginated.items.forEach(log => {
            const row = document.createElement('tr');
            const dateStr = log.log_date ? `${log.log_date} ${log.login_time || ''}` : '-';
            row.innerHTML = `
                <td style="white-space: nowrap;">${dateStr}</td>
                <td><strong>${log.user}</strong></td>
                <td><span class="badge ${getActionClass(log.action)}">${log.action}</span></td>
                <td><code>${log.status || '-'}</code></td>
                <td>${log.details || '-'}</td>
            `;
            tableBody.appendChild(row);
        });

        window.Utils.renderPagination('logs-pagination', paginated, (newPage) => {
            currentPage = newPage;
            renderLogs(logs);
        });
    }

    // Get Action Class
    function getActionClass(action) {
        if (!action) return '';
        if (action.includes('Delete') || action.includes('Remove')) return 'status-cancelled';
        if (action.includes('Create') || action.includes('Add')) return 'status-completed';
        if (action.includes('Update') || action.includes('Edit')) return 'status-pending';
        return '';
    }

    let searchTimer;
    window.filterLogs = function() {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            currentPage = 1;
            loadLogs();
        }, 300);
    }

    const searchInput = document.getElementById('log-search');
    if(searchInput) {
        searchInput.addEventListener('input', window.filterLogs);
    }

    window.clearLogs = async function() {
        if (await window.Utils.showConfirm('Are you sure you want to clear all activity logs? This action cannot be undone.')) {
            try {
                await window.apiFetch('activity.php', { method: 'DELETE' });
                showToast('Activity logs cleared');
                loadLogs();
            } catch(e) { showToast(e.message, 'error'); }
        }
    }

    window.exportLogs = function() {
        if (logs.length === 0) return alert('No logs to export');

        window.ExportUtils.toExcel({
            fileName: `activity_logs_${new Date().toISOString().split('T')[0]}.xls`,
            sheetName: 'Activity Logs',
            headers: ['Timestamp', 'User', 'Action', 'Status', 'Details'],
            rows: logs.map(log => [
                `${log.log_date || ''} ${log.login_time || ''}`.trim(),
                log.user || '',
                log.action || '',
                log.status || '',
                log.details || ''
            ])
        });
    }

    loadLogs();
});
/**
 * Account / Settings Page Logic
 * Only ADMIN users can save settings.
 * All other roles can view but not edit.
 */
document.addEventListener('DOMContentLoaded', async function () {

    // ── Default fallback values ──────────────────────────────────────────
    const DEFAULT_SETTINGS = {
        storeName:      'Central Hardwares',
        location:       'Jaffna, Main St.',
        email:          'info@centralhardwares.lk',
        phone:          '+94 77 123 4567',
        currency:       'LKR',
        taxRate:        0,
        stockThreshold: 15,
        expenseApprovalThreshold: 50000
    };

    // ── Detect current user role from session ────────────────────────────
    let isAdmin = false;

    try {
        const sessionRes = await window.apiFetch('auth.php?action=check', { method: 'GET' });
        if (sessionRes && sessionRes.success && sessionRes.user) {
            // Role
            const role = (sessionRes.user.role || '').toLowerCase();
            isAdmin = (role === 'admin');
            // Also update "Hi, Admin" label in header
            const adminLink = document.querySelector('.admin-link strong');
            if (adminLink) adminLink.textContent = 'Hi, ' + (sessionRes.user.name || 'User');
        }
    } catch (e) {
        // If the session check fails, fall back to localStorage cache
        try {
            const cached = JSON.parse(localStorage.getItem('currentUser') || '{}');
            isAdmin = (cached.role || '').toLowerCase() === 'admin';
        } catch (_) {}
    }

    // ── Show access banner ───────────────────────────────────────────────
    const banner = document.getElementById('accessBanner');
    const form   = document.getElementById('settingsForm');
    const body   = document.getElementById('settingsBody');

    if (banner) {
        banner.style.display = 'flex';
        if (isAdmin) {
            banner.className = 'settings-access-banner is-admin';
            banner.innerHTML = '<i class="fa-solid fa-shield-halved"></i> You are logged in as <strong>&nbsp;Admin&nbsp;</strong> — you can save settings.';
        } else {
            banner.className = 'settings-access-banner not-admin';
            banner.innerHTML = '<i class="fa-solid fa-lock"></i> <strong>View Only</strong> — only Admin users can change system settings.';
            // Disable the entire form for non-admin
            if (body) body.classList.add('settings-readonly-mode');
        }
    }

    // ── DOM references ───────────────────────────────────────────────────
    const storeNameInp  = document.getElementById('set-store-name');
    const locationInp   = document.getElementById('set-location');
    const emailInp      = document.getElementById('set-email');
    const phoneInp      = document.getElementById('set-phone');
    const currencyInp   = document.getElementById('set-currency');
    const taxRateInp    = document.getElementById('set-tax-rate');
    const thresholdInp  = document.getElementById('set-stock-threshold');
    const expenseThresholdInp = document.getElementById('set-expense-threshold');

    const downloadBackupBtn = document.getElementById('downloadBackupBtn');
    const restoreBackupBtn = document.getElementById('restoreBackupBtn');
    const restoreBackupInput = document.getElementById('restoreBackupInput');
    const backupStatusText = document.getElementById('backupStatusText');
    const newPasswordInp = document.getElementById('set-new-password');
    const confirmPasswordInp = document.getElementById('set-confirm-password');
    const changePasswordBtn = document.getElementById('changePasswordBtn');

    // Escape Html
    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Set Backup Status
    function setBackupStatus(message, tone = 'info') {
        if (!backupStatusText) return;
        backupStatusText.innerHTML = message;

        if (tone === 'error') {
            backupStatusText.style.borderColor = 'rgba(239, 68, 68, 0.25)';
            backupStatusText.style.background = 'rgba(239, 68, 68, 0.08)';
        } else if (tone === 'success') {
            backupStatusText.style.borderColor = 'rgba(34, 197, 94, 0.28)';
            backupStatusText.style.background = 'rgba(34, 197, 94, 0.08)';
        } else if (tone === 'warning') {
            backupStatusText.style.borderColor = 'rgba(245, 158, 11, 0.28)';
            backupStatusText.style.background = 'rgba(245, 158, 11, 0.08)';
        } else {
            backupStatusText.style.borderColor = '';
            backupStatusText.style.background = '';
        }
    }

    // Set Backup Buttons Disabled
    function setBackupButtonsDisabled(disabled) {
        if (downloadBackupBtn) downloadBackupBtn.disabled = disabled;
        if (restoreBackupBtn) restoreBackupBtn.disabled = disabled;
    }

    // ── Populate the form with loaded values ─────────────────────────────
    function populateForm(settings) {
        if (storeNameInp)  storeNameInp.value  = settings.storeName      || DEFAULT_SETTINGS.storeName;
        if (locationInp)   locationInp.value   = settings.location       || DEFAULT_SETTINGS.location;
        if (emailInp)      emailInp.value      = settings.email          || DEFAULT_SETTINGS.email;
        if (phoneInp)      phoneInp.value      = settings.phone          || DEFAULT_SETTINGS.phone;
        if (currencyInp)   currencyInp.value   = settings.currency       || DEFAULT_SETTINGS.currency;
        if (taxRateInp)    taxRateInp.value    = settings.taxRate        ?? DEFAULT_SETTINGS.taxRate;
        if (thresholdInp)  thresholdInp.value  = settings.stockThreshold ?? DEFAULT_SETTINGS.stockThreshold;
        if (expenseThresholdInp) expenseThresholdInp.value = settings.expenseApprovalThreshold ?? DEFAULT_SETTINGS.expenseApprovalThreshold;

    }

    // ── Load settings from API ───────────────────────────────────────────
    async function loadSettings() {
        try {
            const res = await window.apiFetch('settings.php');
            if (res && res.success && res.data) {
                populateForm({ ...DEFAULT_SETTINGS, ...res.data });
            } else {
                populateForm(DEFAULT_SETTINGS);
            }
        } catch (e) {
            console.warn('Could not load settings from API, using defaults.', e);
            populateForm(DEFAULT_SETTINGS);
        }
    }

    // ── Handle form submit (admin only) ──────────────────────────────────
    if (form) {
        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            if (!isAdmin) {
                showToast('Only Admin users can change system settings.', 'error');
                return;
            }

            const btn = document.getElementById('saveSettingsBtn');
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...'; }

            const payload = {
                storeName:      storeNameInp  ? storeNameInp.value.trim()        : DEFAULT_SETTINGS.storeName,
                location:       locationInp   ? locationInp.value.trim()         : DEFAULT_SETTINGS.location,
                email:          emailInp      ? emailInp.value.trim()            : DEFAULT_SETTINGS.email,
                phone:          phoneInp      ? phoneInp.value.trim()            : DEFAULT_SETTINGS.phone,
                currency:       currencyInp   ? currencyInp.value                : DEFAULT_SETTINGS.currency,
                taxRate:        taxRateInp    ? parseFloat(taxRateInp.value) || 0 : 0,
                stockThreshold: thresholdInp  ? parseInt(thresholdInp.value)  || 15 : 15,
                expenseApprovalThreshold: expenseThresholdInp ? parseFloat(expenseThresholdInp.value) || DEFAULT_SETTINGS.expenseApprovalThreshold : DEFAULT_SETTINGS.expenseApprovalThreshold
            };

            try {
                const res = await window.apiFetch('settings.php', { method: 'POST', body: payload });
                if (res && res.success) {
                    showToast('Settings saved successfully!', 'success');
                    // Refresh the in-memory settings cache used by other pages
                    if (window.Utils && window.Utils.loadSettings) {
                        await window.Utils.loadSettings();
                        if (window.updateGlobalCompanyUI) window.updateGlobalCompanyUI();
                    }
                } else {
                    showToast(res.error || 'Failed to save settings.', 'error');
                }
            } catch (err) {
                showToast(err.message || 'Error saving settings.', 'error');
            } finally {
                if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-check"></i> Save Settings'; }
            }
        });
    }

    if (downloadBackupBtn) {
        downloadBackupBtn.addEventListener('click', async function () {
            if (!isAdmin) {
                showToast('Only Admin users can download full backups.', 'error');
                return;
            }

            setBackupButtonsDisabled(true);
            setBackupStatus('<strong>Preparing backup...</strong> collecting current system data.', 'info');

            try {
                const res = await window.apiFetch('backup.php', { method: 'GET' });
                const backup = res.data || {};
                const exportedAt = backup.metadata && backup.metadata.exported_at
                    ? new Date(backup.metadata.exported_at).toLocaleString()
                    : new Date().toLocaleString();
                const safeTimestamp = exportedAt
                    .replace(/[/:,\s]/g, '-')
                    .replace(/-+/g, '-')
                    .replace(/^-|-$/g, '')
                    .toLowerCase();
                const fileName = `central-hardwares-backup-${safeTimestamp}.json`;

                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(url);

                const tableCount = Object.values((backup.metadata && backup.metadata.table_counts) || {})
                    .reduce((sum, count) => sum + Number(count || 0), 0);
                setBackupStatus(`<strong>Backup ready:</strong> exported ${tableCount} records on ${escapeHtml(exportedAt)}.`, 'success');
                showToast('Full backup downloaded.', 'success');
            } catch (err) {
                setBackupStatus(`<strong>Backup failed:</strong> ${escapeHtml(err.message || 'Could not generate backup file.')}`, 'error');
                showToast(err.message || 'Backup failed.', 'error');
            } finally {
                setBackupButtonsDisabled(false);
            }
        });
    }

    if (restoreBackupBtn) {
        restoreBackupBtn.addEventListener('click', function () {
            if (!isAdmin) {
                showToast('Only Admin users can restore backups.', 'error');
                return;
            }
            if (restoreBackupInput) restoreBackupInput.click();
        });
    }

    if (restoreBackupInput) {
        restoreBackupInput.addEventListener('change', async function () {
            const file = this.files && this.files[0];
            if (!file) return;

            try {
                const rawText = await file.text();
                const parsed = JSON.parse(rawText);
                const exportedAt = parsed.metadata && parsed.metadata.exported_at
                    ? new Date(parsed.metadata.exported_at).toLocaleString()
                    : 'Unknown time';
                // Exported By
                const exportedBy = (parsed.metadata && parsed.metadata.exported_by) || 'Unknown admin';
                const tableCount = Object.values((parsed.metadata && parsed.metadata.table_counts) || {})
                    .reduce((sum, count) => sum + Number(count || 0), 0);

                setBackupStatus(`<strong>Selected backup:</strong> ${escapeHtml(file.name)} with ${tableCount} records exported by ${escapeHtml(exportedBy)} on ${escapeHtml(exportedAt)}.`, 'warning');

                const confirmed = await window.Utils.showConfirm({
                    title: 'Restore Full Backup?',
                    message: 'This will replace the current system data on all pages with the selected backup file.',
                    okText: 'Restore Now',
                    cancelText: 'Cancel',
                    type: 'warning'
                });

                if (!confirmed) {
                    setBackupStatus('<strong>Restore cancelled.</strong> The current data was not changed.', 'info');
                    return;
                }

                setBackupButtonsDisabled(true);
                setBackupStatus('<strong>Restoring backup...</strong> current data is being replaced. Do not close this page.', 'warning');

                const res = await window.apiFetch('backup.php', {
                    method: 'POST',
                    body: { backup: parsed }
                });

                setBackupStatus(`<strong>Restore completed:</strong> ${escapeHtml(res.message || 'Backup restored successfully.')}`, 'success');
                showToast(res.message || 'Backup restored successfully.', 'success');

                if (window.Utils && window.Utils.loadSettings) {
                    await window.Utils.loadSettings();
                }
                if (window.updateGlobalCompanyUI) {
                    await window.updateGlobalCompanyUI();
                }

                setTimeout(() => window.location.reload(), 900);
            } catch (err) {
                setBackupStatus(`<strong>Restore failed:</strong> ${escapeHtml(err.message || 'Invalid backup file.')}`, 'error');
                showToast(err.message || 'Restore failed.', 'error');
            } finally {
                this.value = '';
                setBackupButtonsDisabled(false);
            }
        });
    }

    // ── Handle password change ───────────────────────────────────────────
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', async function () {
            // New Pass
            const newPass = (newPasswordInp?.value || '').trim();
            // Confirm Pass
            const confirmPass = (confirmPasswordInp?.value || '').trim();

            // Allow empty (user keeps current password)
            if (newPass === '' && confirmPass === '') {
                showToast('Please enter a new password or leave both fields blank to keep current password.', 'warning');
                return;
            }

            // If one is filled, both must be filled
            if ((newPass === '' && confirmPass !== '') || (newPass !== '' && confirmPass === '')) {
                showToast('Both password fields must be filled out to change password.', 'error');
                return;
            }

            // If both are filled, validate they match
            if (newPass !== '' && confirmPass !== '') {
                if (newPass !== confirmPass) {
                    showToast('Passwords do not match.', 'error');
                    return;
                }

                if (newPass.length < 6) {
                    showToast('Password must be at least 6 characters long.', 'error');
                    return;
                }

                // Call API to change password
                try {
                    changePasswordBtn.disabled = true;
                    changePasswordBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';

                    const res = await window.apiFetch('auth.php?action=change-password', {
                        method: 'POST',
                        body: { newPassword: newPass }
                    });

                    if (res && res.success) {
                        showToast('Password updated successfully!', 'success');
                        if (newPasswordInp) newPasswordInp.value = '';
                        if (confirmPasswordInp) confirmPasswordInp.value = '';
                    } else {
                        showToast(res.error || 'Failed to update password.', 'error');
                    }
                } catch (err) {
                    showToast(err.message || 'Error updating password.', 'error');
                } finally {
                    changePasswordBtn.disabled = false;
                    changePasswordBtn.innerHTML = '<i class="fa-solid fa-check"></i> Update Password';
                }
            }
        });
    }

    // Kick off
    loadSettings();
});
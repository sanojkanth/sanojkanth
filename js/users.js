(function() {
    let users = [];
    let tempImage = "";
    let currentUserPage = 1;
    const USERS_PER_PAGE = 15;
    let currentFilter = 'All Roles';

    // Load Users
    async function loadUsers() {
        renderUserTable([], true);
        try {
            const searchInput = document.getElementById('user-search');
            let query = searchInput ? searchInput.value.trim() : '';
            
            let url = `users.php?filter=${encodeURIComponent(currentFilter)}`;
            if (query) url += `&search=${encodeURIComponent(query)}`;

            const data = await window.apiFetch(url);
            if (data && data.success) {
                users = data.data;
                renderUserTable(users);
                updateUserStatsInline();
            }
        } catch(e) {
            console.error('Error fetching users', e);
            renderUserTable([]);
        }
    }

    // Update User Stats Inline
    async function updateUserStatsInline() {
        try {
            const data = await window.apiFetch('users.php?action=stats');
            if(data && data.success) {
                const s = data.data;
                // Set Txt
                const setTxt = (id, val) => { 
                    const el = document.getElementById(id);
                    if(el) window.animateStat ? window.animateStat(id, val) : (el.innerText = val); 
                };
                
                setTxt('nav-usr-total', s.total);
                setTxt('nav-usr-admins', s.admins);
                setTxt('nav-usr-staff', s.staff);
                setTxt('nav-usr-sessions', s.activeNow || 0);
            }
        } catch(e) {
            console.error('Stats update failed:', e);
        }
    }

    // Render User Table
    function renderUserTable(data = users, isLoading = false) {
        const tbody = document.getElementById('user-table-body');
        if(!tbody) return;

        tbody.innerHTML = "";

        if (isLoading) {
            for (let i = 0; i < 5; i++) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><div class="skeleton skeleton-text" style="width: 30px;"></div></td>
                    <td><div class="skeleton skeleton-avatar"></div></td>
                    <td><div class="skeleton skeleton-text" style="width: 100px;"></div></td>
                    <td><div class="skeleton skeleton-text" style="width: 60px;"></div></td>
                    <td><div class="skeleton skeleton-text" style="width: 80px;"></div></td>
                    <td><div class="skeleton skeleton-text" style="width: 60px;"></div></td>
                    <td><div class="skeleton skeleton-text" style="width: 120px;"></div></td>
                    <td><div class="skeleton skeleton-text" style="width: 50px;"></div></td>
                    <td><div class="skeleton skeleton-text" style="width: 70px;"></div></td>
                `;
                tbody.appendChild(tr);
            }
            return;
        }

        if (!data || data.length === 0) {
            tbody.innerHTML = "<tr><td colspan='9' style='text-align:center; padding: 40px;' class='text-dimmed'><i class='fa-solid fa-user-slash fa-3x mb-15' style='display:block;'></i>No users found</td></tr>";
            return;
        }

        const pageInfo = window.Utils ? Utils.paginate(data, currentUserPage, USERS_PER_PAGE) : {items: data, totalPages: 1};
        const pageData = pageInfo.items || data;

        pageData.forEach((u, idx) => {
            const tr = document.createElement('tr');
            tr.style.animation = "fadeIn 0.3s ease-in-out";
            
            const lastLog = u.last_login || u.lastLogin || 'Never';
            const status = lastLog !== 'Never' ? 'Active' : 'Inactive';

            // Row Index
            const rowIndex = (currentUserPage - 1) * USERS_PER_PAGE + (idx + 1);

            tr.innerHTML = `
                <td class="text-xs text-dimmed">${rowIndex}</td>
                <td>
                    ${u.image ? `<img src="${u.image}" class="user-avatar" style="width: 32px; height: 32px; border: 1px solid #ddd;">` : `<div class="user-avatar" style="width: 32px; height: 32px; font-size: 0.8rem; background: #2563eb; color: #fff; margin-right: 0;">${(u.username.charAt(0) || 'U').toUpperCase()}</div>`}
                </td>
                <td><strong class="item-name">${u.username}</strong><br><small class="text-dimmed">${u.email}</small></td>
                <td style="padding: 12px;"><span class="status ${status === 'Active' ? 'complete' : 'pending'}">${status}</span></td>
                <td><span class="pass-field">••••••••</span></td>
                <td><span class="category-badge ${getRoleBadgeClass(u.role)}">${u.role}</span></td>
                <td><span class="text-muted-alt" style="white-space: nowrap;">${lastLog}</span></td>
                <td><span class="text-dimmed">${u.duration || '-'}</span></td>
                <td>
                    <div class="action-btns">
                        <button type="button" class="btn-action btn-view" onclick="viewUser(${u.id})" title="View User"><i class="fa-regular fa-eye"></i></button>
                        <button type="button" class="btn-action btn-edit" onclick="editUser(${u.id})" title="Edit User"><i class="fa-regular fa-pen-to-square"></i></button>
                        <button type="button" class="btn-action btn-print" onclick="printUser(${u.id})" title="Print User"><i class="fa-solid fa-print"></i></button>
                        <button type="button" class="btn-action btn-delete" onclick="deleteUser(${u.id})" title="Delete User"><i class="fa-regular fa-trash-can"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        if (window.Utils && Utils.renderPagination) {
            Utils.renderPagination('users-pagination', pageInfo, function(page) {
                currentUserPage = page;
                renderUserTable(data);
            });
        }
    }

    // Get Role Badge Class
    function getRoleBadgeClass(role) {
        if(role === 'Admin') return 'completed';
        return 'pending';
    }

    window.openUserModal = function() {
        const modal = document.getElementById('user-modal');
        if(modal) {
            modal.classList.add('show');
            document.getElementById('modal-title').innerText = "Add New User";
            const form = document.getElementById('user-form');
            if(form) form.reset();
            document.getElementById('user-id').value = "";
            tempImage = "";
        }
    }

    window.closeModal = window.closeUserModal = function() {
        const modal = document.getElementById('user-modal');
        if(modal) modal.classList.remove('show');
    }

    window.resetUserData = function() {
        const searchInput = document.getElementById('user-search');
        if(searchInput) searchInput.value = "";
        currentFilter = 'All Roles';
        currentUserPage = 1;
        
        // Reset filter tabs
        document.querySelectorAll('.filter-tabs button').forEach(b => {
            if (b.textContent.trim().toUpperCase() === 'ALL') b.classList.add('active');
            else b.classList.remove('active');
        });
        
        loadUsers();
        if(typeof showToast === 'function') showToast('User list refreshed');
    }

    window.editUser = function(id) {
        const user = users.find(u => u.id == id);
        if(!user) return;

        const modal = document.getElementById('user-modal');
        if(modal) {
            modal.classList.add('show');
            document.getElementById('modal-title').innerText = "Edit User";
            document.getElementById('user-id').value = user.id;
            document.getElementById('username').value = user.username;
            document.getElementById('email').value = user.email;
            document.getElementById('phone').value = user.phone || "";
            document.getElementById('role').value = user.role;
            document.getElementById('password').value = ""; // Password optional for edit
            tempImage = user.image;
        }
    }

    window.deleteUser = async function(id) {
        if(await window.Utils.showConfirm("Delete this user?")) {
            try {
                await window.apiFetch(`users.php?id=${id}`, { method: 'DELETE' });
                showToast('User deleted');
                loadUsers();
                if(window.updateGlobalNavStats) window.updateGlobalNavStats();
            } catch(e) {
                showToast(e.message, 'error');
            }
        }
    }

    window.filterUsers = function(role, btn) {
        if (role === 'All') role = 'All Roles';
        currentFilter = role;
        currentUserPage = 1;
        
        if(btn) {
            document.querySelectorAll('.filter-tabs button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        } else {
            document.querySelectorAll('.filter-tabs button').forEach(b => {
                if (b.textContent.trim().toUpperCase() === role.toUpperCase() || 
                   (role === 'All' && b.textContent.trim() === 'ALL ROLES') || 
                   (role === 'All Roles' && b.textContent.trim() === 'ALL ROLES')) {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });
        }
        
        loadUsers();
    }

    let searchTimeout;
    window.searchUsers = function() {
        clearTimeout(searchTimeout);
        currentUserPage = 1;
        searchTimeout = setTimeout(loadUsers, 300);
    }

    window.exportUsers = function() {
        if (users.length === 0) return alert("No data to export");

        window.ExportUtils.toExcel({
            fileName: `users_export_${new Date().toISOString().split('T')[0]}.xls`,
            sheetName: 'Users',
            headers: ['ID', 'Username', 'Email', 'Role', 'Last Login', 'Duration'],
            rows: users.map(u => [
                Number(u.id) || u.id || '',
                u.username || '',
                u.email || '',
                u.role || '',
                u.last_login || u.lastLogin || '',
                u.duration || ''
            ])
        });
    }

    window.viewUser = function(id) {
        const user = users.find(u => u.id == id);
        if(!user) return;
        
        const imgHtml = user.image 
            ? `<div style="text-align:center;margin-bottom:20px;"><img src="${user.image}" alt="${user.username}" style="width:120px;height:120px;object-fit:cover;border-radius:50%;border:4px solid #f1f5f9;box-shadow: 0 4px 10px rgba(0,0,0,0.1);"></div>` 
            : `<div style="width:120px;height:120px;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:3rem;margin: 0 auto 20px auto;box-shadow: 0 4px 10px rgba(0,0,0,0.1); border: 4px solid #f1f5f9;">${(user.username.charAt(0) || 'U').toUpperCase()}</div>`;

        const content = `
            <div style="color: #1e293b; max-width: 440px; margin: 0 auto; padding: 0 10px;">
                <div style="display: flex; flex-direction: column; align-items: center; margin-bottom: 28px;">
                    <div style="position: relative;">
                        ${imgHtml}
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 20px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: flex-start;">
                        <div style="display: flex; gap: 14px; align-items: flex-start;">
                            <div style="width: 20px; display: flex; justify-content: center; margin-top: 3px;">
                                <i class="fa-solid fa-id-badge" style="color: #94a3b8; font-size: 1.1rem;"></i>
                            </div>
                            <div>
                                <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 2px; letter-spacing: 0.3px;">User ID</div>
                                <div style="font-size: 1rem; font-weight: 700; color: #1e293b;">#${user.id}</div>
                            </div>
                        </div>
                        <div style="text-align: right;">
                             <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 4px; letter-spacing: 0.3px;">Role</div>
                             <span class="category-badge ${getRoleBadgeClass(user.role)}" style="padding: 4px 12px; border-radius: 6px; font-weight: 700; font-size: 0.7rem; display: inline-block;">${user.role}</span>
                        </div>
                    </div>

                    <div style="display: flex; gap: 14px; align-items: flex-start;">
                        <div style="width: 20px; display: flex; justify-content: center; margin-top: 3px;">
                            <i class="fa-solid fa-user-check" style="color: #94a3b8; font-size: 1rem;"></i>
                        </div>
                        <div>
                            <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 2px; letter-spacing: 0.3px;">Account Name</div>
                            <div style="font-size: 1.1rem; font-weight: 800; color: #0f172a;">${user.username}</div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 14px; align-items: flex-start;">
                        <div style="width: 20px; display: flex; justify-content: center; margin-top: 3px;">
                            <i class="fa-solid fa-at" style="color: #94a3b8; font-size: 1rem;"></i>
                        </div>
                        <div>
                            <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 2px; letter-spacing: 0.3px;">Email Address</div>
                            <div style="font-size: 0.95rem; font-weight: 600; color: #475569;">${user.email}</div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 14px; align-items: flex-start;">
                        <div style="width: 20px; display: flex; justify-content: center; margin-top: 3px;">
                            <i class="fa-solid fa-phone" style="color: #94a3b8; font-size: 1rem;"></i>
                        </div>
                        <div>
                            <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 2px; letter-spacing: 0.3px;">Mobile Number</div>
                            <div style="font-size: 0.95rem; font-weight: 600; color: #475569;">${user.phone || 'None'}</div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background:#f8fafc; border-radius:14px; padding:16px; border:1px solid #f1f5f9; margin-top:8px;">
                        <div>
                            <div style="font-size: 0.65rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 6px; letter-spacing: 0.5px;">Last Activity</div>
                            <div style="font-size: 0.85rem; font-weight: 800; color: #334155;">${user.last_login || user.lastLogin || 'Never'}</div>
                        </div>
                        <div style="border-left: 1px solid #e2e8f0; padding-left: 16px;">
                            <div style="font-size: 0.65rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 6px; letter-spacing: 0.5px;">Session Status</div>
                            <div style="font-size: 0.85rem; font-weight: 800; color: #334155;">${user.duration || 'N/A'}</div>
                        </div>
                    </div>
                </div>
            </div>`;

        window.showCenteredModal({
            title: `User Profile`,
            content: content,
            primaryText: 'Print',
            primaryAction: function() { window.printUser(id); },
            secondaryText: 'Close',
            secondaryAction: window.closeCenteredModal,
            width: '480px'
        });
    };

    window.printUser = function(id) {
        const user = users.find(u => u.id == id);
        if(!user) return;

        const imgHtml = user.image 
            ? `<img src="${user.image}" style="width:120px;height:120px;object-fit:cover;border-radius:50%; border: 3px solid #fbbc04;">` 
            : `<div style="width:120px;height:120px;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:3rem; border: 3px solid #fbbc04;">${(user.username.charAt(0) || 'U').toUpperCase()}</div>`;

        const content = `
            <div style="padding:0 12px;color:#1f2937;">
                <div style="text-align:center;margin-bottom:30px;">
                    <div style="margin-bottom:15px; display:inline-block;">${imgHtml}</div>
                    <h2 style="margin:0; font-size: 1.8rem; letter-spacing: -0.02em;">${user.username}</h2>
                    <p style="margin:8px 0 0 0;color:#64748b; font-weight: 500;">Account ID #${user.id} | ${user.role}</p>
                </div>
                <table style="width:100%;border-collapse:collapse;">
                    ${['User ID','Username','Email','Mobile Number','Role','Last Login','Session Duration'].map((label, idx) => {
                        const keys = ['id','username','email','phone','role','last_login','duration'];
                        const value = user[keys[idx]] || (label === 'Last Login' ? 'Never' : 'N/A');
                        return `
                            <tr style="border-top:1px solid #f1f5f9;">
                                <td style="padding:14px 8px;color:#64748b;width:35%; font-size: 0.9rem;">${label}</td>
                                <td style="padding:14px 8px;font-weight:700;text-align:right; color: #0f172a;">${label === 'User ID' ? '#'+value : value}</td>
                            </tr>`;
                    }).join('')}
                </table>
            </div>
        `;

        window.openPrintPreviewModal({
            reportTitle: `Staff Profile - ${user.username}`,
            headline: 'User Details',
            contentHtml: content,
            width: '850px'
        });
    }

    window.closeViewUserModal = function() {
        const viewModal = document.getElementById('view-user-modal');
        if(viewModal) viewModal.classList.remove('show');
    }

    // Add event listeners for view modal
    document.addEventListener('DOMContentLoaded', function() {
        const closeViewBtn = document.querySelector('.close-view-btn');
        if(closeViewBtn) closeViewBtn.addEventListener('click', window.closeViewUserModal);
        window.addEventListener('click', (e) => {
            const viewModal = document.getElementById('view-user-modal');
            if(viewModal && e.target == viewModal) window.closeViewUserModal();
        });
    });

    document.addEventListener('DOMContentLoaded', function() {
        const searchInput = document.getElementById('user-search');
        if(searchInput) {
            searchInput.addEventListener('input', window.searchUsers);
        }

        const fileInput = document.getElementById('user-image');
        if(fileInput) {
            fileInput.addEventListener('change', function(e) {
                if (e.target.files && e.target.files[0]) {
                    const reader = new FileReader();
                    reader.onload = function(evt) {
                        const img = new Image();
                        img.onload = function() {
                            const canvas = document.createElement('canvas');
                            const MAX = 400; // Smaller profile picture
                            let w = img.width, h = img.height;
                            if (w > h) { if (w > MAX) { h *= MAX/w; w = MAX; } }
                            else { if (h > MAX) { w *= MAX/h; h = MAX; } }
                            canvas.width = w; canvas.height = h;
                            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                            tempImage = canvas.toDataURL('image/jpeg', 0.8);
                        };
                        img.src = evt.target.result;
                    };
                    reader.readAsDataURL(e.target.files[0]);
                }
            });
        }

        const closeBtn = document.querySelector('.close-btn');
        if(closeBtn) closeBtn.onclick = closeModal;

        const form = document.getElementById('user-form');
        if(form) {
            form.addEventListener('submit', async function(e) {
                e.preventDefault();
                const id = document.getElementById('user-id').value;
                const emailVal = document.getElementById('email').value;
                const enteredPassword = document.getElementById('password').value;

                if (window.Utils && !Utils.validateEmail(emailVal)) {
                    showToast('Please enter a valid email address', 'error');
                    return;
                }

                if(!id && (!enteredPassword || enteredPassword.trim() === '')) {
                    showToast('Password is required for new users', 'error');
                    return;
                }

                const data = {
                    id: id || null,
                    username: document.getElementById('username').value,
                    email: emailVal,
                    phone: document.getElementById('phone').value,
                    role: document.getElementById('role').value,
                    image: tempImage || null
                };

                if (enteredPassword) {
                    data.password = enteredPassword;
                }

                try {
                    await window.apiFetch('users.php', { method: 'POST', body: data });
                    const isEdit = id ? true : false;
                    showToast(isEdit ? 'User updated successfully' : 'User created successfully');
                    closeModal();
                    loadUsers();
                    if(window.updateGlobalNavStats) window.updateGlobalNavStats();
                    // Refresh header dropdown if the user updated themselves or to show new users
                    if (window.renderUsersDropdown) window.renderUsersDropdown();
                } catch(err) {
                    showToast(err.message, 'error');
                }
            });
        }

        loadUsers();
    });
})();
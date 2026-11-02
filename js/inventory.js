document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 INVENTORY SYSTEM LOADED v1.4 - ' + new Date().toLocaleString());
    let products = [];
    let currentFilter = 'all';
    let currentSort = { property: 'id', order: 'asc' };
    let currentPage = 1;
    let itemsPerPage = 6;

    const tableBody = document.getElementById('inventory-table-body');
    const searchInput = document.getElementById('inventory-search');
    const modal = document.getElementById('product-modal');
    const addBtn = document.getElementById('add-product-btn');
    const closeBtn = document.querySelector('.close-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const productForm = document.getElementById('product-form');
    const modalTitle = document.getElementById('modal-title');

    // Load Products
    async function loadProducts(page = 1) {
        currentPage = page;
        renderTable([], true);
        try {
            let url = `products.php?filter=${currentFilter}&sort=${currentSort.property}&order=${currentSort.order}&t=${Date.now()}`;
            if (searchInput && searchInput.value) {
                url += `&search=${encodeURIComponent(searchInput.value.trim())}`;
            }
            const data = await window.apiFetch(url, { method: 'GET' });
            if (data.success) {
                products = data.data;
                console.log(`Loaded ${products.length} products`);
                renderTable(products);
                updateStats(); // Also update stats whenever table reloads
            }
        } catch (e) {
            console.error('Failed to load products', e);
            renderTable([]);
        }
        updateStats();
    }

    // --- RENDER TABLE ---
    function renderTable(data = products, isLoading = false) {
        if (!tableBody) return;
        tableBody.innerHTML = "";

        if (isLoading) {
             tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 20px;">Loading records...</td></tr>`;
             return;
        }

        if(data.length === 0) {
            tableBody.innerHTML = "<tr><td colspan='8' style='text-align:center; padding: 40px;' class='text-dimmed'><i class=\"fa-solid fa-magnifying-glass-chart\" style=\"font-size: 2rem; margin-bottom: 10px; display: block; opacity: 0.5;\"></i>No products matching your criteria</td></tr>";
            return;
        }

        // Apply pagination
        const paginated = Utils.paginate(data, currentPage, itemsPerPage);
        
        paginated.items.forEach((product, idx) => {
            const tr = document.createElement('tr');
            // No transition specified here to keep it static
            
            const imgHtml = product.image ? `<img src="${product.image}" style="width:40px;height:40px;object-fit:cover;border-radius:6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">` : `<div class="img-placeholder"><i class="fa-solid fa-image"></i></div>`;
            const stock = parseInt(product.stock);
            
            // Row Index
            const rowIndex = (currentPage - 1) * itemsPerPage + (idx + 1);

            tr.innerHTML = `
                <td class="text-xs text-dimmed">${rowIndex}</td>
                <td>${imgHtml}</td>
                <td><strong class="item-name">${product.name}</strong></td>
                <td><span class="badge category-badge">${product.category}</span></td>
                <td><strong class="price-text">LKR ${parseFloat(product.price).toLocaleString(undefined, {minimumFractionDigits: 2})}</strong></td>
                <td>
                    <div class="stock-info-wrapper">
                        <span class="stock-count ${getStockClass(stock)}">${stock}</span>
                    </div>
                </td>
                <td>${getStockStatus(stock)}</td>
                <td>
                     <div class="action-btns">
                        <button class="btn-action btn-view" onclick="viewProduct(${product.id})" title="View Product"><i class="fa-regular fa-eye"></i></button>
                        <button class="btn-action btn-edit" onclick="editProduct(${product.id})" title="Edit Product"><i class="fa-regular fa-pen-to-square"></i></button>
                        <button class="btn-action btn-print" onclick="printProduct(${product.id})" title="Print Product"><i class="fa-solid fa-print"></i></button>
                        <button class="btn-action btn-delete" onclick="deleteProduct(${product.id})" title="Delete Product"><i class="fa-regular fa-trash-can"></i></button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        // Render Pagination UI
        Utils.renderPagination('inventory-pagination', paginated, (newPage) => {
            currentPage = newPage;
            renderTable(products);
        });
    }

    // Get Stock Class
    function getStockClass(stock) {
        if(stock === 0) return 'low';
        if(stock <= 15) return 'warning'; // Needs dynamic threshold ideally, but CSS class logic remains
        return 'good';
    }

    // Get Stock Status
    function getStockStatus(stock) {
        if(stock === 0) return '<span class="status low">Out of Stock</span>';
        if(stock <= 15) return '<span class="status pending">Low Stock</span>';
        return '<span class="status complete">Full Stock</span>';
    }

    // Update Stats
    async function updateStats() {
        try {
            const data = await window.apiFetch('products.php?action=stats', { method: 'GET' });
            if (data.success) {
                const totalEl = document.getElementById('total-products-count');
                const lowEl = document.getElementById('low-stock-count');
                const outEl = document.getElementById('out-of-stock-count');
                const valEl = document.getElementById('total-value-count');

                if(totalEl) window.animateStat('total-products-count', data.data.total);
                if(lowEl) window.animateStat('low-stock-count', data.data.lowStock);
                if(outEl) window.animateStat('out-of-stock-count', data.data.outOfStock);
                if(valEl) window.animateStat('total-value-count', data.data.marketValue || 0, 'LKR ');
            }
        } catch (e) {
            console.error('Failed to fetch stats', e);
        }
    }

    // --- FILTERS & SORTING HANDLERS ---
    const filterTabs = document.querySelectorAll('#inventory-filter-tabs button');
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.dataset.status;
            loadProducts();
        });
    });

    const headers = document.querySelectorAll('#inventory-table th.sortable');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const prop = header.dataset.sort;
            if (currentSort.property === prop) {
                currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.property = prop;
                currentSort.order = 'asc';
            }
            
            headers.forEach(h => {
                const icon = h.querySelector('i');
                icon.className = 'fa-solid fa-sort';
            });
            const activeIcon = header.querySelector('i');
            activeIcon.className = currentSort.order === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
            
            loadProducts();
        });
    });

    window.searchInventory = loadProducts;
    window.loadProducts = loadProducts;
    window.updateStats = updateStats;

    // --- SEARCH ---
    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(loadProducts, 300);
        });
    }

    // --- MODAL CONTROLS ---
    function openModal() {
        if (!modal) return;
        modal.classList.add('show');
        if (modalTitle) modalTitle.innerText = "Add New Product";
        productForm.reset();
        document.getElementById('p-id').value = "";
        document.getElementById('p-image').value = "";
    }

    // Close Modal
    function closeModal() {
        modal.classList.remove('show');
    }

    window.openProductModal = openModal;
    window.closeProductModal = closeModal;

    if (addBtn) {
        addBtn.addEventListener('click', openModal);
    }

    const productModalCloseBtn = document.querySelector('.close-btn');
    if(productModalCloseBtn) {
        productModalCloseBtn.addEventListener('click', closeModal);
    }
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    
    const stockInput = document.getElementById('p-stock');
    if (stockInput) {
        stockInput.addEventListener('keypress', function(e) {
            if (e.key === '-') {
                e.preventDefault();
            }
        });
        stockInput.addEventListener('input', function() {
            if (this.value < 0) {
                this.value = 0;
            }
        });
    }

    const viewModal = document.getElementById('view-product-modal');
    window.addEventListener('click', (e) => {
        if (e.target == modal) closeModal();
        if (viewModal && e.target == viewModal) closeViewModal();
    });

    let isSubmitting = false;

    productForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (isSubmitting) return;
        
        const id = document.getElementById('p-id').value;
        const name = document.getElementById('p-name').value;
        const stock = parseInt(document.getElementById('p-stock').value);
        
        const isEdit = id ? true : false;
        if (!isEdit && stock <= 0) {
            window.showToast('Initial Stock Level must be a positive value (greater than zero).', 'error');
            return;
        } else if (isEdit && stock < 0) {
            window.showToast('Stock Level cannot be negative.', 'error');
            return;
        }
        
        // Disable button IMMEDIATELY to prevent double-clicks during image processing
        const saveBtn = productForm.querySelector('button[type="submit"]');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        }
        
        isSubmitting = true;
        const newCat = document.getElementById('p-new-category').value;
        const selectedCat = document.getElementById('p-category').value;
        const category = newCat.trim() !== "" ? newCat : selectedCat;
        
        const payload = {
            id: id || null,
            name: document.getElementById('p-name').value,
            category: category,
            price: parseFloat(document.getElementById('p-price').value),
            cost: parseFloat(document.getElementById('p-cost').value || 0),
            stock: parseInt(document.getElementById('p-stock').value),
            incoming_stock: parseInt(document.getElementById('p-incoming-stock').value || 0),
            image: document.getElementById('p-image').value
        };

        const fileInput = document.getElementById('p-image-file');

        // Save Product
        const saveProduct = async (imgData) => {
            payload.image = imgData || payload.image;

            try {
                await window.apiFetch('products.php', { method: 'POST', body: payload });
                const isEdit = id ? true : false;
                window.showToast(isEdit ? 'Product updated successfully' : 'Product added successfully');
                closeModal();
                await loadProducts();
                if (!isEdit && currentSort.property === 'id' && currentSort.order === 'asc' && currentFilter === 'all' && !(searchInput && searchInput.value.trim())) {
                    currentPage = Math.max(1, Math.ceil(products.length / itemsPerPage));
                    renderTable(products);
                }
                if(window.updateGlobalNavStats) window.updateGlobalNavStats();
            } catch (err) {
                console.error('Save Product Failed:', err);
                window.showToast(err.message, 'error');
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerText = "Save Product";
                }
                isSubmitting = false;
            }
        };

        if (fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onerror = function() {
                    window.showToast('Invalid image file format.', 'error');
                    if (saveBtn) {
                        saveBtn.disabled = false;
                        saveBtn.innerText = "Save Product";
                    }
                    isSubmitting = false;
                };
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Compress to JPEG with 0.7 quality to guarantee it fits under PHP 8MB limit
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    saveProduct(dataUrl);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            saveProduct(payload.image);
        }
    });

    window.deleteProduct = async function(id) {
        if(await window.Utils.showConfirm("Are you sure you want to delete this product?")) {
            try {
                await window.apiFetch('products.php?id=' + id, { method: 'DELETE' });
                showToast('Product deleted');
                loadProducts();
                if(window.updateGlobalNavStats) window.updateGlobalNavStats();
            } catch (err) {
                showToast(err.message, 'error');
            }
        }
    }

    // --- VIEW PRODUCT ---
    const viewBody = document.getElementById('view-product-body');
    const closeViewBtn = document.querySelector('.close-view-btn');
    const closeViewModalBtn = document.querySelector('.close-view-modal-btn');

    // Close View Modal
    function closeViewModal() {
        if(viewModal) viewModal.classList.remove('show');
    }

    if(closeViewBtn) closeViewBtn.addEventListener('click', closeViewModal);
    if(closeViewModalBtn) closeViewModalBtn.addEventListener('click', closeViewModal);

    window.viewProduct = function(id) {
        const product = products.find(p => p.id == id);
        if(!product) return;
        
        const imgHtml = product.image 
            ? `<div style="flex: 1 1 200px; max-width: 250px; margin: 0 auto;"><img src="${product.image}" alt="${product.name}" style="width:100%;height:auto;max-height:220px;object-fit:contain;border-radius:12px;box-shadow: 0 4px 15px rgba(0,0,0,0.08); border: 1px solid #eee;"></div>` 
            : `<div style="flex: 1 1 200px; max-width: 250px; margin: 0 auto; height:220px;background:#f8f9fa;display:flex;align-items:center;justify-content:center;border-radius:12px;color:#cbd5e1;border: 1px dashed #ddd;"><i class="fa-solid fa-image fa-3x"></i></div>`;

        const content = `
            <div style="display: flex; flex-wrap: wrap; gap: 24px; padding: 4px;">
                ${imgHtml}
                <div style="flex: 2 1 300px; display:flex; flex-direction: column; justify-content: center;">
                    <div style="margin-bottom: 16px;">
                        <strong style="display:block; font-size:0.75rem; color:#64748b; text-transform:uppercase; margin-bottom:2px;">Product Name</strong>
                        <p style="margin:0; font-weight:800; font-size:1.4rem; line-height:1.2; color:#0f172a;">${product.name}</p>
                    </div>
                    
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px 16px;">
                        <div><strong style="display:block; font-size:0.75rem; color:#64748b; text-transform:uppercase; margin-bottom:2px;">Product ID</strong><p style="margin:0; font-weight:700; font-size:1rem;">#${product.id}</p></div>
                        <div><strong style="display:block; font-size:0.75rem; color:#64748b; text-transform:uppercase; margin-bottom:2px;">Category</strong><p style="margin:0; font-weight:700; font-size:1rem;">${product.category}</p></div>
                        
                        <div><strong style="display:block; font-size:0.75rem; color:#64748b; text-transform:uppercase; margin-bottom:2px;">Cost Price</strong><p style="margin:0; font-weight:600; color:#475569;">LKR ${parseFloat(product.cost || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p></div>
                        <div><strong style="display:block; font-size:0.75rem; color:#64748b; text-transform:uppercase; margin-bottom:2px;">Selling Price</strong><p style="margin:0; font-weight:800; color:#10b981; font-size:1.1rem;">LKR ${parseFloat(product.price).toLocaleString(undefined, {minimumFractionDigits: 2})}</p></div>
                        
                        <div><strong style="display:block; font-size:0.75rem; color:#64748b; text-transform:uppercase; margin-bottom:2px;">Current Stock</strong><p style="margin:0; font-weight:700; font-size:1rem;"><span style="color:${product.stock > 10 ? '#10b981' : '#ef4444'}">${product.stock}</span> units</p></div>
                        <div><strong style="display:block; font-size:0.75rem; color:#64748b; text-transform:uppercase; margin-bottom:2px;">Total Sales</strong><p style="margin:0; font-weight:700; font-size:1rem; color:#475569;">${product.sold || 0} units</p></div>
                    </div>
                </div>
            </div>`;

        window.showCenteredModal({
            title: `Product Details - ${product.name}`,
            content: content,
            primaryText: 'Print',
            primaryAction: function() { window.printProduct(id); },
            secondaryText: 'Close',
            secondaryAction: window.closeCenteredModal,
            width: '680px'
        });
    };

    window.editProduct = function(id) {
        const product = products.find(p => p.id == id);
        if(!product || !modal) return;
        
        // Set modal title
        if (modalTitle) modalTitle.innerText = "Edit Product";
        
        // Populate form
        document.getElementById('p-id').value = product.id;
        document.getElementById('p-name').value = product.name;
        document.getElementById('p-category').value = product.category;
        document.getElementById('p-price').value = product.price;
        document.getElementById('p-cost').value = product.cost || 0;
        document.getElementById('p-stock').value = product.stock;
        document.getElementById('p-incoming-stock').value = product.incoming_stock || 0;
        document.getElementById('p-image').value = product.image || "";
        
        // Open modal
        modal.classList.add('show');
    }

    window.printProduct = function(id) {
        const product = products.find(p => p.id == id);
        if(!product) return;

        const imgHtml = product.image 
            ? `<img src="${product.image}" alt="${product.name}" style="width:180px;max-height:160px;object-fit:contain;border-radius:8px;">` 
            : `<div style="width:180px;height:140px;background:#f8f9fa;display:flex;align-items:center;justify-content:center;border:1px solid #ddd;border-radius:8px;color:#aaa;"><i class="fa-solid fa-image fa-3x"></i></div>`;

        const content = `
            <div style="padding: 0 12px; color:#1f2937;">
                <div style="text-align:center;margin-bottom:20px;">
                    <div style="margin-bottom:16px;">${imgHtml}</div>
                    <h2 style="margin:0;">${product.name}</h2>
                    <p style="margin:8px 0 0 0; color:#64748b;">Product ID #${product.id}</p>
                </div>
                <table style="width:100%;border-collapse:collapse;">
                    ${['Product ID','Name','Category','Cost Price','Selling Price','Stock','Units Sold'].map((label, idx) => {
                        const keys = ['id','name','category','cost','price','stock','sold'];
                        const value = keys[idx] === 'cost' || keys[idx] === 'price'
                            ? `LKR ${parseFloat(product[keys[idx]] || 0).toLocaleString(undefined, {minimumFractionDigits:2})}`
                            : (product[keys[idx]] ?? (label === 'Units Sold' ? 0 : 'N/A'));
                        return `<tr style="border-top:1px solid #e5e7eb;"><td style="padding:10px 8px;color:#64748b;width:35%;">${label}</td><td style="padding:10px 8px;font-weight:600;text-align:right;">${value}</td></tr>`;
                    }).join('')}
                </table>
            </div>
        `;

        window.openPrintPreviewModal({
            reportTitle: `Product Specification - #${product.id}`,
            headline: `Product Details`,
            contentHtml: content,
            width: '850px'
        });
    }

    window.exportToCSV = function() {
        if (products.length === 0) {
            alert("No data to export!");
            return;
        }

        window.ExportUtils.toExcel({
            fileName: 'inventory_data.xls',
            sheetName: 'Inventory',
            headers: ['ID', 'Name', 'Category', 'Cost', 'Price', 'Stock', 'Sold'],
            rows: products.map(p => [
                Number(p.id) || p.id || '',
                p.name || '',
                p.category || '',
                Number(p.cost) || 0,
                Number(p.price) || 0,
                Number(p.stock) || 0,
                Number(p.sold) || 0
            ])
        });
    }

    window.exportInventory = window.exportToCSV;
    
    // Initial Load & Sort UI Setup
    const idHeader = document.querySelector('th[data-sort="id"]');
    if (idHeader) {
        const icon = idHeader.querySelector('i');
        if (icon) icon.className = 'fa-solid fa-sort-up';
    }
    loadProducts();
});
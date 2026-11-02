/* Component Loader for Header, Sidebar, and Top Bar */

document.addEventListener("DOMContentLoaded", function () {
    loadComponent("top-bar-container", "../components/top-bar.html");
    loadComponent("header-container", "../components/header.html");
    loadComponent("sidebar-container", "../components/sidebar.html");
});

// Load Component
async function loadComponent(containerId, filePath) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const response = await fetch(filePath);
        if (response.ok) {
            const html = await response.text();
            container.innerHTML = html;
            
            // Re-initialize scripts dependent on these components
            if (containerId === "sidebar-container") highlightActiveMenu();
            if (containerId === "header-container" || containerId === "top-bar-container") initHeaderScripts();
        } else {
            console.error(`Failed to load ${filePath}: ${response.statusText}`);
        }
    } catch (error) {
        console.error(`Error loading ${filePath}:`, error);
    }
}

// Highlight Active Menu
function highlightActiveMenu() {
    const currentPath = window.location.pathname.split("/").pop() || "index.html";
    const sidebarLinks = document.querySelectorAll(".cat-list a");
    
    sidebarLinks.forEach(link => {
        if (link.getAttribute("href") === currentPath) {
            link.parentElement.classList.add("active");
        } else {
            link.parentElement.classList.remove("active");
        }
    });
}

// Init Header Scripts
function initHeaderScripts() {
    // Re-attach event listeners for header elements like search, notifications, dark mode toggle, etc.
    
    // Example: Initialize live clock if present
    if (typeof updateLiveClock === "function") updateLiveClock();
    
    // Example: Initialize Users Dropdown
    if (typeof renderUsersDropdown === "function") renderUsersDropdown();
    
    // Example: Attach header icon listeners (Logout, etc.)
    if (typeof attachHeaderIconListeners === "function") attachHeaderIconListeners();
}

/* Skeleton Loader Utility */
function showSkeleton(containerId, type = "table", count = 5) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let html = "";
    if (type === "table") {
        for (let i = 0; i < count; i++) {
            html += `
                <tr class="skeleton-row">
                    <td colspan="100%">
                        <div class="skeleton-bar"></div>
                    </td>
                </tr>`;
        }
    } else if (type === "card") {
        for (let i = 0; i < count; i++) {
            html += `
                <div class="skeleton-card">
                    <div class="skeleton-img"></div>
                    <div class="skeleton-text"></div>
                    <div class="skeleton-text short"></div>
                </div>`;
        }
    }
    container.innerHTML = html;
}

// Hide Skeleton
function hideSkeleton(containerId) {
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = "";
}
// ========================================
// GLOBAL DARK MODE TOGGLE
// Persists across all pages via localStorage
// ========================================

(function() {
    const DARK_MODE_KEY = 'dark_mode_enabled';

    // Apply dark mode immediately on page load (before DOM ready)
    function applyDarkMode() {
        const isDark = localStorage.getItem(DARK_MODE_KEY) === 'true';
        
        // Use no-transition class to prevent initial transition on load
        document.body.classList.add('no-transition');
        
        if (isDark) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        
        // Force a reflow to ensure class is applied before remove
        void document.body.offsetHeight;
        document.body.classList.remove('no-transition');
        
        updateToggleIcon(isDark);
    }

    // Update Toggle Icon
    function updateToggleIcon(isDark) {
        const toggleBtns = document.querySelectorAll('.dark-mode-toggle i');
        toggleBtns.forEach(icon => {
            if (isDark) {
                icon.className = 'fa-solid fa-sun';
            } else {
                icon.className = 'fa-solid fa-moon';
            }
        });
    }

    // Toggle function — exposed globally
    window.toggleDarkMode = function() {
        document.body.classList.add('theme-transition');
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem(DARK_MODE_KEY, isDark);
        updateToggleIcon(isDark);
        // Dispatch event for other components (like charts) to react
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { isDark } }));

        setTimeout(() => {
            document.body.classList.remove('theme-transition');
        }, 300);
    };

    // Apply on initial load
    applyDarkMode();

    // Also apply once DOM is fully loaded (for icons)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyDarkMode);
    }
})();
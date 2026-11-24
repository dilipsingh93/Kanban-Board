(function () {
    const Dashboard = window.ProjectFlowDashboard || (window.ProjectFlowDashboard = {});

    function setTheme(theme) {
        const isNightMode = theme === "night";
        const themeToggleButton = document.getElementById("themeToggleButton");

        if (!themeToggleButton) return;

        document.body.dataset.theme = isNightMode ? "night" : "day";
        themeToggleButton.innerHTML = isNightMode
            ? '<span aria-hidden="true">&#9728;</span><span class="theme-toggle-label">Day mode</span>'
            : '<span aria-hidden="true">&#9790;</span><span class="theme-toggle-label">Night mode</span>';
        themeToggleButton.setAttribute(
            "aria-label",
            `Switch to ${isNightMode ? "day" : "night"} mode`
        );
        themeToggleButton.setAttribute("aria-pressed", String(isNightMode));
        localStorage.setItem("projectflow-theme", isNightMode ? "night" : "day");
    }

    function setModalOpen(modal, isOpen) {
        if (!modal) return;

        modal.classList.toggle("hidden", !isOpen);
        modal.setAttribute("aria-hidden", String(!isOpen));

        if (isOpen) {
            modal.querySelector("input, textarea")?.focus();
        }
    }

    Dashboard.setTheme = setTheme;
    Dashboard.setModalOpen = setModalOpen;
})();

(function () {
    const Dashboard = window.ProjectFlowDashboard || (window.ProjectFlowDashboard = {});

    if (typeof Dashboard.initDashboardPage === "function") {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", Dashboard.initDashboardPage);
        } else {
            Dashboard.initDashboardPage();
        }
    }
})();

(function () {
    const TeamPage = window.ProjectFlowTeam || (window.ProjectFlowTeam = {});

    document.addEventListener("DOMContentLoaded", async () => {
        if (typeof TeamPage.initializeTeamPage === "function") {
            await TeamPage.initializeTeamPage();
        }
    });
})();

(function () {
    const TeamPage = window.ProjectFlowTeam || (window.ProjectFlowTeam = {});

    TeamPage.state = {
        currentUser: null,
        currentProjectId: null,
        currentProject: null,
        currentRole: null,
        allTasks: [],
        allMembers: [],
        selectedTask: null
    };
})();

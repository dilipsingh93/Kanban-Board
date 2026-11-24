(function () {
    const Dashboard = window.ProjectFlowDashboard || (window.ProjectFlowDashboard = {});

    async function loadUser() {
        const welcomeText = document.getElementById("welcomeText");
        const userAvatar = document.getElementById("userAvatar");

        if (!welcomeText || !userAvatar) return;

        const { data: { user }, error } = await supabaseClient.auth.getUser();

        if (error || !user) {
            window.location.href = "login.html";
            return;
        }

        Dashboard.state.currentUser = user;

        const { data: profile, error: profileError } = await supabaseClient
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .single();

        if (profileError) {
            console.error(profileError);
        }

        const fullName = ProjectFlowUser.getDisplayName(user, profile?.full_name);
        welcomeText.textContent = `Welcome, ${fullName}`;
        userAvatar.textContent = fullName
            .split(/\s+/)
            .slice(0, 2)
            .map(part => part.charAt(0))
            .join("")
            .toUpperCase();

        await Dashboard.loadTeams();
    }

    async function loadTeams() {
        const teamsContainer = document.getElementById("teamsContainer");
        const teamCount = document.getElementById("teamCount");

        if (!teamsContainer || !teamCount || !Dashboard.state.currentUser) return;

        teamsContainer.innerHTML = '<div class="loading-state"><span class="loading-mark"></span> Loading your teams...</div>';

        const { data: memberships, error } = await supabaseClient
            .from("project_members")
            .select(`
                role,
                projects (
                    id,
                    name,
                    description,
                    join_code
                )
            `)
            .eq("user_id", Dashboard.state.currentUser.id);

        if (error) {
            console.error(error);
            teamsContainer.innerHTML = '<div class="empty-state"><h3>Teams could not load</h3><p>Please refresh and try again.</p></div>';
            teamCount.innerHTML = "<strong>—</strong><span>teams</span>";
            return;
        }

        if (!memberships || memberships.length === 0) {
            teamCount.innerHTML = "<strong>0</strong><span>teams</span>";
            teamsContainer.innerHTML = `
                <div class="empty-state">
                    <h3>Your workspace is ready</h3>
                    <p>Create a team or join one with an invite code to get started.</p>
                </div>
            `;
            return;
        }

        teamsContainer.innerHTML = "";
        teamCount.innerHTML = `<strong>${memberships.length}</strong><span>${memberships.length === 1 ? "team" : "teams"}</span>`;

        memberships.forEach((membership) => {
            const project = membership.projects;
            const card = document.createElement("div");
            card.className = "team-card";

            const cardHeading = document.createElement("div");
            cardHeading.className = "team-card-heading";

            const mark = document.createElement("span");
            mark.className = "team-mark";
            mark.textContent = (project.name || "T").charAt(0).toUpperCase();

            const copy = document.createElement("div");
            copy.className = "team-card-copy";

            const name = document.createElement("h3");
            name.textContent = project.name || "Untitled team";

            const description = document.createElement("p");
            description.textContent = project.description || "No description yet";

            copy.append(name, description);
            cardHeading.append(mark, copy);

            const role = document.createElement("span");
            role.className = "team-role";
            role.textContent = membership.role;

            const top = document.createElement("div");
            top.className = "team-card-top";
            top.append(cardHeading, role);

            const bottom = document.createElement("div");
            bottom.className = "team-card-bottom";

            const code = document.createElement("span");
            code.className = "team-code";
            code.textContent = membership.role === "leader" && project.join_code
                ? `Invite code: ${project.join_code}`
                : "Shared team workspace";
            bottom.appendChild(code);

            const openButton = document.createElement("button");
            openButton.type = "button";
            openButton.textContent = "Open team →";
            openButton.addEventListener("click", () => {
                Dashboard.openTeam(project.id, membership.role);
            });
            bottom.appendChild(openButton);

            card.append(top, bottom);
            teamsContainer.appendChild(card);
        });
    }

    function openTeam(projectId, role) {
        sessionStorage.setItem("currentProjectId", projectId);
        sessionStorage.setItem("currentProjectRole", role);
        window.location.href = "team.html";
    }

    async function handleCreateTeam(event) {
        event.preventDefault();

        const name = document.getElementById("teamName").value.trim();
        const description = document.getElementById("teamDescription").value.trim();
        const message = document.getElementById("createTeamMessage");

        if (!message) return;

        message.textContent = "Creating team...";

        const { error } = await supabaseClient.rpc("create_project", {
            project_name: name,
            project_description: description || null
        });

        if (error) {
            console.error(error);
            message.textContent = error.message;
            return;
        }

        message.textContent = "Team created successfully!";
        document.getElementById("createTeamForm")?.reset();

        setTimeout(() => {
            Dashboard.setModalOpen(document.getElementById("createTeamModal"), false);
            Dashboard.loadTeams();
        }, 800);
    }

    async function handleJoinTeam(event) {
        event.preventDefault();

        const code = document.getElementById("teamCode").value.trim();
        const message = document.getElementById("joinTeamMessage");

        if (!message) return;

        message.textContent = "Joining team...";

        const { error } = await supabaseClient.rpc("join_project", {
            project_join_code: code
        });

        if (error) {
            console.error(error);
            message.textContent = error.message;
            return;
        }

        message.textContent = "Joined team successfully!";
        document.getElementById("joinTeamForm")?.reset();

        setTimeout(() => {
            Dashboard.setModalOpen(document.getElementById("joinTeamModal"), false);
            Dashboard.loadTeams();
        }, 800);
    }

    function initDashboardPage() {
        const logoutButton = document.getElementById("logoutButton");
        const themeToggleButton = document.getElementById("themeToggleButton");
        const createTeamButton = document.getElementById("createTeamButton");
        const joinTeamButton = document.getElementById("joinTeamButton");
        const createTeamModal = document.getElementById("createTeamModal");
        const joinTeamModal = document.getElementById("joinTeamModal");
        const closeCreateModal = document.getElementById("closeCreateModal");
        const closeJoinModal = document.getElementById("closeJoinModal");
        const createTeamForm = document.getElementById("createTeamForm");
        const joinTeamForm = document.getElementById("joinTeamForm");

        if (themeToggleButton) {
            Dashboard.setTheme(localStorage.getItem("projectflow-theme") || "day");
            themeToggleButton.addEventListener("click", () => {
                Dashboard.setTheme(document.body.dataset.theme === "night" ? "day" : "night");
            });
        }

        if (logoutButton) {
            logoutButton.addEventListener("click", async () => {
                await supabaseClient.auth.signOut();
                sessionStorage.removeItem("currentProjectId");
                sessionStorage.removeItem("currentProjectRole");
                window.location.href = "login.html";
            });
        }

        if (createTeamButton) {
            createTeamButton.addEventListener("click", () => {
                Dashboard.setModalOpen(createTeamModal, true);
            });
        }

        if (closeCreateModal) {
            closeCreateModal.addEventListener("click", () => {
                Dashboard.setModalOpen(createTeamModal, false);
            });
        }

        if (joinTeamButton) {
            joinTeamButton.addEventListener("click", () => {
                Dashboard.setModalOpen(joinTeamModal, true);
            });
        }

        if (closeJoinModal) {
            closeJoinModal.addEventListener("click", () => {
                Dashboard.setModalOpen(joinTeamModal, false);
            });
        }

        if (createTeamForm) {
            createTeamForm.addEventListener("submit", handleCreateTeam);
        }

        if (joinTeamForm) {
            joinTeamForm.addEventListener("submit", handleJoinTeam);
        }

        [createTeamModal, joinTeamModal].forEach((modal) => {
            if (!modal) return;
            modal.addEventListener("click", (event) => {
                if (event.target === modal) {
                    Dashboard.setModalOpen(modal, false);
                }
            });
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                Dashboard.setModalOpen(createTeamModal, false);
                Dashboard.setModalOpen(joinTeamModal, false);
            }
        });

        Dashboard.loadUser();
    }

    Dashboard.loadUser = loadUser;
    Dashboard.loadTeams = loadTeams;
    Dashboard.openTeam = openTeam;
    Dashboard.initDashboardPage = initDashboardPage;
})();

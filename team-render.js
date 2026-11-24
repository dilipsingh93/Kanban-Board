(function () {
    const TeamPage = window.ProjectFlowTeam || (window.ProjectFlowTeam = {});

    function renderMembers() {
        const membersGrid = document.getElementById("membersGrid");

        if (!membersGrid) return;

        document.getElementById("memberCount").textContent =
            `${TeamPage.state.allMembers.length} member${TeamPage.state.allMembers.length === 1 ? "" : "s"}`;

        if (TeamPage.state.allMembers.length === 0) {
            membersGrid.innerHTML = `
                <div class="loading-members">
                    No team members found.
                </div>
            `;
            return;
        }

        membersGrid.innerHTML = "";

        TeamPage.state.allMembers.forEach(member => {
            const profile = member.profiles;
            const name = profile?.full_name?.trim() ||
                profile?.username ||
                (member.user_id === TeamPage.state.currentUser?.id
                    ? ProjectFlowUser.getDisplayName(
                        TeamPage.state.currentUser,
                        sessionStorage.getItem("userName")
                    )
                    : "Team member");
            const initials = TeamPage.getInitials(name);

            const card = document.createElement("div");
            card.className = "member-card";
            card.innerHTML = `
                <div class="member-avatar">
                    ${TeamPage.escapeHtml(initials)}
                </div>

                <div class="member-info">
                    <strong>
                        ${TeamPage.escapeHtml(name)}
                    </strong>
                    <span>
                        ${TeamPage.escapeHtml(member.role)}
                    </span>
                </div>
            `;

            membersGrid.appendChild(card);
        });
    }

    function createTaskCard(task) {
        const card = document.createElement("div");
        card.className = "task-card";
        card.dataset.taskId = task.id;

        const priority = task.priority || "medium";
        const priorityClass = `priority-${priority}`;

        const assignedMember = TeamPage.state.allMembers.find(
            member => member.profiles?.id === task.assigned_to
        );

        let assigneeHtml;

        if (assignedMember) {
            const name = assignedMember.profiles.full_name || "User";
            assigneeHtml = `
                <div class="task-assignee">
                    <div class="mini-avatar">
                        ${TeamPage.escapeHtml(TeamPage.getInitials(name))}
                    </div>
                    <span>
                        ${TeamPage.escapeHtml(name)}
                    </span>
                </div>
            `;
        } else {
            assigneeHtml = `
                <span class="open-task-label">
                    Open Task
                </span>
            `;
        }

        const deadline = TeamPage.formatDeadline(task.deadline);

        card.innerHTML = `
            <div class="task-card-top">
                <span class="priority-badge ${priorityClass}">
                    ${TeamPage.escapeHtml(priority)}
                </span>
            </div>

            <h4>
                ${TeamPage.escapeHtml(task.title)}
            </h4>

            <p>
                ${TeamPage.escapeHtml(
                    TeamPage.truncateText(task.description || "No description", 90)
                )}
            </p>

            <div class="task-meta">
                ${assigneeHtml}
                <span class="task-deadline">
                    ${TeamPage.escapeHtml(deadline)}
                </span>
            </div>
        `;

        card.addEventListener("click", () => {
            TeamPage.openTaskDetails(task);
        });

        return card;
    }

    function renderTasks() {
        const todoColumn = document.getElementById("todoColumn");
        const workingColumn = document.getElementById("workingColumn");
        const reviewColumn = document.getElementById("reviewColumn");
        const completedColumn = document.getElementById("completedColumn");

        TeamPage.clearColumn(todoColumn);
        TeamPage.clearColumn(workingColumn);
        TeamPage.clearColumn(reviewColumn);
        TeamPage.clearColumn(completedColumn);

        const groups = {
            todo: todoColumn,
            working: workingColumn,
            review: reviewColumn,
            completed: completedColumn
        };

        TeamPage.state.allTasks.forEach(task => {
            const column = groups[task.status];
            if (!column) return;
            column.appendChild(createTaskCard(task));
        });

        TeamPage.showEmptyStateIfNeeded(todoColumn, "📋", "No tasks here");
        TeamPage.showEmptyStateIfNeeded(workingColumn, "⚙", "No tasks here");
        TeamPage.showEmptyStateIfNeeded(reviewColumn, "👀", "No tasks here");
        TeamPage.showEmptyStateIfNeeded(completedColumn, "✓", "No completed tasks");

        TeamPage.updateColumnCounts();
    }

    function updateStats() {
        const total = TeamPage.state.allTasks.length;
        const working = TeamPage.state.allTasks.filter(task => task.status === "working").length;
        const review = TeamPage.state.allTasks.filter(task => task.status === "review").length;
        const completed = TeamPage.state.allTasks.filter(task => task.status === "completed").length;

        document.getElementById("totalTasks").textContent = total;
        document.getElementById("workingTasks").textContent = working;
        document.getElementById("reviewTasks").textContent = review;
        document.getElementById("completedTasks").textContent = completed;

        const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

        document.getElementById("progressPercentage").textContent = `${percentage}%`;
        document.getElementById("progressFill").style.width = `${percentage}%`;
        document.getElementById("taskCountText").textContent = `${total} task${total === 1 ? "" : "s"}`;
    }

    function updateColumnCounts() {
        const counts = {
            todo: 0,
            working: 0,
            review: 0,
            completed: 0
        };

        TeamPage.state.allTasks.forEach(task => {
            if (counts[task.status] !== undefined) {
                counts[task.status]++;
            }
        });

        document.getElementById("todoCount").textContent = counts.todo;
        document.getElementById("workingCount").textContent = counts.working;
        document.getElementById("reviewCount").textContent = counts.review;
        document.getElementById("completedCount").textContent = counts.completed;
    }

    function openTaskDetails(task) {
        TeamPage.state.selectedTask = task;

        document.getElementById("taskModalTitle").textContent = task.title;
        document.getElementById("taskModalDescription").textContent = task.description || "No description available.";
        document.getElementById("taskModalStatus").textContent = TeamPage.formatStatus(task.status);
        document.getElementById("taskModalDeadline").textContent = TeamPage.formatFullDate(task.deadline);

        const priorityBadge = document.getElementById("taskModalPriority");
        priorityBadge.textContent = task.priority || "medium";
        priorityBadge.className = `priority-badge priority-${task.priority || "medium"}`;

        const member = TeamPage.state.allMembers.find(
            item => item.profiles?.id === task.assigned_to
        );

        document.getElementById("taskModalAssignee").textContent =
            member?.profiles?.full_name || "Open Task";

        TeamPage.updateTaskActions(task);

        document.getElementById("taskDetailsModal").classList.remove("hidden");
        TeamPage.loadTaskFiles(task);
    }

    function updateTaskActions(task) {
        const acceptBtn = document.getElementById("acceptTaskBtn");
        const startBtn = document.getElementById("startTaskBtn");
        const submitBtn = document.getElementById("submitReviewBtn");
        const workerActions = document.getElementById("workerTaskActions");
        const leaderReview = document.getElementById("leaderReviewActions");

        acceptBtn.style.display = "none";
        startBtn.style.display = "none";
        submitBtn.style.display = "none";
        leaderReview.classList.remove("visible");

        if (TeamPage.state.currentRole === "worker") {
            workerActions.style.display = "flex";

            if (task.assigned_to === null && task.status === "todo") {
                acceptBtn.style.display = "inline-flex";
            }

            if (
                task.assigned_to === TeamPage.state.currentUser.id &&
                task.status === "todo"
            ) {
                startBtn.style.display = "inline-flex";
            }

            if (
                task.assigned_to === TeamPage.state.currentUser.id &&
                task.status === "working"
            ) {
                submitBtn.style.display = "inline-flex";
            }
        } else {
            workerActions.style.display = "none";
        }

        if (TeamPage.state.currentRole === "leader" && task.status === "review") {
            leaderReview.classList.add("visible");
        }
    }

    function populateAssigneeSelect() {
        const select = document.getElementById("taskAssignee");

        select.innerHTML = `
            <option value="">
                Open Task - Anyone Can Accept
            </option>
        `;

        TeamPage.state.allMembers
            .filter(member => member.profiles)
            .forEach(member => {
                const option = document.createElement("option");
                option.value = member.profiles.id;
                option.textContent = `${member.profiles.full_name} (${member.role})`;
                select.appendChild(option);
            });
    }

    function updateCreateTaskFileNames() {
        const files = Array.from(document.getElementById("createTaskFiles").files || []);
        const fileNames = document.getElementById("createTaskFileNames");

        fileNames.replaceChildren();

        files.forEach(file => {
            const name = document.createElement("span");
            name.textContent = file.name;
            fileNames.appendChild(name);
        });
    }

    function openCreateTaskModal() {
        document.getElementById("createTaskModal").classList.remove("hidden");
        TeamPage.populateAssigneeSelect();
    }

    function closeCreateTaskModal() {
        document.getElementById("createTaskModal").classList.add("hidden");
        document.getElementById("createTaskForm").reset();
        document.getElementById("createTaskFileNames").replaceChildren();
    }

    function closeTaskDetailsModal() {
        document.getElementById("taskDetailsModal").classList.add("hidden");
        TeamPage.state.selectedTask = null;
    }

    TeamPage.renderMembers = renderMembers;
    TeamPage.renderTasks = renderTasks;
    TeamPage.createTaskCard = createTaskCard;
    TeamPage.updateStats = updateStats;
    TeamPage.updateColumnCounts = updateColumnCounts;
    TeamPage.openTaskDetails = openTaskDetails;
    TeamPage.updateTaskActions = updateTaskActions;
    TeamPage.populateAssigneeSelect = populateAssigneeSelect;
    TeamPage.updateCreateTaskFileNames = updateCreateTaskFileNames;
    TeamPage.openCreateTaskModal = openCreateTaskModal;
    TeamPage.closeCreateTaskModal = closeCreateTaskModal;
    TeamPage.closeTaskDetailsModal = closeTaskDetailsModal;
})();

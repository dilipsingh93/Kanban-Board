(function () {
    const TeamPage = window.ProjectFlowTeam || (window.ProjectFlowTeam = {});

    async function initializeTeamPage() {
        try {
            const {
                data: { session }
            } = await supabaseClient.auth.getSession();

            if (!session) {
                window.location.href = "login.html";
                return;
            }

            TeamPage.state.currentUser = session.user;
            TeamPage.state.currentProjectId = sessionStorage.getItem("currentProjectId");

            if (!TeamPage.state.currentProjectId) {
                TeamPage.showToast("No project selected.");

                setTimeout(() => {
                    window.location.href = "dashboard.html";
                }, 1200);

                return;
            }

            await TeamPage.loadProject();
            await TeamPage.loadMembers();
            await TeamPage.initDiscussion();
            await TeamPage.loadTasks();
            TeamPage.setupEventListeners();
        } catch (error) {
            console.error("Team initialization error:", error);
            TeamPage.showToast("Something went wrong while loading the project.");
        }
    }

    async function loadProject() {
        const {
            data: membership,
            error: membershipError
        } = await supabaseClient
            .from("project_members")
            .select(`
                role,
                project_id
            `)
            .eq("project_id", TeamPage.state.currentProjectId)
            .eq("user_id", TeamPage.state.currentUser.id)
            .single();

        if (membershipError || !membership) {
            console.error("Membership error:", membershipError);
            TeamPage.showToast("You are not a member of this project.");

            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 1200);

            return;
        }

        TeamPage.state.currentRole = membership.role;

        const {
            data: project,
            error: projectError
        } = await supabaseClient
            .from("projects")
            .select(`
                id,
                name,
                description,
                join_code,
                leader_id,
                created_at
            `)
            .eq("id", TeamPage.state.currentProjectId)
            .single();

        if (projectError) {
            console.error("Project error:", projectError);
            TeamPage.showToast("Unable to load project.");
            return;
        }

        TeamPage.state.currentProject = project;

        document.getElementById("projectName").textContent = project.name || "Unnamed Project";
        document.getElementById("projectNameBreadcrumb").textContent = project.name || "Project";
        document.getElementById("projectDescription").textContent = project.description || "No project description available.";

        const userName = ProjectFlowUser.getDisplayName(
            TeamPage.state.currentUser,
            TeamPage.state.currentUser.user_metadata?.full_name ||
                sessionStorage.getItem("userName")
        );

        document.getElementById("userName").textContent = userName;
        document.getElementById("userAvatar").textContent = TeamPage.getInitials(userName);
        document.getElementById("userRole").textContent =
            TeamPage.state.currentRole === "leader" ? "Leader" : "Worker";

        const leaderControls = document.querySelectorAll(".leader-only");
        leaderControls.forEach(control => {
            control.style.display = TeamPage.state.currentRole === "leader" ? "" : "none";
        });
    }

    async function deleteTeam() {
        const { currentProject, currentProjectId, currentRole, currentUser } = TeamPage.state;

        if (
            currentRole !== "leader" ||
            !currentProject ||
            !currentUser ||
            currentProject.leader_id !== currentUser.id
        ) {
            TeamPage.showToast("Only the team leader can delete this team.");
            return;
        }

        const teamName = currentProject.name || "this team";
        const confirmed = window.confirm(
            `Delete "${teamName}" permanently?\n\nThis will remove the team, its members, tasks, and uploaded task files. This cannot be undone.`
        );

        if (!confirmed) return;

        const deleteButton = document.getElementById("deleteTeamBtn");
        deleteButton.disabled = true;
        deleteButton.textContent = "Deleting...";

        try {
            const { data: tasks, error: tasksError } = await supabaseClient
                .from("tasks")
                .select("id")
                .eq("project_id", currentProjectId);

            if (tasksError) throw tasksError;

            const taskIds = (tasks || []).map(task => task.id);

            if (taskIds.length > 0) {
                const { data: files, error: filesError } = await supabaseClient
                    .from("task_files")
                    .select("file_path")
                    .in("task_id", taskIds);

                if (filesError) throw filesError;

                const filePaths = (files || []).map(file => file.file_path);
                if (filePaths.length > 0) {
                    const { error: storageError } = await supabaseClient.storage
                        .from("task-files")
                        .remove(filePaths);

                    if (storageError) throw storageError;
                }

                const { error: fileRowsError } = await supabaseClient
                    .from("task_files")
                    .delete()
                    .in("task_id", taskIds);

                if (fileRowsError) throw fileRowsError;

                const { error: taskDeleteError } = await supabaseClient
                    .from("tasks")
                    .delete()
                    .eq("project_id", currentProjectId);

                if (taskDeleteError) throw taskDeleteError;
            }

            const { error: membersError } = await supabaseClient
                .from("project_members")
                .delete()
                .eq("project_id", currentProjectId);

            if (membersError) throw membersError;

            const { data: deletedProject, error: projectError } = await supabaseClient
                .from("projects")
                .delete()
                .eq("id", currentProjectId)
                .select("id")
                .maybeSingle();

            if (projectError) throw projectError;
            if (!deletedProject) {
                throw new Error("The team was not deleted. Check your permissions and try again.");
            }

            sessionStorage.removeItem("currentProjectId");
            sessionStorage.removeItem("currentProjectRole");
            window.location.href = "dashboard.html";
        } catch (error) {
            console.error("Team deletion error:", error);
            TeamPage.showToast(`Unable to delete team: ${error.message || "Please try again."}`);
            deleteButton.disabled = false;
            deleteButton.textContent = "Delete Team";
        }
    }

    async function loadMembers() {
        const { data: memberships, error: membershipError } = await supabaseClient
            .from("project_members")
            .select("user_id, role, joined_at")
            .eq("project_id", TeamPage.state.currentProjectId)
            .order("joined_at", { ascending: true });

        if (membershipError) {
            console.error("Team membership list error:", membershipError);
            document.getElementById("memberCount").textContent = "Members unavailable";
            document.getElementById("membersGrid").innerHTML = `
                <div class="loading-members">
                    Team members could not be loaded. Please refresh and try again.
                </div>
            `;
            TeamPage.showToast("Unable to load team members.");
            return;
        }

        const memberIds = (memberships || []).map(member => member.user_id);
        let profiles = [];

        if (memberIds.length > 0) {
            const { data, error: profilesError } = await supabaseClient
                .rpc("get_project_member_profiles", {
                    p_project_id: TeamPage.state.currentProjectId
                });

            if (profilesError) {
                console.error("Team member profile list error:", profilesError);
                TeamPage.showToast(
                    "Member names could not load. Apply the team profile SQL helper."
                );
            } else {
                profiles = data || [];
                if (profiles.length < memberIds.length) {
                    console.warn(
                        "Some team members do not have a matching profile record."
                    );
                    TeamPage.showToast(
                        "Some member names are unavailable because their profiles are missing."
                    );
                }
            }
        }

        const profilesById = new Map(profiles.map(profile => [profile.id, profile]));
        TeamPage.state.allMembers = (memberships || []).map(member => ({
            ...member,
            profiles: profilesById.get(member.user_id) || null
        }));
        TeamPage.renderMembers();
    }

    async function loadTasks() {
        const {
            data: tasks,
            error
        } = await supabaseClient
            .from("tasks")
            .select(`
                id,
                project_id,
                title,
                description,
                assigned_to,
                created_by,
                status,
                priority,
                deadline,
                created_at,
                updated_at
            `)
            .eq("project_id", TeamPage.state.currentProjectId)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Tasks error:", error);
            TeamPage.showToast("Unable to load tasks.");
            return;
        }

        TeamPage.state.allTasks = tasks || [];
        TeamPage.renderTasks();
        TeamPage.updateStats();
    }

    async function createTask() {
        if (TeamPage.state.currentRole !== "leader") {
            TeamPage.showToast("Only the project leader can create tasks.");
            return;
        }

        const title = document.getElementById("taskTitle").value.trim();
        const description = document.getElementById("taskDescription").value.trim();
        const priority = document.getElementById("taskPriority").value;
        const deadlineValue = document.getElementById("taskDeadline").value;
        const assignedTo = document.getElementById("taskAssignee").value || null;
        const createTaskFiles = Array.from(document.getElementById("createTaskFiles").files || []);
        const submitButton = document.querySelector("#createTaskForm button[type='submit']");

        if (!title) {
            TeamPage.showToast("Please enter a task title.");
            return;
        }

        submitButton.disabled = true;

        let createdTask;
        let error;

        try {
            const result = await supabaseClient
                .from("tasks")
                .insert({
                    project_id: TeamPage.state.currentProjectId,
                    title: title,
                    description: description || null,
                    assigned_to: assignedTo,
                    created_by: TeamPage.state.currentUser.id,
                    status: "todo",
                    priority: priority,
                    deadline: deadlineValue
                        ? new Date(`${deadlineValue}T00:00:00`).toISOString()
                        : null
                })
                .select("id")
                .single();

            createdTask = result.data;
            error = result.error;
        } catch (createError) {
            console.error("Unexpected create task error:", createError);
            TeamPage.showToast(
                "Unable to create task: " +
                (createError instanceof Error ? createError.message : String(createError))
            );
            submitButton.disabled = false;
            return;
        }

        if (error) {
            console.error("Create task error:", error);
            TeamPage.showToast("Unable to create task: " + error.message);
            submitButton.disabled = false;
            return;
        }

        let failedUploads = 0;

        for (const file of createTaskFiles) {
            try {
                const uploadError = await TeamPage.storeTaskFile(createdTask.id, file);

                if (uploadError) {
                    console.error(`Task file upload failed for "${file.name}":`, uploadError);
                    failedUploads++;
                }
            } catch (uploadError) {
                console.error(`Unexpected task file upload error for "${file.name}":`, uploadError);
                failedUploads++;
            }
        }

        TeamPage.closeCreateTaskModal();

        if (failedUploads > 0) {
            TeamPage.showToast(
                `Task created, but ${failedUploads} of ${createTaskFiles.length} file(s) could not be uploaded.`
            );
        } else {
            TeamPage.showToast("Task created successfully.");
        }

        submitButton.disabled = false;
        await TeamPage.loadTasks();
    }

    async function acceptTask() {
        if (!TeamPage.state.selectedTask) return;

        const { error } = await supabaseClient
            .rpc("accept_task", {
                task_uuid: TeamPage.state.selectedTask.id
            });

        if (error) {
            console.error("Accept task error:", error);
            TeamPage.showToast(error.message);
            return;
        }

        TeamPage.showToast("Task accepted. You're now working on it.");
        TeamPage.closeTaskDetailsModal();
        await TeamPage.loadTasks();
    }

    async function startAssignedTask() {
        if (!TeamPage.state.selectedTask) return;

        const { error } = await supabaseClient
            .rpc("start_task", {
                task_uuid: TeamPage.state.selectedTask.id
            });

        if (error) {
            console.error("Start task error:", error);
            TeamPage.showToast(error.message);
            return;
        }

        TeamPage.showToast("Task started. It's now in Working.");
        TeamPage.closeTaskDetailsModal();
        await TeamPage.loadTasks();
    }

    async function submitTaskForReview() {
        if (!TeamPage.state.selectedTask) return;

        const { error } = await supabaseClient
            .rpc("submit_task_for_review", {
                task_uuid: TeamPage.state.selectedTask.id
            });

        if (error) {
            console.error("Submit task error:", error);
            TeamPage.showToast(error.message);
            return;
        }

        TeamPage.showToast("Task submitted for review.");
        TeamPage.closeTaskDetailsModal();
        await TeamPage.loadTasks();
    }

    async function reviewTask(decision) {
        if (!TeamPage.state.selectedTask) return;

        const comment = document.getElementById("reviewComment").value.trim();

        const { error } = await supabaseClient
            .rpc("review_task", {
                task_uuid: TeamPage.state.selectedTask.id,
                review_decision: decision,
                review_comment: comment || null
            });

        if (error) {
            console.error("Review task error:", error);
            TeamPage.showToast(error.message);
            return;
        }

        TeamPage.showToast(
            decision === "approved"
                ? "Task approved and completed."
                : "Changes requested from worker."
        );

        document.getElementById("reviewComment").value = "";
        TeamPage.closeTaskDetailsModal();
        await TeamPage.loadTasks();
    }

    async function uploadTaskFile(event) {
        const input = event.target;
        const file = input.files?.[0];
        const task = TeamPage.state.selectedTask;
        const uploadButton = document.getElementById("uploadFileButton");

        if (!file) return;

        if (!task) {
            TeamPage.showToast("Open a task before uploading a file.");
            input.value = "";
            return;
        }

        uploadButton.disabled = true;
        TeamPage.showToast("Uploading file...");

        try {
            const uploadError = await TeamPage.storeTaskFile(task.id, file);

            if (uploadError) {
                TeamPage.showToast(uploadError);
                return;
            }

            TeamPage.showToast("File uploaded successfully.");
            await TeamPage.loadTaskFiles(task);
        } catch (error) {
            console.error("Unexpected file upload error:", error);
            TeamPage.showToast(
                "Upload failed: " + (error instanceof Error ? error.message : String(error))
            );
        } finally {
            input.value = "";
            uploadButton.disabled = false;
        }
    }

    async function storeTaskFile(taskId, file) {
        if (!taskId || !TeamPage.state.currentProjectId || !TeamPage.state.currentUser?.id || !file) {
            return "Upload failed: task, project, user, or file is missing.";
        }

        const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = `${TeamPage.state.currentProjectId}/${taskId}/${Date.now()}_${safeFileName}`;

        try {
            const { error: uploadError } = await supabaseClient.storage
                .from("task-files")
                .upload(filePath, file);

            if (uploadError) {
                console.error("STORAGE UPLOAD FAILED:", uploadError);
                return "Storage upload failed: " + uploadError.message;
            }

            const { error: dbError } = await supabaseClient
                .from("task_files")
                .insert({
                    task_id: taskId,
                    uploaded_by: TeamPage.state.currentUser.id,
                    file_name: file.name,
                    file_path: filePath
                })
                .select()
                .single();

            if (dbError) {
                console.error("FILE DATABASE INSERT FAILED:", dbError);

                const { error: cleanupError } = await supabaseClient.storage
                    .from("task-files")
                    .remove([filePath]);

                if (cleanupError) {
                    console.error("Storage cleanup failed:", cleanupError);
                }

                return "Database insert failed: " + dbError.message;
            }

            return null;
        } catch (error) {
            console.error("UNEXPECTED FILE UPLOAD ERROR:", error);
            return "Unexpected upload error: " + (error instanceof Error ? error.message : String(error));
        }
    }

    async function loadTaskFiles(task) {
        if (TeamPage.state.selectedTask?.id !== task.id) return;

        const filesList = document.getElementById("taskFilesList");
        filesList.innerHTML = '<p class="no-files">Loading task files...</p>';

        const { data: files, error } = await supabaseClient
            .from("task_files")
            .select("file_name, file_path")
            .eq("task_id", task.id);

        if (error) {
            console.error("Task files error:", error);
            filesList.innerHTML = '<p class="no-files">Unable to load task files.</p>';
            TeamPage.showToast("Unable to load files for this task.");
            return;
        }

        if (TeamPage.state.selectedTask?.id !== task.id) return;

        if (!files || files.length === 0) {
            filesList.innerHTML = '<p class="no-files">No files uploaded yet.</p>';
            return;
        }

        const filesWithLinks = await Promise.all(
            files.map(async file => {
                const { data, error: linkError } = await supabaseClient
                    .storage
                    .from("task-files")
                    .createSignedUrl(file.file_path, 60 * 60, { download: file.file_name });

                if (linkError) {
                    console.error("Task file download link error:", file.file_name, linkError);
                    return { file, url: null };
                }

                return { file, url: data.signedUrl };
            })
        );

        if (TeamPage.state.selectedTask?.id !== task.id) return;

        filesList.innerHTML = "";

        filesWithLinks.forEach(({ file, url }) => {
            const item = document.createElement("div");
            item.className = "file-item";

            const name = document.createElement("span");
            name.className = "file-name";
            name.textContent = file.file_name;
            item.appendChild(name);

            if (url) {
                const download = document.createElement("a");
                download.className = "file-download";
                download.href = url;
                download.textContent = "⬇ Download";
                download.setAttribute("download", file.file_name);
                download.rel = "noopener noreferrer";
                item.appendChild(download);
            } else {
                const unavailable = document.createElement("span");
                unavailable.className = "file-download";
                unavailable.textContent = "Download unavailable";
                item.appendChild(unavailable);
            }

            filesList.appendChild(item);
        });

        if (filesWithLinks.some(({ url }) => !url)) {
            TeamPage.showToast("Some files could not be downloaded.");
        }
    }

    function setupEventListeners() {
        document.getElementById("backBtn").addEventListener("click", () => {
            window.location.href = "dashboard.html";
        });

        document.getElementById("logoutBtn").addEventListener("click", async () => {
            await supabaseClient.auth.signOut();
            sessionStorage.removeItem("currentProjectId");
            sessionStorage.removeItem("currentProjectRole");
            window.location.href = "login.html";
        });

        document.getElementById("createTaskBtn").addEventListener("click", () => {
            TeamPage.openCreateTaskModal();
        });

        document.getElementById("deleteTeamBtn").addEventListener("click", deleteTeam);

        document.getElementById("closeCreateTaskModal").addEventListener("click", () => {
            TeamPage.closeCreateTaskModal();
        });

        document.getElementById("cancelCreateTask").addEventListener("click", () => {
            TeamPage.closeCreateTaskModal();
        });

        document.getElementById("closeTaskDetailsModal").addEventListener("click", () => {
            TeamPage.closeTaskDetailsModal();
        });

        document.getElementById("acceptTaskBtn").addEventListener("click", async () => {
            await TeamPage.acceptTask();
        });

        document.getElementById("submitReviewBtn").addEventListener("click", async () => {
            await TeamPage.submitTaskForReview();
        });

        document.getElementById("startTaskBtn").addEventListener("click", async () => {
            await TeamPage.startAssignedTask();
        });

        document.getElementById("approveTaskBtn").addEventListener("click", async () => {
            await TeamPage.reviewTask("approved");
        });

        document.getElementById("requestChangesBtn").addEventListener("click", async () => {
            await TeamPage.reviewTask("changes_requested");
        });

        document.getElementById("createTaskForm").addEventListener("submit", async event => {
            event.preventDefault();
            await TeamPage.createTask();
        });

        document.getElementById("createTaskFiles").addEventListener("change", TeamPage.updateCreateTaskFileNames);

        document.getElementById("uploadFileButton").addEventListener("click", () => {
            document.getElementById("taskFileInput").click();
        });

        document.getElementById("taskFileInput").addEventListener("change", async event => {
            await TeamPage.uploadTaskFile(event);
        });
    }

    TeamPage.initializeTeamPage = initializeTeamPage;
    TeamPage.loadProject = loadProject;
    TeamPage.loadMembers = loadMembers;
    TeamPage.loadTasks = loadTasks;
    TeamPage.createTask = createTask;
    TeamPage.deleteTeam = deleteTeam;
    TeamPage.acceptTask = acceptTask;
    TeamPage.startAssignedTask = startAssignedTask;
    TeamPage.submitTaskForReview = submitTaskForReview;
    TeamPage.reviewTask = reviewTask;
    TeamPage.uploadTaskFile = uploadTaskFile;
    TeamPage.storeTaskFile = storeTaskFile;
    TeamPage.loadTaskFiles = loadTaskFiles;
    TeamPage.setupEventListeners = setupEventListeners;
})();

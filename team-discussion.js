(function () {
    const TeamPage = window.ProjectFlowTeam || (window.ProjectFlowTeam = {});
    const MESSAGE_LIMIT = 100;
    const channelRef = { current: null };
    const renderedMessageIds = new Set();

    function setDiscussionStatus(message, isError) {
        const status = document.getElementById("discussionStatus");
        if (!status) return;

        status.textContent = message;
        status.dataset.state = isError ? "error" : "connected";
    }

    function getSenderName(userId) {
        const member = TeamPage.state.allMembers.find(
            item => item.user_id === userId
        );
        const profile = member?.profiles;

        return profile?.full_name?.trim() ||
            profile?.username ||
            (userId === TeamPage.state.currentUser?.id
                ? sessionStorage.getItem("userName")
                : "") ||
            "Team member";
    }

    function renderMessage(message) {
        const messages = document.getElementById("discussionMessages");
        if (!messages || renderedMessageIds.has(String(message.id))) return;

        messages.querySelector(".discussion-empty")?.remove();

        const item = document.createElement("article");
        item.className = "discussion-message";
        item.dataset.messageId = String(message.id);

        if (message.user_id === TeamPage.state.currentUser?.id) {
            item.classList.add("is-own");
        }

        const meta = document.createElement("div");
        meta.className = "discussion-message-meta";

        const author = document.createElement("strong");
        author.textContent = getSenderName(message.user_id);

        const time = document.createElement("time");
        const createdAt = new Date(message.created_at);
        time.dateTime = message.created_at;
        time.textContent = Number.isNaN(createdAt.getTime())
            ? ""
            : createdAt.toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit"
            });

        const content = document.createElement("p");
        content.textContent = message.content;
        meta.append(author, time);
        item.append(meta, content);
        item.dataset.createdAt = message.created_at;
        const messageElements = Array.from(
            messages.querySelectorAll(".discussion-message")
        );
        const insertionPoint = messageElements.find(existing => {
            const existingTime = Date.parse(existing.dataset.createdAt);
            const currentTime = createdAt.getTime();
            return existingTime > currentTime ||
                (existingTime === currentTime &&
                    existing.dataset.messageId.localeCompare(
                        String(message.id),
                        undefined,
                        { numeric: true }
                    ) > 0);
        });
        messages.insertBefore(item, insertionPoint || null);
        renderedMessageIds.add(String(message.id));
        messages.scrollTop = messages.scrollHeight;
    }

    async function loadDiscussionMessages() {
        const messages = document.getElementById("discussionMessages");
        const { data, error } = await supabaseClient
            .from("project_discussion_messages")
            .select("id, user_id, content, created_at")
            .eq("project_id", TeamPage.state.currentProjectId)
            .order("created_at", { ascending: false })
            .limit(MESSAGE_LIMIT);

        if (error) {
            console.error("Discussion messages load error:", error);
            if (messages) {
                messages.innerHTML = "";
                const errorText = document.createElement("p");
                errorText.className = "discussion-empty";
                errorText.textContent =
                    "Discussion could not load. Check the Supabase setup and refresh.";
                messages.appendChild(errorText);
            }
            setDiscussionStatus("Unavailable", true);
            return false;
        }

        if (!data?.length && messages &&
            !messages.querySelector(".discussion-message")) {
            messages.innerHTML = "";
            const emptyText = document.createElement("p");
            emptyText.className = "discussion-empty";
            emptyText.textContent =
                "No messages yet. Start by sharing an idea with your team.";
            messages.appendChild(emptyText);
        } else {
            (data || []).reverse().forEach(renderMessage);
        }

        return true;
    }

    async function sendDiscussionMessage(event) {
        event.preventDefault();

        const input = document.getElementById("discussionInput");
        const sendButton = document.getElementById("discussionSendButton");
        const content = input.value.trim();
        if (!content) return;

        sendButton.disabled = true;
        try {
            const { data, error } = await supabaseClient
                .from("project_discussion_messages")
                .insert({
                    project_id: TeamPage.state.currentProjectId,
                    user_id: TeamPage.state.currentUser.id,
                    content
                })
                .select("id, user_id, content, created_at")
                .single();

            if (error) throw error;

            input.value = "";
            renderMessage(data);
        } catch (error) {
            console.error("Discussion message send error:", error);
            TeamPage.showToast(
                "Your message could not be sent. Please try again."
            );
        } finally {
            sendButton.disabled = false;
            input.focus();
        }
    }

    async function initDiscussion() {
        const form = document.getElementById("discussionForm");
        const dialog = document.getElementById("discussionDialog");
        const openButton = document.getElementById("openDiscussionButton");
        const closeButton = document.getElementById("closeDiscussionButton");
        const input = document.getElementById("discussionInput");
        if (!form || !dialog || !openButton || !closeButton || !input) return;

        renderedMessageIds.clear();
        form.addEventListener("submit", sendDiscussionMessage);
        input.addEventListener("keydown", event => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                form.requestSubmit();
            }
        });

        openButton.addEventListener("click", () => {
            if (!dialog.open) dialog.showModal();
            input.focus();
        });
        closeButton.addEventListener("click", () => dialog.close());
        dialog.addEventListener("click", event => {
            if (event.target === dialog) dialog.close();
        });

        channelRef.current = supabaseClient
            .channel(`project-discussion-${TeamPage.state.currentProjectId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "project_discussion_messages",
                    filter: `project_id=eq.${TeamPage.state.currentProjectId}`
                },
                payload => renderMessage(payload.new)
            )
            .subscribe(status => {
                if (status === "SUBSCRIBED") {
                    setDiscussionStatus("Live", false);
                } else if (
                    status === "CHANNEL_ERROR" ||
                    status === "TIMED_OUT" ||
                    status === "CLOSED"
                ) {
                    console.error("Discussion realtime channel status:", status);
                    setDiscussionStatus("Offline", true);
                }
            });

        await loadDiscussionMessages();

        window.addEventListener("pagehide", () => {
            if (channelRef.current) {
                supabaseClient.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        }, { once: true });
    }

    TeamPage.initDiscussion = initDiscussion;
})();

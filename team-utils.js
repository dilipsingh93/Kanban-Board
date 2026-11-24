(function () {
    const TeamPage = window.ProjectFlowTeam || (window.ProjectFlowTeam = {});

    function clearColumn(column) {
        if (!column) return;
        column.innerHTML = "";
    }

    function showEmptyStateIfNeeded(column, icon, message) {
        if (!column) return;

        if (column.children.length === 0) {
            column.innerHTML = `
                <div class="empty-column">
                    <span>${icon}</span>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    function getInitials(name) {
        if (!name) return "U";

        return name
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map(word => word.charAt(0).toUpperCase())
            .join("");
    }

    function truncateText(text, length) {
        if (!text) return "";

        if (text.length <= length) {
            return text;
        }

        return text.substring(0, length) + "...";
    }

    function formatStatus(status) {
        const statuses = {
            todo: "To Do",
            working: "Working",
            review: "In Review",
            completed: "Completed"
        };

        return statuses[status] || status;
    }

    function formatDeadline(deadline) {
        if (!deadline) {
            return "No deadline";
        }

        const date = new Date(deadline);

        if (Number.isNaN(date.getTime())) {
            return "No deadline";
        }

        return date.toLocaleDateString(undefined, {
            day: "numeric",
            month: "short"
        });
    }

    function formatFullDate(deadline) {
        if (!deadline) {
            return "No deadline";
        }

        const date = new Date(deadline);

        if (Number.isNaN(date.getTime())) {
            return "No deadline";
        }

        return date.toLocaleString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit"
        });
    }

    function escapeHtml(value) {
        if (value === null || value === undefined) {
            return "";
        }

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function showToast(message) {
        const toast = document.getElementById("toast");
        const toastMessage = document.getElementById("toastMessage");

        if (!toast || !toastMessage) return;

        toastMessage.textContent = message;
        toast.classList.add("show");

        setTimeout(() => {
            toast.classList.remove("show");
        }, 3000);
    }

    TeamPage.clearColumn = clearColumn;
    TeamPage.showEmptyStateIfNeeded = showEmptyStateIfNeeded;
    TeamPage.getInitials = getInitials;
    TeamPage.truncateText = truncateText;
    TeamPage.formatStatus = formatStatus;
    TeamPage.formatDeadline = formatDeadline;
    TeamPage.formatFullDate = formatFullDate;
    TeamPage.escapeHtml = escapeHtml;
    TeamPage.showToast = showToast;
})();

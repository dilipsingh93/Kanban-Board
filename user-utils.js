(function () {
    const ProjectFlowUser = window.ProjectFlowUser || (window.ProjectFlowUser = {});

    function getDisplayName(user, preferredName) {
        const savedName = typeof preferredName === "string" ? preferredName.trim() : "";
        if (savedName && !["user", "projectflow member"].includes(savedName.toLowerCase())) {
            return savedName;
        }

        const emailName = typeof user?.email === "string"
            ? user.email.split("@", 1)[0]
                .replace(/\d/g, "")
                .replace(/[._+-]+/g, " ")
                .trim()
            : "";

        const formattedEmailName = emailName
            .split(/\s+/)
            .filter(Boolean)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ");

        return formattedEmailName || "ProjectFlow member";
    }

    ProjectFlowUser.getDisplayName = getDisplayName;
})();

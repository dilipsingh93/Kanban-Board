(function () {
    const themeToggleButton = document.getElementById("themeToggleButton");

    if (!themeToggleButton) return;

    function setTheme(theme) {
        const isNightMode = theme === "night";

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

    setTheme(localStorage.getItem("projectflow-theme") || "day");
    themeToggleButton.addEventListener("click", () => {
        setTheme(document.body.dataset.theme === "night" ? "day" : "night");
    });
})();
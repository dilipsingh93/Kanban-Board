(function () {
    const Auth = window.ProjectFlowAuth || (window.ProjectFlowAuth = {});

    if (typeof Auth.initAuthPage === "function") {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", Auth.initAuthPage);
        } else {
            Auth.initAuthPage();
        }
    }
})();

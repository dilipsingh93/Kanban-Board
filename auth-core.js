
(function () {
    const Auth = window.ProjectFlowAuth ||
        (window.ProjectFlowAuth = {});

    // Internal identifier used by Supabase Auth.
    // Users only enter their username on the webpage.
    function usernameToAuthEmail(username) {
        return `${username.toLowerCase()}@users.projectflow.invalid`;
    }

    async function handleLogin(event) {
        event.preventDefault();

        const loginMessage =
            document.getElementById("loginMessage");
        const username =
            document.getElementById("username").value.trim();
        const password =
            document.getElementById("password").value;

        loginMessage.textContent = "Logging in...";

        try {
            const { data, error } =
                await supabaseClient.auth.signInWithPassword({
                    email: usernameToAuthEmail(username),
                    password
                });

            if (error) throw error;

            const user = data.user;

            if (!user) {
                throw new Error("Login failed.");
            }

            const { data: profile, error: profileError } =
                await supabaseClient
                    .from("profiles")
                    .select("role, full_name, username")
                    .eq("id", user.id)
                    .maybeSingle();

            if (profileError) {
                throw new Error(
                    "Logged in, but the profile could not be loaded."
                );
            }

            if (profile?.role) {
                sessionStorage.setItem("userRole", profile.role);
            } else {
                sessionStorage.removeItem("userRole");
            }

            sessionStorage.setItem(
                "userName",
                ProjectFlowUser.getDisplayName(
                    user,
                    profile?.full_name ||
                    user.user_metadata?.full_name ||
                    profile?.username ||
                    username
                )
            );

            window.location.href = "dashboard.html";
        } catch (error) {
            console.error("Login error:", error);
            loginMessage.textContent =
                "Unable to log in. Check your username and password.";
        }
    }

    async function handleSignup(event) {
        event.preventDefault();

        const signupForm =
            document.getElementById("signupForm");
        const signupMessage =
            document.getElementById("signupMessage");
        const submitButton =
            signupForm.querySelector('button[type="submit"]');

        const fullName =
            document.getElementById("signupName").value.trim();
        const username =
            document.getElementById("signupUsername")
                .value.trim().toLowerCase();
        const password =
            document.getElementById("signupPassword").value;
        const passwordConfirm =
            document.getElementById("signupPasswordConfirm").value;

        if (!/^[a-z0-9_]{3,24}$/.test(username)) {
            signupMessage.textContent =
                "Username must contain 3 to 24 letters, numbers, or underscores.";
            return;
        }

        if (password !== passwordConfirm) {
            signupMessage.textContent =
                "Passwords do not match.";
            return;
        }

        signupMessage.textContent = "Creating your account...";
        submitButton.disabled = true;

        try {
            const { data, error } =
                await supabaseClient.auth.signUp({
                    email: usernameToAuthEmail(username),
                    password,
                    options: {
                        data: {
                            username,
                            full_name: fullName
                        }
                    }
                });

            if (error) throw error;

            if (!data.user) {
                throw new Error("Account creation failed.");
            }

            // This flow needs email confirmation disabled in Supabase.
            // A synthetic address cannot receive confirmation emails.
            if (!data.session) {
                signupMessage.textContent =
                    "Account created, but no session was returned. " +
                    "Check the Supabase email-confirmation setting.";
                return;
            }

           // The Supabase database trigger creates the profile automatically.
const { data: profile, error: profileError } =
    await supabaseClient
        .from("profiles")
        .select("id, username, full_name, role")
        .eq("id", data.user.id)
        .maybeSingle();

if (profileError) {
    console.error("Profile verification error:", profileError);
    throw new Error(
        "Your account was created, but we couldn't verify your profile. " +
        "Please try logging in."
    );
}

if (!profile || profile.username !== username) {
    console.error("Profile missing or username mismatch:", profile);
    throw new Error(
        "Your account was created, but its profile is incomplete. " +
        "Please contact the project administrator."
    );
}

            sessionStorage.setItem("userName", fullName || username);
            sessionStorage.removeItem("userRole");

            window.location.href = "dashboard.html";
        } catch (error) {
            console.error("Signup error:", error);
            signupMessage.textContent =
                error.message ||
                "Unable to create your account. Please try again.";
        } finally {
            submitButton.disabled = false;
        }
    }

    function showAuthMode(mode) {
        const isSignup = mode === "signup";

        document.getElementById("loginForm").hidden = isSignup;
        document.getElementById("signupForm").hidden = !isSignup;

        document.getElementById("loginTitle").textContent =
            isSignup ? "Create your account" :
                "Sign in to your workspace";

        document.querySelector("#loginPanel .auth-badge")
            .textContent = isSignup ? "Get started" : "Welcome back";

        document.querySelector("#loginPanel .auth-subtitle")
            .textContent = isSignup
                ? "Create your account, then create a team or join one."
                : "Pick up where your team left off.";

        document.getElementById("loginModeSwitch").hidden = isSignup;
        document.getElementById("signupModeSwitch").hidden = !isSignup;

        document.getElementById(
            isSignup ? "signupUsername" : "username"
        ).focus();
    }

    function initPasswordToggles() {
        document.querySelectorAll(".password-toggle").forEach((toggle) => {
            const passwordInput =
                document.getElementById(toggle.dataset.target);

            if (!passwordInput) {
                console.error(
                    `Password toggle target "${toggle.dataset.target}" was not found.`
                );
                return;
            }

            toggle.addEventListener("click", () => {
                const isVisible = passwordInput.type === "text";
                passwordInput.type = isVisible ? "password" : "text";
                toggle.dataset.visible = String(!isVisible);
                toggle.setAttribute("aria-pressed", String(!isVisible));
                toggle.setAttribute(
                    "aria-label",
                    isVisible ? "Show password" : "Hide password"
                );
            });
        });
    }

    async function initAuthPage() {
        const loginMessage =
            document.getElementById("loginMessage");

        try {
            const { data, error } =
                await supabaseClient.auth.getSession();

            if (error) throw error;

            if (data.session) {
                window.location.replace("dashboard.html");
                return;
            }
        } catch (error) {
            console.error("Session restore error:", error);
            if (loginMessage) {
                loginMessage.textContent =
                    "Could not restore your saved session. Please sign in again.";
            }
        }

        initPasswordToggles();

        document.getElementById("loginForm")
            ?.addEventListener("submit", handleLogin);

        document.getElementById("signupForm")
            ?.addEventListener("submit", handleSignup);

        document.getElementById("showSignupButton")
            ?.addEventListener("click", () => showAuthMode("signup"));

        document.getElementById("showLoginButton")
            ?.addEventListener("click", () => showAuthMode("login"));

        const experience = document.getElementById("authExperience");
        const introScreen = document.getElementById("introScreen");
        const loginPanel = document.getElementById("loginPanel");
        const getStartedButton =
            document.getElementById("getStartedButton");

        if (!experience || !introScreen ||
            !loginPanel || !getStartedButton) return;

        getStartedButton.addEventListener("click", () => {
            experience.classList.add("auth-started");
            introScreen.setAttribute("aria-hidden", "true");
            introScreen.inert = true;
            loginPanel.setAttribute("aria-hidden", "false");
            loginPanel.inert = false;

            const focusLogin = () =>
                document.getElementById("username")
                    ?.focus({ preventScroll: true });

            if (window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches) {
                focusLogin();
            } else {
                window.setTimeout(focusLogin, 760);
            }
        });
    }

    Auth.handleLogin = handleLogin;
    Auth.handleSignup = handleSignup;
    Auth.initAuthPage = initAuthPage;
})();

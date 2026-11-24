const SUPABASE_URL = "https://uwkojgcdpcblmqvuaiju.supabase.co";
const SUPABASE_KEY = "sb_publishable_3VRGpXRmJQAOVriMGfY-Uw_Yan6tZgr";
let tabId = sessionStorage.getItem("projectflow-tab-id");

if (!tabId) {
    tabId = crypto.randomUUID();
    sessionStorage.setItem("projectflow-tab-id", tabId);
}

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
        auth: {
            persistSession: true,
            storage: window.sessionStorage,
            storageKey: `projectflow-auth-${tabId}`
        }
    }
);

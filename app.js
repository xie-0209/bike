const SUPABASE_URL = "https://bgiwbmmloczysitrepxt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnaXdibW1sb2N6eXNpdHJlcHh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQ4ODQ3MywiZXhwIjoyMDg1MDY0NDczfQ.J9x82H5Q5OCIEJRx4fDeCu1sHAGyaPKxk6BTOweJiJM";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- 身份驗證功能 ---
async function handleLogin() {
    const accEl = document.getElementById("login-account");
    const pwEl = document.getElementById("login-password");
    if (!accEl || !pwEl) return;

    const email = `${accEl.value.trim()}@demo.local`;
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password: pwEl.value });
    if (error) alert("登入失敗: " + error.message);
    else window.location.href = "ledger.html";
}

async function handleSignup() {
    const accEl = document.getElementById("signup-account");
    const pwEl = document.getElementById("signup-password");
    const nameEl = document.getElementById("signup-username");
    if (!accEl || !pwEl || !nameEl) return;

    const email = `${accEl.value.trim()}@demo.local`;
    const { data, error } = await supabaseClient.auth.signUp({ email, password: pwEl.value });
    
    if (error) return alert("註冊失敗: " + error.message);
    if (data.user) {
        await supabaseClient.from("profiles").insert([{ id: data.user.id, username: nameEl.value.trim() }]);
        alert("註冊成功！");
        window.location.href = "ledger.html";
    }
}

function toggleAuthMode() {
    document.getElementById("login-form")?.classList.toggle("hidden");
    document.getElementById("signup-form")?.classList.toggle("hidden");
}

async function handleLogout() {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
}

// --- 資料處理功能 (含時速) ---
async function loadLedger() {
    const tbody = document.getElementById("ledger-tbody");
    if (!tbody) return;

    const { data: logs, error } = await supabaseClient.from("cycling_logs").select("*").order("ride_date", { ascending: false });
    if (error) return console.error(error);

    // 統計計算
    if (logs.length > 0) {
        const totalCount = logs.length;
        const totalDist = logs.reduce((s, r) => s + (Number(r.distance) || 0), 0);
        const totalTime = logs.reduce((s, r) => s + (Number(r.duration) || 0), 0);
        
        document.getElementById("stat-total-count").textContent = totalCount;
        document.getElementById("stat-avg-duration").textContent = (totalTime / totalCount).toFixed(1) + " min";
        document.getElementById("stat-avg-speed").textContent = totalTime > 0 ? (totalDist / (totalTime / 60)).toFixed(1) + " km/h" : "0 km/h";
        document.getElementById("stats-bar")?.classList.remove("hidden");
    }

    const { data: profiles } = await supabaseClient.from("profiles").select("id, username");
    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.username]));

    tbody.innerHTML = logs.map(row => {
        const speed = row.duration > 0 ? (row.distance / (row.duration / 60)).toFixed(1) : 0;
        return `<tr>
            <td>${row.ride_date}</td>
            <td>${row.route_name}</td>
            <td>${row.distance} km</td>
            <td>${row.duration} min</td>
            <td style="color:blue; font-weight:bold;">${speed} km/h</td>
            <td>${profileMap[row.user_id] || '車友'}</td>
            <td><button onclick="deleteEntry(${row.id})">刪除</button></td>
        </tr>`;
    }).join("");
}

async function addEntry() {
    const date = document.getElementById("ride-date").value;
    const route = document.getElementById("ride-route").value;
    const dist = document.getElementById("ride-distance").value;
    const dur = document.getElementById("ride-duration").value;
    const diff = document.getElementById("ride-difficulty").value;

    if (!date || !route || !dist) return alert("請填寫必要欄位");

    const { error } = await supabaseClient.from("cycling_logs").insert([{
        ride_date: date, route_name: route, distance: parseFloat(dist), duration: parseInt(dur), difficulty: diff
    }]);
    if (error) alert("儲存失敗"); else loadLedger();
}

async function deleteEntry(id) {
    if (confirm("確定刪除？")) {
        await supabaseClient.from("cycling_logs").delete().eq("id", id);
        loadLedger();
    }
}

// --- 頁面偵測初始化 ---
document.addEventListener("DOMContentLoaded", async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const isIndex = !!document.getElementById("index-page");
    const isLedger = !!document.getElementById("ledger-page");

    if (document.getElementById("js-status")) document.getElementById("js-status").textContent = "✅ 系統已就緒";

    if (isIndex && user) window.location.href = "ledger.html";
    if (isLedger && !user) window.location.href = "index.html";

    if (user && isLedger) {
        const { data: p } = await supabaseClient.from("profiles").select("username").eq("id", user.id).single();
        document.getElementById("user-info").innerHTML = `🚲 嗨，${p?.username || '夥伴'}`;
        loadLedger();
    }
});

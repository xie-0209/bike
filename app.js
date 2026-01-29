const SUPABASE_URL = "https://bgiwbmmloczysitrepxt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnaXdibW1sb2N6eXNpdHJlcHh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQ4ODQ3MywiZXhwIjoyMDg1MDY0NDczfQ.J9x82H5Q5OCIEJRx4fDeCu1sHAGyaPKxk6BTOweJiJM";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Auth 功能
async function handleLogin() {
    const acc = document.getElementById("login-account")?.value.trim();
    const pw = document.getElementById("login-password")?.value;
    if(!acc || !pw) return alert("請輸入帳密");
    const { error } = await supabaseClient.auth.signInWithPassword({ email: `${acc}@demo.local`, password: pw });
    if(error) alert(error.message); else window.location.href = "ledger.html";
}

async function handleSignup() {
    const acc = document.getElementById("signup-account")?.value.trim();
    const pw = document.getElementById("signup-password")?.value;
    const name = document.getElementById("signup-username")?.value.trim();
    if(!acc || !pw || !name) return alert("請填寫完整");
    const { data, error } = await supabaseClient.auth.signUp({ email: `${acc}@demo.local`, password: pw });
    if(error) return alert(error.message);
    await supabaseClient.from("profiles").insert([{ id: data.user.id, username: name }]);
    window.location.href = "ledger.html";
}

function toggleAuthMode() {
    document.getElementById("login-form").classList.toggle("hidden");
    document.getElementById("signup-form").classList.toggle("hidden");
    const btn = document.getElementById("toggle-auth-btn");
    btn.textContent = btn.textContent.includes("註冊") ? "返回登入" : "前往註冊";
}

async function handleLogout() {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
}

// 資料功能
async function loadLedger() {
    const tbody = document.getElementById("ledger-tbody");
    if(!tbody) return;
    const { data: logs, error } = await supabaseClient.from("cycling_logs").select("*").order("ride_date", {ascending:false});
    if(error) return;

    // 簡單統計
    if(logs.length > 0) {
        document.getElementById("stat-total-count").textContent = logs.length;
        const avg = logs.reduce((s, r) => s + (Number(r.duration) || 0), 0) / logs.length;
        document.getElementById("stat-avg-duration").textContent = avg.toFixed(1) + " min";
        document.getElementById("stats-bar").classList.remove("hidden");
    }

    const { data: profiles } = await supabaseClient.from("profiles").select("id, username");
    const pMap = Object.fromEntries((profiles || []).map(p => [p.id, p.username]));

    tbody.innerHTML = logs.map(r => `
        <tr>
            <td>${r.ride_date}</td>
            <td>${r.route_name}</td>
            <td>${r.distance}km</td>
            <td>${r.duration}m</td>
            <td>${pMap[r.user_id] || '車友'}</td>
            <td><button onclick="deleteEntry(${r.id})">刪除</button></td>
        </tr>
    `).join("");
}

async function addEntry() {
    const payload = {
        ride_date: document.getElementById("ride-date").value,
        route_name: document.getElementById("ride-route").value,
        distance: parseFloat(document.getElementById("ride-distance").value),
        duration: parseInt(document.getElementById("ride-duration").value),
        difficulty: document.getElementById("ride-difficulty").value
    };
    if(!payload.ride_date || !payload.route_name) return alert("請填寫日期與路線");
    const { error } = await supabaseClient.from("cycling_logs").insert([payload]);
    if(error) alert("儲存失敗，請檢查資料庫約束"); else loadLedger();
}

async function deleteEntry(id) {
    if(confirm("確定刪除?")) { 
        await supabaseClient.from("cycling_logs").delete().eq("id", id); 
        loadLedger(); 
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if(document.getElementById("js-status")) document.getElementById("js-status").textContent = "✅ 系統就緒";
    if(user && document.getElementById("ledger-page")) {
        const { data: p } = await supabaseClient.from("profiles").select("username").eq("id", user.id).single();
        document.getElementById("user-info").innerHTML = `🚲 嗨，${p?.username || '夥伴'}`;
        loadLedger();
    }
});

// ===== 1. Supabase 連線設定 =====
const SUPABASE_URL = "https://bgiwbmmloczysitrepxt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnaXdibW1sb2N6eXNpdHJlcHh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQ4ODQ3MywiZXhwIjoyMDg1MDY0NDczfQ.J9x82H5Q5OCIEJRx4fDeCu1sHAGyaPKxk6BTOweJiJM";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== 2. 通用輔助函式 =====
function logDebug(msg) {
    const debugEl = document.getElementById("debug");
    if (debugEl) {
        debugEl.textContent += `[${new Date().toLocaleTimeString()}] ${msg}\n`;
    }
    console.log(msg);
}

// ===== 3. Auth 身份驗證模組 =====

// 處理登入
async function handleLogin() {
    try {
        const acc = document.getElementById("login-account").value.trim();
        const pw = document.getElementById("login-password").value;
        if (!acc || !pw) return alert("請輸入帳號與密碼");

        const email = `${acc}@demo.local`;
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pw });

        if (error) throw error;
        window.location.href = "ledger.html";
    } catch (err) {
        alert("登入失敗：" + err.message);
    }
}

// 處理註冊
async function handleSignup() {
    try {
        const acc = document.getElementById("signup-account").value.trim();
        const pw = document.getElementById("signup-password").value;
        const name = document.getElementById("signup-username").value.trim();

        if (!acc || !pw || !name) return alert("請填妥所有註冊欄位");
        if (pw.length < 6) return alert("密碼至少需要 6 位數");

        const email = `${acc}@demo.local`;
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({ email, password: pw });

        if (authError) throw authError;

        if (authData.user) {
            // 同步建立 Profile
            const { error: profileError } = await supabaseClient
                .from("profiles")
                .insert([{ id: authData.user.id, username: name, role: 'user' }]);
            
            if (profileError) logDebug("Profile 建立失敗: " + profileError.message);
            alert("註冊成功！請直接登入。");
            location.reload(); 
        }
    } catch (err) {
        alert("註冊失敗：" + err.message);
    }
}

// 切換登入/註冊模式
function toggleAuthMode() {
    const loginForm = document.getElementById("login-form");
    const signupForm = document.getElementById("signup-form");
    const btn = document.getElementById("toggle-auth-btn");
    
    if (loginForm.classList.contains("hidden")) {
        loginForm.classList.remove("hidden");
        signupForm.classList.add("hidden");
        btn.textContent = "還沒有帳號？前往註冊";
    } else {
        loginForm.classList.add("hidden");
        signupForm.classList.remove("hidden");
        btn.textContent = "已有帳號？返回登入";
    }
}

// 登出
async function handleLogout() {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
}

// ===== 4. 數據統計與清單模組 (後台專用) =====

async function loadLedger() {
    const tbody = document.getElementById("ledger-tbody");
    if (!tbody) return;

    try {
        // 1. 抓取騎乘紀錄
        const { data: logs, error: logError } = await supabaseClient
            .from("cycling_logs")
            .select("*")
            .order("ride_date", { ascending: false });

        if (logError) throw logError;

        // 2. 統計數據計算 (平均時速邏輯在此)
        const statCount = document.getElementById("stat-total-count");
        const statDur = document.getElementById("stat-avg-duration");
        const statSpeed = document.getElementById("stat-avg-speed");

        if (logs.length > 0 && statCount) {
            const totalCount = logs.length;
            const totalDist = logs.reduce((s, r) => s + (Number(r.distance) || 0), 0);
            const totalMin = logs.reduce((s, r) => s + (Number(r.duration) || 0), 0);

            statCount.textContent = totalCount;
            statDur.textContent = (totalMin / totalCount).toFixed(1) + " min";
            // 時速公式: 公里 / (分鐘/60)
            if (statSpeed) {
                const avgSpeed = totalMin > 0 ? (totalDist / (totalMin / 60)).toFixed(1) : "0.0";
                statSpeed.textContent = avgSpeed + " km/h";
            }
            document.getElementById("stats-bar")?.classList.remove("hidden");
        }

        // 3. 渲染表格
        const { data: profiles } = await supabaseClient.from("profiles").select("id, username");
        const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.username]));

        tbody.innerHTML = logs.map(row => {
            const d = Number(row.distance) || 0;
            const t = Number(row.duration) || 0;
            const speed = t > 0 ? (d / (t / 60)).toFixed(1) : "0.0";

            return `
                <tr>
                    <td>${row.ride_date}</td>
                    <td><strong>${row.route_name}</strong></td>
                    <td>${d} km</td>
                    <td>${t} min</td>
                    <td style="color: #2563eb; font-weight: bold;">${speed} km/h</td>
                    <td>${row.difficulty || '一般'}</td>
                    <td>${profileMap[row.user_id] || '車友'}</td>
                    <td><button onclick="deleteEntry(${row.id})" style="color:red; cursor:pointer; background:none; border:none;">刪除</button></td>
                </tr>
            `;
        }).join("");

        if (logs.length === 0) tbody.innerHTML = '<tr><td colspan="8">尚無紀錄</td></tr>';

    } catch (err) {
        logDebug("載入清單失敗: " + err.message);
    }
}

async function addEntry() {
    try {
        const payload = {
            ride_date: document.getElementById("ride-date").value,
            route_name: document.getElementById("ride-route").value,
            distance: parseFloat(document.getElementById("ride-distance").value),
            duration: parseInt(document.getElementById("ride-duration").value),
            difficulty: document.getElementById("ride-difficulty").value,
            note: document.getElementById("ride-note").value
        };

        if (!payload.ride_date || !payload.route_name || isNaN(payload.distance)) {
            return alert("請填寫日期、路線與距離");
        }

        const { error } = await supabaseClient.from("cycling_logs").insert([payload]);
        if (error) throw error;

        // 清空輸入並重新載入
        document.getElementById("ride-route").value = "";
        loadLedger();
    } catch (err) {
        alert("新增失敗：" + err.message);
    }
}

async function deleteEntry(id) {
    if (!confirm("確定刪除此紀錄？")) return;
    const { error } = await supabaseClient.from("cycling_logs").delete().eq("id", id);
    if (error) alert("刪除失敗");
    else loadLedger();
}

// ===== 5. 初始化頁面控制 =====
document.addEventListener("DOMContentLoaded", async () => {
    const jsStatus = document.getElementById("js-status");
    if (jsStatus) jsStatus.textContent = "✅ 系統已就緒";

    const { data: { user } } = await supabaseClient.auth.getUser();

    // 頁面跳轉守衛
    const isLedgerPage = !!document.getElementById("ledger-page");
    const isIndexPage = !!document.getElementById("index-page");

    if (isLedgerPage && !user) window.location.href = "index.html";
    if (isIndexPage && user) window.location.href = "ledger.html";

    // 載入用戶資料與紀錄
    if (user && isLedgerPage) {
        const { data: p } = await supabaseClient.from("profiles").select("username").eq("id", user.id).single();
        const userInfo = document.getElementById("user-info");
        if (userInfo) userInfo.innerHTML = `🚲 嗨，<strong>${p?.username || '車友'}</strong>`;
        
        // 顯示隱藏區域並讀取資料
        document.getElementById("ledger-input")?.classList.remove("hidden");
        document.getElementById("ledger-list")?.classList.remove("hidden");
        loadLedger();
    }
});

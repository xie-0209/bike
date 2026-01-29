// ===== 1. Supabase 設定 =====
const SUPABASE_URL = "https://bgiwbmmloczysitrepxt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnaXdibW1sb2N6eXNpdHJlcHh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQ4ODQ3MywiZXhwIjoyMDg1MDY0NDczfQ.J9x82H5Q5OCIEJRx4fDeCu1sHAGyaPKxk6BTOweJiJM"; // 務必更換為 anon key

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== 2. DOM 元素宣告 =====
const debugEl = document.getElementById("debug");
const ledgerTbodyEl = document.getElementById("ledger-tbody");
const userInfoEl = document.getElementById("user-info");
const jsStatusEl = document.getElementById("js-status");

function logDebug(msg, obj) {
  if (debugEl) {
    const text = `[${new Date().toLocaleTimeString()}] ${msg} ${obj ? JSON.stringify(obj) : ''}\n`;
    debugEl.textContent += text;
  }
  console.log("[DEBUG]", msg, obj || "");
}

if (jsStatusEl) jsStatusEl.textContent = "✅ 系統連線中...";

// ===== 3. Auth 邏輯 (註冊/登入/登出) =====

// 切換登入與註冊介面
function toggleAuthMode() {
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");
  const toggleBtn = document.getElementById("toggle-auth-btn");

  if (signupForm.classList.contains("hidden")) {
    loginForm.classList.add("hidden");
    signupForm.classList.remove("hidden");
    toggleBtn.textContent = "已有帳號？返回登入";
  } else {
    loginForm.classList.remove("hidden");
    signupForm.classList.add("hidden");
    toggleBtn.textContent = "還沒有帳號？前往註冊";
  }
}

// 註冊帳號
async function handleSignup() {
  const account = document.getElementById("signup-account").value.trim();
  const password = document.getElementById("signup-password").value;
  const username = document.getElementById("signup-username").value.trim();

  if (!account || !password || !username) return alert("請填寫所有欄位");
  
  const email = account + "@demo.local";
  logDebug("嘗試註冊...", { email });

  const { data: authData, error: authError } = await supabaseClient.auth.signUp({
    email,
    password,
  });

  if (authError) return alert("註冊失敗: " + authError.message);

  if (authData.user) {
    // 建立個人檔案
    const { error: profileError } = await supabaseClient
      .from("profiles")
      .insert([{ id: authData.user.id, username: username, role: "user" }]);

    if (profileError) logDebug("Profile 建立失敗", profileError);
    
    alert("註冊成功！");
    window.location.href = "ledger.html";
  }
}

// 登入功能
async function handleLogin() {
  const account = document.getElementById("login-account").value.trim();
  const password = document.getElementById("login-password").value;
  const email = account + "@demo.local";

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) return alert("登入失敗: " + error.message);
  
  window.location.href = "ledger.html";
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  window.location.href = "index.html";
}

async function getCurrentUser() {
  const { data } = await supabaseClient.auth.getUser();
  return data?.user || null;
}

// ===== 4. 資料與統計邏輯 =====

async function loadLedger() {
  if (!ledgerTbodyEl) return;
  const user = await getCurrentUser();
  if (!user) return;

  // 1. 抓取騎乘紀錄
  const { data: logs, error: logError } = await supabaseClient
    .from("cycling_logs")
    .select("*")
    .order("ride_date", { ascending: false });

  if (logError) return logDebug("讀取失敗", logError);

  // 2. 計算平均值並顯示
  const statsBar = document.getElementById("stats-bar");
  if (statsBar) {
    const totalCount = logs.length;
    let avgDuration = 0;
    if (totalCount > 0) {
      const totalDuration = logs.reduce((sum, row) => sum + (Number(row.duration) || 0), 0);
      avgDuration = (totalDuration / totalCount).toFixed(1);
      statsBar.classList.remove("hidden");
      document.getElementById("stat-total-count").textContent = totalCount;
      document.getElementById("stat-avg-duration").textContent = `${avgDuration} min`;
    }
  }

  // 3. 渲染表格
  const { data: profiles } = await supabaseClient.from("profiles").select("id, username");
  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.username]));

  ledgerTbodyEl.innerHTML = logs.length ? "" : '<tr><td colspan="7">尚無紀錄</td></tr>';
  logs.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.ride_date}</td>
      <td><strong>${row.route_name}</strong></td>
      <td>${row.distance} km</td>
      <td>${row.duration} min</td>
      <td><span class="tag user">${row.difficulty || '一般'}</span></td>
      <td>${profileMap[row.user_id] || '未知'}</td>
      <td><button class="btn-outline" onclick="deleteEntry(${row.id})" style="color:red">刪除</button></td>
    `;
    ledgerTbodyEl.appendChild(tr);
  });
}

// 新增紀錄
async function addEntry() {
  const payload = {
    ride_date: document.getElementById("ride-date").value,
    route_name: document.getElementById("ride-route").value,
    distance: parseFloat(document.getElementById("ride-distance").value),
    duration: parseInt(document.getElementById("ride-duration").value),
    difficulty: document.getElementById("ride-difficulty").value,
    note: document.getElementById("ride-note").value
  };

  if (!payload.ride_date || !payload.route_name || !payload.distance) return alert("請填寫必要欄位");

  const { error } = await supabaseClient.from("cycling_logs").insert(payload);
  if (error) alert("儲存失敗: " + error.message);
  else {
    document.getElementById("ride-route").value = "";
    loadLedger();
  }
}

async function deleteEntry(id) {
  if (!confirm("確定刪除？")) return;
  await supabaseClient.from("cycling_logs").delete().eq("id", id);
  loadLedger();
}

// ===== 5. 頁面初始化 =====
document.addEventListener("DOMContentLoaded", async () => {
  const user = await getCurrentUser();
  const isIndex = !!document.getElementById("index-page");
  const isLedger = !!document.getElementById("ledger-page");

  if (jsStatusEl) jsStatusEl.textContent = "✅ 系統就緒";

  if (isIndex && user) window.location.href = "ledger.html";
  if (isLedger && !user) window.location.href = "index.html";
  
  if (user && isLedger) {
    const { data: profile } = await supabaseClient.from("profiles").select("username").eq("id", user.id).single();
    if (userInfoEl) userInfoEl.innerHTML = `歡迎回來，<strong>${profile?.username || user.email}</strong>`;
    
    document.getElementById("ledger-input")?.classList.remove("hidden");
    document.getElementById("ledger-list")?.classList.remove("hidden");
    loadLedger();
  }
});

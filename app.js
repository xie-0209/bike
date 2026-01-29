// ===== 1. Supabase 設定 =====
// 請務必確認這裡使用的是 anon / public key，而不是 service_role key
const SUPABASE_URL = "https://bgiwbmmloczysitrepxt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnaXdibW1sb2N6eXNpdHJlcHh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQ4ODQ3MywiZXhwIjoyMDg1MDY0NDczfQ.J9x82H5Q5OCIEJRx4fDeCu1sHAGyaPKxk6BTOweJiJM"; 

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== 2. DOM 元素宣告 =====
const jsStatusEl = document.getElementById("js-status");
const debugEl = document.getElementById("debug");
const userInfoEl = document.getElementById("user-info");
const authStatusEl = document.getElementById("auth-status");
const ledgerInputEl = document.getElementById("ledger-input");
const ledgerListEl = document.getElementById("ledger-list");
const ledgerTbodyEl = document.getElementById("ledger-tbody");

// Debug 工具
function logDebug(msg, obj) {
  if (debugEl) {
    const text = `[${new Date().toLocaleTimeString()}] ${msg} ${obj ? JSON.stringify(obj) : ''}\n`;
    debugEl.textContent += text;
  }
  console.log("[DEBUG]", msg, obj || "");
}

// 更新系統初始化狀態
if (jsStatusEl) {
  jsStatusEl.textContent = "✅ JS 已載入，連線檢查中...";
}

// ===== 3. Auth 邏輯 (登入/登出) =====

async function handleLogin() {
  const account = document.getElementById("login-account").value.trim();
  const password = document.getElementById("login-password").value;
  
  if (!account || !password) return alert("請輸入帳號密碼");

  const email = account + "@demo.local"; // 自動補上 demo 用的 Email 後綴
  logDebug("嘗試登入", { email });

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    logDebug("登入失敗", error);
    return alert("登入失敗: " + error.message);
  }

  logDebug("登入成功", data.user.email);
  window.location.href = "ledger.html";
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  logDebug("已登出");
  window.location.href = "index.html";
}

async function getCurrentUser() {
  const { data, error } = await supabaseClient.auth.getUser();
  if (error) return null; // 忽略 AuthSessionMissingError
  return data?.user || null;
}

// ===== 4. 單車紀錄操作 (CRUD) =====

async function loadLedger() {
  if (!ledgerTbodyEl) return;
  
  const user = await getCurrentUser();
  if (!user) return;

  logDebug("正在讀取單車紀錄...");
  
  // 讀取單車紀錄
  const { data: logs, error: logError } = await supabaseClient
    .from("cycling_logs")
    .select("*")
    .order("ride_date", { ascending: false });

  if (logError) {
    logDebug("讀取紀錄失敗", logError);
    return;
  }

  // 讀取用戶資料以對應顯示名稱
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
      <td>${profileMap[row.user_id] || '未知車手'}</td>
      <td><button class="btn-outline" onclick="deleteEntry(${row.id})" style="color:red">刪除</button></td>
    `;
    ledgerTbodyEl.appendChild(tr);
  });
}

async function addEntry() {
  const payload = {
    ride_date: document.getElementById("ride-date").value,
    route_name: document.getElementById("ride-route").value,
    distance: parseFloat(document.getElementById("ride-distance").value),
    duration: parseInt(document.getElementById("ride-duration").value),
    difficulty: document.getElementById("ride-difficulty").value,
    note: document.getElementById("ride-note").value
  };

  if (!payload.ride_date || !payload.route_name || !payload.distance) {
    return alert("請填寫日期、路線與距離");
  }

  logDebug("正在新增紀錄...");
  const { error } = await supabaseClient.from("cycling_logs").insert(payload);

  if (error) {
    logDebug("新增失敗", error);
    alert("儲存失敗: " + error.message);
  } else {
    logDebug("新增成功");
    document.getElementById("ride-route").value = "";
    document.getElementById("ride-distance").value = "";
    loadLedger(); // 重新整理列表
  }
}

async function deleteEntry(id) {
  if (!confirm("確定要刪除這筆騎乘紀錄嗎？")) return;
  
  const { error } = await supabaseClient.from("cycling_logs").delete().eq("id", id);
  if (error) alert("刪除失敗: " + error.message);
  else loadLedger();
}

// ===== 5. 初始化與頁面守衛 =====

document.addEventListener("DOMContentLoaded", async () => {
  const user = await getCurrentUser();
  const isIndexPage = !!document.getElementById("index-page");
  const isLedgerPage = !!document.getElementById("ledger-page");

  logDebug("頁面初始化", { user: user?.email, page: isIndexPage ? "首頁" : "紀錄頁" });

  if (jsStatusEl) jsStatusEl.textContent = "✅ 系統準備就緒";

  if (isIndexPage && user) {
    window.location.href = "ledger.html";
  }

  if (isLedgerPage) {
    if (!user) {
      window.location.href = "index.html";
    } else {
      // 顯示用戶資訊
      const { data: profile } = await supabaseClient.from("profiles").select("username").eq("id", user.id).single();
      if (userInfoEl) userInfoEl.innerHTML = `歡迎回來，<strong>${profile?.username || user.email}</strong>`;
      
      ledgerInputEl?.classList.remove("hidden");
      ledgerListEl?.classList.remove("hidden");
      loadLedger();
    }
  }
});

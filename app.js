// ===== 1. Supabase 設定 (已存入您的連線資訊) =====
const SUPABASE_URL = "https://bgiwbmmloczysitrepxt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnaXdibW1sb2N6eXNpdHJlcHh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQ4ODQ3MywiZXhwIjoyMDg1MDY0NDczfQ.J9x82H5Q5OCIEJRx4fDeCu1sHAGyaPKxk6BTOweJiJM";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== 2. DOM 元素宣告 =====
const ledgerTbodyEl = document.getElementById("ledger-tbody");
const userInfoEl = document.getElementById("user-info");

// ===== 3. Auth 邏輯 (登入/註冊/登出) =====
async function handleLogin() {
  const account = document.getElementById("login-account").value.trim();
  const password = document.getElementById("login-password").value;
  const email = account + "@demo.local";
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) return alert("登入失敗: " + error.message);
  window.location.href = "ledger.html";
}

async function handleSignup() {
  const account = document.getElementById("signup-account").value.trim();
  const password = document.getElementById("signup-password").value;
  const username = document.getElementById("signup-username").value.trim();
  if (!account || !password || !username) return alert("請填寫所有欄位");
  const email = account + "@demo.local";
  const { data: authData, error: authError } = await supabaseClient.auth.signUp({ email, password });
  if (authError) return alert("註冊失敗: " + authError.message);
  if (authData.user) {
    await supabaseClient.from("profiles").insert([{ id: authData.user.id, username, role: "user" }]);
    alert("註冊成功！");
    window.location.href = "ledger.html";
  }
}

function toggleAuthMode() {
  document.getElementById("login-form").classList.toggle("hidden");
  document.getElementById("signup-form").classList.toggle("hidden");
  const btn = document.getElementById("toggle-auth-btn");
  btn.textContent = btn.textContent.includes("註冊") ? "已有帳號？返回登入" : "還沒有帳號？前往註冊";
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  window.location.href = "index.html";
}

// ===== 4. 數據與統計邏輯 (核心：平均時速計算) =====
async function loadLedger() {
  if (!ledgerTbodyEl) return;
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  // 抓取紀錄
  const { data: logs, error: logError } = await supabaseClient
    .from("cycling_logs")
    .select("*")
    .order("ride_date", { ascending: false });

  if (logError) return console.error(logError);

  // --- 統計計算 ---
  const statsBar = document.getElementById("stats-bar");
  if (statsBar && logs.length > 0) {
    const totalCount = logs.length;
    const totalDist = logs.reduce((sum, r) => sum + (Number(r.distance) || 0), 0);
    const totalTime = logs.reduce((sum, r) => sum + (Number(r.duration) || 0), 0);
    
    // 計算總平均時速: (總公里 / (總分鐘/60))
    const totalAvgSpeed = totalTime > 0 ? (totalDist /

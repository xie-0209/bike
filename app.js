const SUPABASE_URL = "https://xyiwwgmcduonlbdjgufr.supabase.co";
const SUPABASE_KEY = "sb_publishable_X53Cpp8dwHeL5zs06sOc4w_HV2fgguW";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const debugEl = document.getElementById("debug");
const ledgerTbodyEl = document.getElementById("ledger-tbody");

function logDebug(msg, obj) {
  if (debugEl) debugEl.textContent += `[${new Date().toLocaleTimeString()}] ${msg} ${obj ? JSON.stringify(obj) : ''}\n`;
}

// Auth 邏輯
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

// 資料操作邏輯
async function loadLedger() {
  if (!ledgerTbodyEl) return;
  const user = await getCurrentUser();
  if (!user) { window.location.href = "index.html"; return; }

  const { data, error } = await supabaseClient
    .from("cycling_logs")
    .select("*")
    .order("ride_date", { ascending: false });

  if (error) return logDebug("讀取失敗", error);

  // 取得所有 profiles 用於顯示名字
  const { data: profiles } = await supabaseClient.from("profiles").select("id, username");
  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p.username]));

  ledgerTbodyEl.innerHTML = data.length ? "" : '<tr><td colspan="7">尚無紀錄</td></tr>';
  data.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.ride_date}</td>
      <td><strong>${row.route_name}</strong></td>
      <td>${row.distance} km</td>
      <td>${row.duration} min</td>
      <td><span class="tag user">${row.difficulty}</span></td>
      <td>${profileMap[row.user_id] || '未知'}</td>
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

  if (!payload.ride_date || !payload.route_name || !payload.distance) return alert("請填寫必填欄位");

  const { error } = await supabaseClient.from("cycling_logs").insert(payload);
  if (error) alert("儲存失敗: " + error.message);
  else {
    document.getElementById("ride-route").value = "";
    loadLedger();
  }
}

async function deleteEntry(id) {
  if (!confirm("確定刪除此紀錄？")) return;
  await supabaseClient.from("cycling_logs").delete().eq("id", id);
  loadLedger();
}

// 初始化頁面
document.addEventListener("DOMContentLoaded", async () => {
  const user = await getCurrentUser();
  const isLedger = !!document.getElementById("ledger-page");

  if (isLedger && !user) window.location.href = "index.html";
  if (!isLedger && user) window.location.href = "ledger.html";
  
  if (user && isLedger) {
    document.getElementById("ledger-input").classList.remove("hidden");
    document.getElementById("ledger-list").classList.remove("hidden");
    loadLedger();
  }
});

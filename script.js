const STORE_KEY = "daily-focus:data:v2";
const SCHEMA_VERSION = 2;

function now() { return Date.now(); }
function pad(n) { return String(n).padStart(2, "0"); }
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function emptyStore() {
  return { meta: { schema: SCHEMA_VERSION, updatedAt: now() }, tasks: [] };
}
function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyStore();
    if (!Array.isArray(parsed.tasks)) parsed.tasks = [];
    if (!parsed.meta) parsed.meta = { schema: SCHEMA_VERSION };
    return parsed;
  } catch { return emptyStore(); }
}
function saveStore(store) {
  store.meta = store.meta || {};
  store.meta.schema = SCHEMA_VERSION;
  store.meta.updatedAt = now();
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}
function getTasks() { return loadStore().tasks; }
function setTasks(tasks) {
  const store = loadStore();
  store.tasks = tasks;
  saveStore(store);
}

// ===== DOM refs =====
const list          = document.getElementById("task-list");
const doneList      = document.getElementById("done-list");
const form          = document.getElementById("task-form");
const input         = document.getElementById("task-input");
const rankInput     = document.getElementById("task-rank");
const deadlineInput = document.getElementById("task-deadline");
const pctEl         = document.getElementById("pct");
const metaEl        = document.getElementById("meta");
const clearBtn      = document.getElementById("clear");
const doneToggle    = document.getElementById("done-toggle");
const doneSection   = document.getElementById("done-section");

deadlineInput.min = todayKey();

// ===== Helpers =====
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function rankLabel(r) { return r === 3 ? "High" : r === 2 ? "Med" : "Low"; }
function deadlineSort(d) { return d ? Date.parse(d) : Number.POSITIVE_INFINITY; }
function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    if (b.rank !== a.rank) return b.rank - a.rank;
    const da = deadlineSort(a.deadline), db = deadlineSort(b.deadline);
    if (da !== db) return da - db;
    return (a.createdAt ?? 0) - (b.createdAt ?? 0);
  });
}
function updateStats(tasks) {
  const total = tasks.length;
  const done  = tasks.filter(t => t.done).length;
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100);
  pctEl.textContent  = `${pct}%`;
  metaEl.textContent = `${done}/${total} done`;
}

// ===== Build row =====
function buildRow(t, tasks) {
  const today     = todayKey();
  const isOverdue = !t.done && t.deadline < today;
  const row       = el("li", `row ${t.done ? "done" : ""} ${isOverdue ? "overdue-row" : ""}`);

  const check     = el("button", "check", t.done ? "✓" : "");
  check.type      = "button";
  check.onclick   = () => { t.done = !t.done; setTasks(tasks); render(tasks); };

  const text      = el("button", "text", t.text);
  text.type       = "button";
  text.onclick    = () => {
    const next = prompt("Edit task:", t.text);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed) return;
    t.text = trimmed;
    setTasks(tasks); render(tasks);
  };

  const badges    = el("div", "badges");
  const rankBadge = el("span", "badge");
  rankBadge.innerHTML    = `Priority: <span class="rank">${rankLabel(t.rank)}</span>`;
  rankBadge.style.cursor = "pointer";
  rankBadge.onclick      = () => {
    const next = prompt("Priority (High/Medium/Low):", rankLabel(t.rank));
    if (next === null) return;
    const v = next.toLowerCase();
    if      (v.startsWith("h")) t.rank = 3;
    else if (v.startsWith("m")) t.rank = 2;
    else if (v.startsWith("l")) t.rank = 1;
    else return;
    setTasks(tasks); render(tasks);
  };

  const dueBadge        = el("span", `badge ${isOverdue ? "badge-overdue" : ""}`, `Due: ${t.deadline}`);
  dueBadge.style.cursor = "pointer";
  dueBadge.onclick      = () => {
    const next = prompt("New deadline (YYYY-MM-DD):", t.deadline);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed) return;
    if (trimmed < todayKey()) { alert("Deadline cannot be in the past."); return; }
    t.deadline = trimmed;
    setTasks(tasks); render(tasks);
  };
  badges.append(rankBadge, dueBadge);

  const trash     = el("button", "trash", "×");
  trash.type      = "button";
  trash.onclick   = () => {
    const wrap       = el("div", "confirm-wrap");
    const confirmBtn = el("button", "confirm-btn", "Confirm");
    const cancelBtn  = el("button", "cancel-btn",  "Cancel");
    confirmBtn.type  = cancelBtn.type = "button";
    confirmBtn.onclick = () => {
      const updated = getTasks().filter(x => x.id !== t.id);
      setTasks(updated); render(updated);
    };
    cancelBtn.onclick = () => render(tasks);
    wrap.append(confirmBtn, cancelBtn);
    row.replaceChild(wrap, trash);
  };

  const mid = el("div", "mid");
  mid.append(text, badges);
  row.append(check, mid, trash);
  return row;
}

// ===== Render =====
function render(tasks) {
  const active = sortTasks(tasks.filter(t => !t.done));
  const done   = sortTasks(tasks.filter(t => t.done));

  list.innerHTML = "";
  if (active.length === 0) list.appendChild(el("li", "empty", "No pending tasks."));
  else for (const t of active) list.appendChild(buildRow(t, tasks));

  doneList.innerHTML = "";
  if (done.length === 0) doneList.appendChild(el("li", "empty", "No completed tasks yet."));
  else for (const t of done) doneList.appendChild(buildRow(t, tasks));

  doneToggle.textContent = `Completed (${done.length}) ${doneSection.open ? "▲" : "▼"}`;
  updateStats(tasks);
}

doneToggle.addEventListener("click", () => {
  doneSection.open = !doneSection.open;
  const done = getTasks().filter(t => t.done).length;
  doneToggle.textContent = `Completed (${done}) ${doneSection.open ? "▲" : "▼"}`;
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const v = input.value.trim();
  if (!v) return;

  const rawRank = rankInput.value;
  if (!rawRank) {
    rankInput.style.borderColor = "#c33";
    setTimeout(() => rankInput.style.borderColor = "", 1500);
    return;
  }
  const deadline = deadlineInput.value;
  if (!deadline || deadline < todayKey()) {
    deadlineInput.style.borderColor = "#c33";
    setTimeout(() => deadlineInput.style.borderColor = "", 1500);
    return;
  }

  let tasks = getTasks();
  tasks = [{ id: crypto.randomUUID(), text: v, done: false,
    rank: parseInt(rawRank, 10), deadline, createdAt: Date.now() }, ...tasks];
  input.value = ""; rankInput.value = ""; deadlineInput.value = "";
  setTasks(tasks); render(tasks);
});

clearBtn.addEventListener("click", () => {
  if (!confirm("Clear all tasks?")) return;
  setTasks([]); render([]);
});

render(getTasks());

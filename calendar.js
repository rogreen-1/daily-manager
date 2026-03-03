const STORE_KEY = "daily-focus:data:v2";
const SCHEMA_VERSION = 2;

function now() { return Date.now(); }
function pad(n) { return String(n).padStart(2, "0"); }
function keyFromDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function todayKey() { return keyFromDate(new Date()); }

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
function getTasks() { return loadStore().tasks; }

// ===== Deadline map: { "YYYY-MM-DD": [...tasks] } =====
function buildDeadlineMap(tasks) {
  const map = {};
  for (const task of tasks) {
    if (!task.deadline) continue;
    if (!map[task.deadline]) map[task.deadline] = [];
    map[task.deadline].push(task);
  }
  return map;
}

// ===== DOM =====
const monthLabel = document.getElementById("monthLabel");
const weekdaysEl = document.getElementById("weekdays");
const grid       = document.getElementById("grid");
const dayPanel   = document.getElementById("dayPanel");

weekdaysEl.innerHTML = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
  .map(w => `<div>${w}</div>`).join("");

let view = new Date();
view.setDate(1);
let selectedKey = null;

document.getElementById("prev").onclick = () => {
  view.setMonth(view.getMonth() - 1);
  selectedKey = null;
  renderMonth();
};
document.getElementById("next").onclick = () => {
  view.setMonth(view.getMonth() + 1);
  selectedKey = null;
  renderMonth();
};

function renderMonth() {
  const deadlineMap = buildDeadlineMap(getTasks());
  const year  = view.getFullYear();
  const month = view.getMonth();

  monthLabel.textContent = view.toLocaleDateString(undefined, { month:"long", year:"numeric" });

  const startDow    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  grid.innerHTML    = "";

  for (let i = 0; i < startDow; i++) {
    const d = new Date(year, month, 1 - (startDow - i));
    grid.appendChild(dayCell(d, true, deadlineMap));
  }
  for (let day = 1; day <= daysInMonth; day++) {
    grid.appendChild(dayCell(new Date(year, month, day), false, deadlineMap));
  }
  while (grid.children.length % 7 !== 0) {
    const idx = grid.children.length - startDow;
    grid.appendChild(dayCell(new Date(year, month, idx + 1), true, deadlineMap));
  }

  if (selectedKey) renderPanel(selectedKey, deadlineMap);
  else dayPanel.innerHTML = "";
}

function dayCell(dateObj, muted, deadlineMap) {
  const today   = todayKey();
  const k       = keyFromDate(dateObj);
  const tasks   = deadlineMap[k] || [];
  const done    = tasks.filter(t => t.done).length;
  const overdue = tasks.some(t => !t.done && k < today);

  const cell = document.createElement("div");
  cell.className = ["day", muted ? "muted" : "", k === today ? "today" : "",
    overdue ? "overdue" : "", k === selectedKey ? "selected" : ""]
    .filter(Boolean).join(" ");

  const top = document.createElement("div");
  top.className = "daynum";
  top.textContent = dateObj.getDate();

  const count = document.createElement("div");
  count.className = "count";
  if (tasks.length > 0) count.textContent = `${done}/${tasks.length}`;

  cell.append(top, count);

  if (!muted) {
    cell.style.cursor = "pointer";
    cell.onclick = () => {
      selectedKey = selectedKey === k ? null : k;
      renderMonth();
    };
  }
  return cell;
}

function renderPanel(key, deadlineMap) {
  const tasks   = deadlineMap[key] || [];
  const today   = todayKey();
  const isPast  = key < today;

  const label = new Date(key + "T00:00:00").toLocaleDateString(undefined, {
    weekday:"long", month:"long", day:"numeric"
  });

  dayPanel.innerHTML = "";

  const header = document.createElement("div");
  header.className = "panel-header";

  const title = document.createElement("span");
  title.className   = "panel-title";
  title.textContent = label;

  const close = document.createElement("button");
  close.className   = "panel-close";
  close.textContent = "✕";
  close.type        = "button";
  close.onclick     = () => { selectedKey = null; renderMonth(); };

  header.append(title, close);
  dayPanel.appendChild(header);

  if (tasks.length === 0) {
    const empty = document.createElement("p");
    empty.className   = "panel-empty";
    empty.textContent = "No tasks due this day.";
    dayPanel.appendChild(empty);
    return;
  }

  const ul = document.createElement("ul");
  ul.className = "panel-list";

  [...tasks]
    .sort((a, b) => a.done !== b.done ? (a.done ? 1 : -1) : b.rank - a.rank)
    .forEach(t => {
      const li = document.createElement("li");
      li.className = `panel-row ${t.done ? "done" : ""} ${!t.done && isPast ? "overdue-row" : ""}`;

      const check = document.createElement("span");
      check.className   = `panel-check ${t.done ? "checked" : ""}`;
      check.textContent = t.done ? "✓" : "";

      const text = document.createElement("span");
      text.className   = "panel-text";
      text.textContent = t.text;

      const rank = document.createElement("span");
      rank.className = "badge";
      rank.innerHTML = `Priority: <span class="rank">${t.rank === 3 ? "High" : t.rank === 2 ? "Med" : "Low"}</span>`;

      const right = document.createElement("div");
      right.className = "panel-right";
      right.appendChild(rank);

      li.append(check, text, right);
      ul.appendChild(li);
    });

  dayPanel.appendChild(ul);
}
}

renderMonth();

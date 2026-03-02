const STORE_KEY = "daily-focus:data:v1";
const SCHEMA_VERSION = 1;

function now(){ return Date.now(); }
function pad(n){ return String(n).padStart(2,"0"); }
function keyFromDate(d){
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function emptyStore() {
  return { meta: { schema: SCHEMA_VERSION, updatedAt: now() }, days: {} };
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyStore();
    if (!parsed.days || typeof parsed.days !== "object") parsed.days = {};
    if (!parsed.meta || typeof parsed.meta !== "object") parsed.meta = { schema: SCHEMA_VERSION };
    return parsed;
  } catch {
    return emptyStore();
  }
}
// ===== End Storage =====


// ===== Build a deadline-indexed map from all tasks in the store =====
// Returns an object: { "YYYY-MM-DD": [ ...tasks ] }
// Tasks without a deadline are indexed under their creation day key.
function buildDeadlineMap(store) {
  const map = {};

  for (const [dayKey, dayData] of Object.entries(store.days)) {
    const tasks = Array.isArray(dayData.tasks) ? dayData.tasks : [];
    for (const task of tasks) {
      const key = task.deadline ? task.deadline : dayKey;
      if (!map[key]) map[key] = [];
      map[key].push(task);
    }
  }

  return map;
}
// ===== End deadline map =====


// ===== Calendar UI wiring =====
const monthLabel = document.getElementById("monthLabel");
const weekdaysEl = document.getElementById("weekdays");
const grid = document.getElementById("grid");

const weekdayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
weekdaysEl.innerHTML = weekdayNames.map(w => `<div>${w}</div>`).join("");

let view = new Date();
view.setDate(1);

document.getElementById("prev").onclick = () => {
  view.setMonth(view.getMonth() - 1);
  renderMonth();
};

document.getElementById("next").onclick = () => {
  view.setMonth(view.getMonth() + 1);
  renderMonth();
};

function renderMonth(){
  const store = loadStore();
  const deadlineMap = buildDeadlineMap(store);

  const year = view.getFullYear();
  const month = view.getMonth();

  monthLabel.textContent = view.toLocaleDateString(undefined, { month:"long", year:"numeric" });

  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  grid.innerHTML = "";

  // leading blanks (previous month days)
  for (let i = 0; i < startDow; i++){
    const d = new Date(year, month, 1 - (startDow - i));
    grid.appendChild(dayCell(d, true, deadlineMap));
  }

  // this month
  for (let day = 1; day <= daysInMonth; day++){
    const d = new Date(year, month, day);
    grid.appendChild(dayCell(d, false, deadlineMap));
  }

  // trailing blanks (next month days)
  while (grid.children.length % 7 !== 0){
    const idx = grid.children.length - startDow;
    const d = new Date(year, month, idx + 1);
    grid.appendChild(dayCell(d, true, deadlineMap));
  }

  renderWeek(deadlineMap);
}

function dayCell(dateObj, muted, deadlineMap){
  const todayKeyStr = keyFromDate(new Date());
  const k = keyFromDate(dateObj);

  const tasks = deadlineMap[k] || [];
  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;

  // Overdue: any unfinished task whose deadline has passed
  const overdue = tasks.some(t => !t.done && k < todayKeyStr);

  const cell = document.createElement("div");
  cell.className = `day ${muted ? "muted" : ""} ${k === todayKeyStr ? "today" : ""} ${overdue ? "overdue" : ""}`;

  const top = document.createElement("div");
  top.className = "daynum";
  top.textContent = dateObj.getDate();

  const count = document.createElement("div");
  count.className = "count";
  if (total > 0) count.textContent = `${done}/${total}`;

  cell.append(top, count);
  return cell;
}


// ===== WEEK VIEW =====
function renderWeek(deadlineMap){
  const weekContainer = document.getElementById("weekView");
  if (!weekContainer) return;

  weekContainer.innerHTML = "";

  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay()); // Sunday start

  for (let i = 0; i < 7; i++){
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const k = keyFromDate(d);

    const tasks = deadlineMap[k] || [];
    const total = tasks.length;
    const done = tasks.filter(t => t.done).length;

    const box = document.createElement("div");
    box.className = "weekbox";

    const label = document.createElement("div");
    label.className = "weeklabel";
    label.textContent = d.toLocaleDateString(undefined, { weekday:"short" });

    const stats = document.createElement("div");
    stats.className = "weekstats";
    stats.textContent = total ? `${done}/${total}` : "-";

    box.append(label, stats);
    weekContainer.appendChild(box);
  }
}

renderMonth();

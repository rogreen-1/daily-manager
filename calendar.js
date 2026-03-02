// ===== Storage (single source of truth) =====
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

function tasksForKey(store, k){
  return (store.days?.[k]?.tasks && Array.isArray(store.days[k].tasks)) ? store.days[k].tasks : [];
}

function renderMonth(){
  const store = loadStore();

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
    grid.appendChild(dayCell(d, true, store));
  }

  // this month
  for (let day = 1; day <= daysInMonth; day++){
    const d = new Date(year, month, day);
    grid.appendChild(dayCell(d, false, store));
  }

  // trailing blanks (next month days)
  while (grid.children.length % 7 !== 0){
    const idx = grid.children.length - startDow; // days already placed for this month
    const d = new Date(year, month, idx + 1);
    grid.appendChild(dayCell(d, true, store));
  }

  renderWeek(store);
}

function dayCell(dateObj, muted, store){
  const todayKeyStr = keyFromDate(new Date());
  const k = keyFromDate(dateObj);

  const tasks = tasksForKey(store, k);
  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;

  // Overdue: any unfinished task whose deadline is before today (YYYY-MM-DD compares lexicographically)
  const overdue = tasks.some(t => !t.done && t.deadline && t.deadline < todayKeyStr);

  const cell = document.createElement("div");
  cell.className = `day ${muted ? "muted" : ""} ${k === todayKeyStr ? "today" : ""} ${overdue ? "overdue" : ""}`;

  const top = document.createElement("div");
  top.className = "daynum";
  top.textContent = dateObj.getDate();

  const count = document.createElement("div");
  count.className = "count";
  if (total > 0) count.textContent = `${done}/${total}`;

  cell.append(top, count);

  // Intentionally NO click behavior (calendar is a dashboard)

  return cell;
}

/* --------- WEEK VIEW --------- */

function renderWeek(store){
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

    const tasks = tasksForKey(store, k);
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

const STORAGE_KEY = "daily-focus:by-date:v1";

function loadAll(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}; }
  catch { return {}; }
}

function pad(n){ return String(n).padStart(2,"0"); }
function keyFromDate(d){
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

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
  const data = loadAll();
  const year = view.getFullYear();
  const month = view.getMonth();

  monthLabel.textContent = view.toLocaleDateString(undefined, { month:"long", year:"numeric" });

  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  grid.innerHTML = "";

  // leading blanks
  for (let i=0; i<startDow; i++){
    const d = new Date(year, month, 1 - (startDow - i));
    grid.appendChild(dayCell(d, true, data));
  }

  // this month
  for (let day=1; day<=daysInMonth; day++){
    const d = new Date(year, month, day);
    grid.appendChild(dayCell(d, false, data));
  }

  // trailing blanks
  while (grid.children.length % 7 !== 0){
    const last = new Date(year, month, grid.children.length - startDow + 1);
    grid.appendChild(dayCell(last, true, data));
  }

  renderWeek();
}

function dayCell(dateObj, muted, data){
  const today = keyFromDate(new Date());
  const k = keyFromDate(dateObj);
  const tasks = Array.isArray(data[k]) ? data[k] : [];

  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;
  const overdue = tasks.some(t => !t.done && t.deadline && t.deadline < today);

  const cell = document.createElement("div");
  cell.className = `day ${muted ? "muted" : ""} ${k === today ? "today" : ""} ${overdue ? "overdue" : ""}`;

  const top = document.createElement("div");
  top.className = "daynum";
  top.textContent = dateObj.getDate();

  const count = document.createElement("div");
  count.className = "count";
  if (total > 0){
    count.textContent = `${done}/${total}`;
  }

  cell.append(top, count);

  // Removed click behavior entirely

  return cell;
}

/* --------- WEEK VIEW --------- */

function renderWeek(){
  const data = loadAll();
  const weekContainer = document.getElementById("weekView");

  if (!weekContainer) return;

  weekContainer.innerHTML = "";

  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay());

  for (let i=0; i<7; i++){
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const k = keyFromDate(d);

    const tasks = Array.isArray(data[k]) ? data[k] : [];
    const total = tasks.length;
    const done = tasks.filter(t => t.done).length;

    const box = document.createElement("div");
    box.className = "weekbox";

    const label = document.createElement("div");
    label.className = "weeklabel";
    label.textContent = d.toLocaleDateString(undefined,{ weekday:"short" });

    const stats = document.createElement("div");
    stats.className = "weekstats";
    stats.textContent = total ? `${done}/${total}` : "-";

    box.append(label, stats);
    weekContainer.appendChild(box);
  }
}

renderMonth();

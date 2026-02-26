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
  render();
};
document.getElementById("next").onclick = () => {
  view.setMonth(view.getMonth() + 1);
  render();
};

function render(){
  const data = loadAll();
  const year = view.getFullYear();
  const month = view.getMonth();

  monthLabel.textContent = view.toLocaleDateString(undefined, { month:"long", year:"numeric" });

  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  grid.innerHTML = "";

  // leading blanks from previous month
  for (let i=0; i<startDow; i++){
    const d = new Date(year, month, 1 - (startDow - i));
    grid.appendChild(dayCell(d, true, data));
  }

  // this month
  for (let day=1; day<=daysInMonth; day++){
    const d = new Date(year, month, day);
    grid.appendChild(dayCell(d, false, data));
  }

  // trailing to complete grid rows (optional)
  const totalCells = grid.children.length;
  const remainder = totalCells % 7;
  if (remainder !== 0){
    const add = 7 - remainder;
    for (let i=1; i<=add; i++){
      const d = new Date(year, month, daysInMonth + i);
      grid.appendChild(dayCell(d, true, data));
    }
  }
}

function dayCell(dateObj, muted, data){
  const k = keyFromDate(dateObj);
  const tasks = Array.isArray(data[k]) ? data[k] : [];
  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;

  const cell = document.createElement("div");
  cell.className = `day ${muted ? "muted" : ""}`;

  const top = document.createElement("div");
  top.className = "daynum";
  top.textContent = dateObj.getDate();

  const bottom = document.createElement("div");
  bottom.className = "dotrow";

  // Show up to 5 dots as a tiny “how full was the day” indicator
  const dots = Math.min(5, total);
  for (let i=0; i<dots; i++){
    const dot = document.createElement("div");
    dot.className = "dot" + (i < done ? " filled" : "");
    bottom.appendChild(dot);
  }

  cell.append(top, bottom);

  cell.onclick = () => {
    // Open that day in day-view
    window.location.href = `./index.html?date=${k}`;
  };

  return cell;
}

render();

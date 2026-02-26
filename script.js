const STORAGE_KEY = "daily-focus:by-date:v1";

const list = document.getElementById("task-list");
const form = document.getElementById("task-form");
const input = document.getElementById("task-input");
const rankInput = document.getElementById("task-rank");
const deadlineInput = document.getElementById("task-deadline");
const pctEl = document.getElementById("pct");
const metaEl = document.getElementById("meta");
const clearBtn = document.getElementById("clear");

function pad(n){ return String(n).padStart(2,"0"); }
function todayKey(){
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function getDateKeyFromURL(){
  const q = new URLSearchParams(location.search);
  return q.get("date") || todayKey();
}
const DATE_KEY = getDateKeyFromURL();

function loadAll() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}; }
  catch { return {}; }
}
function saveAll(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
function loadTasksForDay(dateKey){
  const data = loadAll();
  return Array.isArray(data[dateKey]) ? data[dateKey] : [];
}
function saveTasksForDay(dateKey, tasks){
  const data = loadAll();
  data[dateKey] = tasks;
  saveAll(data);
}

function updateStats(tasks) {
  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  pctEl.textContent = `${pct}%`;
  metaEl.textContent = `${done}/${total} done`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function rankLabel(r){ return r===3 ? "High" : r===2 ? "Med" : "Low"; }
function deadlineKey(d){ return d ? Date.parse(d) : Number.POSITIVE_INFINITY; }

function sortTasks(tasks) {
  return [...tasks].sort((a,b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;      // unfinished first
    if (b.rank !== a.rank) return b.rank - a.rank;      // rank high first
    const da = deadlineKey(a.deadline), db = deadlineKey(b.deadline);
    if (da !== db) return da - db;                      // earlier deadline first
    return (a.createdAt ?? 0) - (b.createdAt ?? 0);
  });
}

function render(tasks) {
  const sorted = sortTasks(tasks);
  list.innerHTML = "";

  if (sorted.length === 0) {
    list.appendChild(el("li","empty","No tasks yet. Keep it small: 3–5 is perfect."));
    updateStats(sorted);
    return;
  }

  for (const t of sorted) {
    const row = el("li", `row ${t.done ? "done" : ""}`);

    const check = el("button","check", t.done ? "✓" : "");
    check.type = "button";
    check.onclick = () => {
      t.done = !t.done;
      saveTasksForDay(DATE_KEY, tasks);
      render(tasks);
    };

    const text = el("button","text", t.text);
    text.type = "button";
    text.onclick = () => {
      const next = prompt("Edit task text:", t.text);
      if (next === null) return;
      const trimmed = next.trim();
      if (!trimmed) return;
      t.text = trimmed;
      saveTasksForDay(DATE_KEY, tasks);
      render(tasks);
    };

    // badges
    const badges = el("div","");
    badges.style.display="flex";
    badges.style.gap="8px";
    badges.style.alignItems="center";

    const rankBadge = el("span","badge","");
    rankBadge.innerHTML = `Priority: <span class="rank">${rankLabel(t.rank)}</span>`;
    rankBadge.style.cursor="pointer";
    rankBadge.onclick = () => {
      const next = prompt("Priority (High/Medium/Low):", rankLabel(t.rank));
      if (next === null) return;
      const v = next.toLowerCase();
      if (v.startsWith("h")) t.rank = 3;
      else if (v.startsWith("m")) t.rank = 2;
      else if (v.startsWith("l")) t.rank = 1;
      else return;
      saveTasksForDay(DATE_KEY, tasks);
      render(tasks);
    };
    badges.appendChild(rankBadge);

    const dueBadge = el("span","badge", t.deadline ? `Due: ${t.deadline}` : "Add due date");
    dueBadge.style.cursor="pointer";
    dueBadge.onclick = () => {
      const next = prompt("Deadline (YYYY-MM-DD) or blank to remove:", t.deadline || "");
      if (next === null) return;
      t.deadline = next.trim();
      saveTasksForDay(DATE_KEY, tasks);
      render(tasks);
    };
    badges.appendChild(dueBadge);

    // UI delete confirm (two-step)
    const trash = el("button","trash","×");
    trash.type = "button";

    trash.onclick = () => {
      const wrap = el("div","confirm-wrap");
      const confirmBtn = el("button","confirm-btn","Confirm");
      const cancelBtn  = el("button","cancel-btn","Cancel");
      confirmBtn.type = cancelBtn.type = "button";

      confirmBtn.onclick = () => {
        tasks = tasks.filter(x => x.id !== t.id);
        saveTasksForDay(DATE_KEY, tasks);
        render(tasks);
      };
      cancelBtn.onclick = () => render(tasks);

      wrap.append(confirmBtn, cancelBtn);
      row.replaceChild(wrap, trash);
    };

    const mid = el("div","");
    mid.style.flex="1";
    mid.style.display="flex";
    mid.style.flexDirection="column";
    mid.style.gap="8px";
    mid.append(text, badges);

    row.append(check, mid, trash);
    list.appendChild(row);
  }

  updateStats(tasks);
}

let tasks = loadTasksForDay(DATE_KEY);
render(tasks);

form.addEventListener("submit",(e)=>{
  e.preventDefault();
  const v = input.value.trim();
  if (!v) return;

  const rank = parseInt(rankInput.value || "2", 10); // default medium if blank
  const deadline = deadlineInput.value || "";

  tasks = [{
    id: crypto.randomUUID(),
    text: v,
    done: false,
    rank,
    deadline,
    createdAt: Date.now()
  }, ...tasks];

  input.value = "";
  deadlineInput.value = "";

  saveTasksForDay(DATE_KEY, tasks);
  render(tasks);
});

clearBtn.addEventListener("click",()=>{
  if (!confirm("Clear tasks for this day?")) return;
  tasks = [];
  saveTasksForDay(DATE_KEY, tasks);
  render(tasks);
});

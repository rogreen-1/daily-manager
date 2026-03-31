// ===== Storage =====
const STORE_KEY = "daily-focus:data:v2";
const SCHEMA_VERSION = 2;
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwVtDty4rlH40c4INa5oMwIbBjjwwTQBGlYcYPIpg61EDPSAmVxO5qKfO68mLaTiis5/exec";

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
// ===== End Storage =====

// ===== Google Calendar Sync =====
function syncToCalendar(tasks) {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === "YOUR_WEB_APP_URL_HERE") {
    console.warn("Apps Script URL not configured.");
    return;
  }
  console.log("Syncing tasks to Google Calendar...", tasks.length, "tasks");
  fetch(APPS_SCRIPT_URL, {
    method:  "POST",
    mode:    "no-cors",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ tasks })
  })
  .then(() => console.log("Sync request sent successfully."))
  .catch(err => console.error("Sync failed:", err));
}
// ===== End Google Calendar Sync =====

// ===== Recurring helpers =====
function nextDeadline(deadline, repeat) {
  const d = new Date(deadline + "T00:00:00");
  if (repeat === "daily")   d.setDate(d.getDate() + 1);
  if (repeat === "weekly")  d.setDate(d.getDate() + 7);
  if (repeat === "monthly") d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function spawnRecurrence(t) {
  return {
    id:        crypto.randomUUID(),
    text:      t.text,
    done:      false,
    rank:      t.rank,
    deadline:  nextDeadline(t.deadline, t.repeat),
    repeat:    t.repeat,
    createdAt: Date.now()
  };
}
// ===== End Recurring helpers =====

// ===== Missed task handling =====
function processMissedTasks() {
  const today = todayKey();
  let tasks   = getTasks();
  let changed = false;

  const toAdd = [];

  tasks = tasks.map(t => {
    // Skip tasks already done, already missed, no deadline, or not yet overdue
    if (t.done || t.missed || !t.deadline || t.deadline >= today) return t;

    changed = true;

    if (t.repeat) {
      // Walk forward from the overdue deadline, spawning a missed instance for
      // every period already past, then one live instance landing on/after today.
      let cursor = t;
      while (true) {
        const next = spawnRecurrence(cursor);
        if (next.deadline < today) {
          // This generated instance is also in the past — mark it missed too
          toAdd.push({ ...next, missed: true });
          cursor = next;
        } else {
          // First deadline that lands today or later → live, active instance
          toAdd.push(next);
          break;
        }
      }
    }

    // Mark the original overdue instance as missed
    return { ...t, missed: true };
  });

  if (changed) {
    // Prepend spawned instances so today's copy appears at the top of the list
    tasks = [...toAdd, ...tasks];
    setTasks(tasks);
    syncToCalendar(tasks);
    render(tasks);
  }
}
//===== End Missed Task Handling =====
// ===== ICS Export =====
function toICSDate(dateStr) { return dateStr.replace(/-/g, ""); }
function exportICS(tasks) {
  const pending = tasks.filter(t => !t.done && t.deadline);
  if (pending.length === 0) { alert("No pending tasks to export."); return; }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Daily Focus//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH"
  ];

  for (const t of pending) {
    const uid       = t.id + "@daily-focus";
    const dtstart   = toICSDate(t.deadline);
    const created   = new Date(t.createdAt).toISOString().replace(/[-:]/g,"").split(".")[0] + "Z";
    const rankStr   = t.rank === 3 ? "High" : t.rank === 2 ? "Medium" : "Low";
    const repeatStr = t.repeat ? ` [Repeats ${t.repeat}]` : "";

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${created}`);
    lines.push(`DTSTART;VALUE=DATE:${dtstart}`);
    lines.push(`DTEND;VALUE=DATE:${dtstart}`);
    lines.push(`SUMMARY:${t.text}${repeatStr}`);
    lines.push(`DESCRIPTION:Priority: ${rankStr}. Added: ${new Date(t.createdAt).toLocaleDateString()}.`);
    lines.push(`PRIORITY:${t.rank === 3 ? 1 : t.rank === 2 ? 5 : 9}`);
    if (t.repeat) {
      const freq = t.repeat === "daily" ? "DAILY" : t.repeat === "weekly" ? "WEEKLY" : "MONTHLY";
      lines.push(`RRULE:FREQ=${freq}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "daily-focus-tasks.ics";
  a.click();
  URL.revokeObjectURL(url);
}
// ===== End ICS Export =====

// ===== Weekly stats =====
function getWeekBounds() {
  const now   = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  return { start: fmt(start), end: fmt(end) };
}

function updateStats(tasks) {
  const { start, end } = getWeekBounds();
  const weekly = tasks.filter(t => t.deadline >= start && t.deadline <= end);
  const total  = weekly.length;
  const done   = weekly.filter(t => t.done).length;
  const pct    = total === 0 ? 0 : Math.round((done / total) * 100);
  pctEl.textContent  = `${pct}%`;
  metaEl.textContent = total === 0 ? "No tasks this week" : `${done}/${total} this week`;
}
// ===== End Weekly stats =====

// ===== DOM refs =====
const list           = document.getElementById("task-list");
const missedList     = document.getElementById("missed-list");
const missedWrapper  = document.getElementById("missed-wrapper");
const missedToggle   = document.getElementById("missed-toggle");
const missedSection  = document.getElementById("missed-section");
const doneList       = document.getElementById("done-list");
const form           = document.getElementById("task-form");
const input          = document.getElementById("task-input");
const rankInput      = document.getElementById("task-rank");
const deadlineInput  = document.getElementById("task-deadline");
const repeatInput    = document.getElementById("task-repeat");
const pctEl          = document.getElementById("pct");
const metaEl         = document.getElementById("meta");
const clearBtn       = document.getElementById("clear");
const exportBtn      = document.getElementById("export-ics");
const doneToggle     = document.getElementById("done-toggle");
const doneSection    = document.getElementById("done-section");

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
function formatDate(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric"
  });
}
function formatAdded(ts) {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric"
  });
}

// ===== Build row =====
function buildRow(t, tasks, isMissed = false) {
  const today     = todayKey();
  const isOverdue = !t.done && t.deadline < today;
  const row       = el("li", `row ${t.done ? "done" : ""} ${isOverdue ? "overdue-row" : ""} ${isMissed ? "missed-row" : ""}`);

  const check   = el("button", "check", t.done ? "✓" : "");
  check.type    = "button";
  check.onclick = () => {
    t.done   = !t.done;
    t.missed = t.done ? false : t.missed;
    let updated = getTasks().map(x => x.id === t.id ? t : x);
    if (t.done && t.repeat) updated = [spawnRecurrence(t), ...updated];
    setTasks(updated);
    syncToCalendar(updated);
    render(updated);
  };

  const text   = el("button", "text", t.text);
  text.type    = "button";
  text.onclick = () => {
    const next = prompt("Edit task:", t.text);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed) return;
    t.text = trimmed;
    setTasks(tasks); syncToCalendar(tasks); render(tasks);
  };

  const dateMeta  = el("div", "task-dates");
  const addedSpan = el("span", "task-date-item", `Added: ${formatAdded(t.createdAt)}`);
  const dueSpan   = el("span", `task-date-item ${isOverdue ? "date-overdue" : ""}`, `Due: ${formatDate(t.deadline)}`);
  dateMeta.append(addedSpan, dueSpan);

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
    setTasks(tasks); syncToCalendar(tasks); render(tasks);
  };
  if (t.repeat) badges.appendChild(el("span", "badge", `↻ ${t.repeat}`));
  badges.appendChild(rankBadge);

  const trash     = el("button", "trash", "×");
  trash.type      = "button";
  trash.onclick   = () => {
    const wrap       = el("div", "confirm-wrap");
    const confirmBtn = el("button", "confirm-btn", "Confirm");
    const cancelBtn  = el("button", "cancel-btn",  "Cancel");
    confirmBtn.type  = cancelBtn.type = "button";
    confirmBtn.onclick = () => {
      const updated = getTasks().filter(x => x.id !== t.id);
      setTasks(updated); syncToCalendar(updated); render(updated);
    };
    cancelBtn.onclick = () => render(tasks);
    wrap.append(confirmBtn, cancelBtn);
    row.replaceChild(wrap, trash);
  };

  const mid = el("div", "mid");
  mid.append(text, dateMeta, badges);
  row.append(check, mid, trash);
  return row;
}

// ===== Render =====
function render(tasks) {
  const today   = todayKey();
  const active  = sortTasks(tasks.filter(t => !t.done && !t.missed && t.deadline >= today));
  const missed  = sortTasks(tasks.filter(t => !t.done && t.missed));
  const done    = sortTasks(tasks.filter(t => t.done));

  // Active
  list.innerHTML = "";
  if (active.length === 0) list.appendChild(el("li", "empty", "No pending tasks."));
  else for (const t of active) list.appendChild(buildRow(t, tasks, false));

  // Missed
  missedWrapper.style.display = missed.length > 0 ? "block" : "none";
  missedList.innerHTML = "";
  for (const t of missed) missedList.appendChild(buildRow(t, tasks, true));
  const missedOpen = missedSection.classList.contains("open");
  missedToggle.textContent = `⚠ Missed (${missed.length}) ${missedOpen ? "▲" : "▼"}`;

  // Done
  doneList.innerHTML = "";
  if (done.length === 0) doneList.appendChild(el("li", "empty", "No completed tasks yet."));
  else for (const t of done) doneList.appendChild(buildRow(t, tasks, false));
  const doneOpen = doneSection.classList.contains("open");
  doneToggle.textContent = `Completed (${done.length}) ${doneOpen ? "▲" : "▼"}`;

  updateStats(tasks);
}

// ===== Toggles =====
missedToggle.addEventListener("click", () => {
  missedSection.classList.toggle("open");
  const missed = getTasks().filter(t => !t.done && t.missed).length;
  const isOpen = missedSection.classList.contains("open");
  missedToggle.textContent = `⚠ Missed (${missed}) ${isOpen ? "▲" : "▼"}`;
});

doneToggle.addEventListener("click", () => {
  doneSection.classList.toggle("open");
  const isOpen = doneSection.classList.contains("open");
  const done   = getTasks().filter(t => t.done).length;
  doneToggle.textContent = `Completed (${done}) ${isOpen ? "▲" : "▼"}`;
});

// ===== Form submit =====
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

  const repeat = repeatInput.value || null;
  let tasks = getTasks();
  tasks = [{
    id: crypto.randomUUID(), text: v, done: false, missed: false,
    rank: parseInt(rawRank, 10), deadline, repeat, createdAt: Date.now()
  }, ...tasks];

  input.value = ""; rankInput.value = ""; deadlineInput.value = ""; repeatInput.value = "";
  setTasks(tasks); syncToCalendar(tasks); render(tasks);
});

// ===== Export ICS =====
exportBtn.addEventListener("click", () => exportICS(getTasks()));

// ===== Clear all =====
clearBtn.addEventListener("click", () => {
  if (!confirm("Clear all tasks?")) return;
  setTasks([]); syncToCalendar([]); render([]);
});

// ===== Init =====
processMissedTasks();
render(getTasks());

const STORAGE_KEY = "daily-focus:v2";

const list = document.getElementById("task-list");
const form = document.getElementById("task-form");
const input = document.getElementById("task-input");
const rankInput = document.getElementById("task-rank");
const deadlineInput = document.getElementById("task-deadline");
const pctEl = document.getElementById("pct");
const metaEl = document.getElementById("meta");
const clearBtn = document.getElementById("clear");

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

function save(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
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

function rankLabel(r) {
  if (r === 3) return "High";
  if (r === 2) return "Med";
  return "Low";
}

function deadlineKey(d) {
  // for sorting; empty deadlines go last
  return d ? Date.parse(d) : Number.POSITIVE_INFINITY;
}

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    // unfinished first
    if (a.done !== b.done) return a.done ? 1 : -1;

    // rank high -> low
    if (b.rank !== a.rank) return b.rank - a.rank;

    // earlier deadline first (no deadline last)
    const da = deadlineKey(a.deadline);
    const db = deadlineKey(b.deadline);
    if (da !== db) return da - db;

    // stable-ish fallback: older first
    return (a.createdAt ?? 0) - (b.createdAt ?? 0);
  });
}

function render(tasks) {
  const sorted = sortTasks(tasks);
  list.innerHTML = "";

  if (sorted.length === 0) {
    list.appendChild(el("li", "empty", "No tasks yet."));
    updateStats(sorted);
    return;
  }

  for (const t of sorted) {
    const row = el("li", `row ${t.done ? "done" : ""}`);

    const check = el("button", "check", t.done ? "✓" : "");
    check.type = "button";
    check.onclick = () => {
      t.done = !t.done;
      save(tasks);
      render(tasks);
    };

    const text = el("button", "text", t.text);
    text.type = "button";
    text.onclick = () => {
      const next = prompt("Edit task text:", t.text);
      if (next === null) return;
      const trimmed = next.trim();
      if (!trimmed) return;
      t.text = trimmed;
      save(tasks);
      render(tasks);
    };

    // meta badges: rank + deadline
    const badges = el("div", "badges");
    badges.style.display = "flex";
    badges.style.gap = "8px";
    badges.style.alignItems = "center";

    const rankBadge = el("span", "badge", "");
    rankBadge.innerHTML = `Priority: <span class="rank">${rankLabel(t.rank)}</span>`;
    rankBadge.title = "Click to change priority";
    rankBadge.style.cursor = "pointer";
    rankBadge.onclick = () => {
      const next = prompt("Priority (High/Medium/Low):", rankLabel(t.rank));
      if (next === null) return;
      const v = next.toLowerCase();
      if (v.startsWith("h")) t.rank = 3;
      else if (v.startsWith("m")) t.rank = 2;
      else if (v.startsWith("l")) t.rank = 1;
      else return;
      save(tasks);
      render(tasks);
    };

    badges.appendChild(rankBadge);

    if (t.deadline) {
      const dBadge = el("span", "badge", `Due: ${t.deadline}`);
      dBadge.title = "Click to edit deadline";
      dBadge.style.cursor = "pointer";
      dBadge.onclick = () => {
        const next = prompt("Deadline (YYYY-MM-DD) or blank to remove:", t.deadline);
        if (next === null) return;
        const trimmed = next.trim();
        t.deadline = trimmed === "" ? "" : trimmed;
        save(tasks);
        render(tasks);
      };
      badges.appendChild(dBadge);
    } else {
      const addDue = el("span", "badge", "Add due date");
      addDue.title = "Click to add a deadline";
      addDue.style.cursor = "pointer";
      addDue.onclick = () => {
        const next = prompt("Deadline (YYYY-MM-DD):", "");
        if (next === null) return;
        const trimmed = next.trim();
        if (!trimmed) return;
        t.deadline = trimmed;
        save(tasks);
        render(tasks);
      };
      badges.appendChild(addDue);
    }

    const trash = el("button", "trash", "×");
    trash.type = "button";
    trash.onclick = () => {
      tasks = tasks.filter(x => x.id !== t.id);
      save(tasks);
      render(tasks);
    };

    // Layout: check + text + badges + delete
    const mid = el("div", "");
    mid.style.flex = "1";
    mid.style.display = "flex";
    mid.style.flexDirection = "column";
    mid.style.gap = "8px";

    mid.appendChild(text);
    mid.appendChild(badges);

    row.append(check, mid, trash);
    list.appendChild(row);
  }

  updateStats(tasks);
}

let tasks = load();
render(tasks);

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const v = input.value.trim();
  if (!v) return;

  const rank = parseInt(rankInput.value, 10);     // 1..3
  const deadline = deadlineInput.value || "";     // "" or YYYY-MM-DD

  tasks = [
    {
      id: crypto.randomUUID(),
      text: v,
      done: false,
      rank,
      deadline,
      createdAt: Date.now(),
    },
    ...tasks,
  ];

  input.value = "";
  deadlineInput.value = "";
  rankInput.value = "";

  save(tasks);
  render(tasks);
});

const trash = el("button", "trash", "×");
trash.type = "button";

trash.onclick = () => {
  // Replace trash button with confirm controls
  const confirmWrap = el("div", "confirm-wrap");

  const confirmBtn = el("button", "confirm-btn", "Confirm");
  confirmBtn.type = "button";

  const cancelBtn = el("button", "cancel-btn", "Cancel");
  cancelBtn.type = "button";

  confirmBtn.onclick = () => {
    tasks = tasks.filter(x => x.id !== t.id);
    save(tasks);
    render(tasks);
  };

  cancelBtn.onclick = () => {
    render(tasks);
  };

  confirmWrap.append(confirmBtn, cancelBtn);

  // Replace trash button visually
  row.replaceChild(confirmWrap, trash);
};

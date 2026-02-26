const STORAGE_KEY = "daily-focus:v1";

const list = document.getElementById("task-list");
const form = document.getElementById("task-form");
const input = document.getElementById("task-input");
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

function render(tasks) {
  list.innerHTML = "";

  if (tasks.length === 0) {
    list.appendChild(el("li", "empty", "No tasks yet. Keep it small: 3–5 is perfect."));
    updateStats(tasks);
    return;
  }

  for (const t of tasks) {
    const row = el("li", `row ${t.done ? "done" : ""}`);

    const check = el("button", "check", t.done ? "✓" : "");
    check.type = "button";
    check.ariaLabel = "toggle";
    check.onclick = () => {
      t.done = !t.done;
      save(tasks);
      render(tasks);
    };

    const text = el("button", "text", t.text);
    text.type = "button";
    text.onclick = () => {
      const next = prompt("Edit task:", t.text);
      if (next === null) return;
      const trimmed = next.trim();
      if (!trimmed) return;
      t.text = trimmed;
      save(tasks);
      render(tasks);
    };

    const trash = el("button", "trash", "×");
    trash.type = "button";
    trash.ariaLabel = "delete";
    trash.onclick = () => {
      const next = tasks.filter(x => x.id !== t.id);
      tasks = next;
      save(tasks);
      render(tasks);
    };

    row.append(check, text, trash);
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

  tasks = [{ id: crypto.randomUUID(), text: v, done: false }, ...tasks];
  input.value = "";
  save(tasks);
  render(tasks);
});

clearBtn.addEventListener("click", () => {
  if (!confirm("Clear today’s tasks?")) return;
  tasks = [];
  save(tasks);
  render(tasks);
});

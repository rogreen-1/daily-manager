const STORAGE_KEY = "daily-focus:v1";
const list = document.getElementById("task-list");
const form = document.getElementById("task-form");
const input = document.getElementById("task-input");
const pctEl = document.getElementById("pct");
const metaEl = document.getElementById("meta");

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

function stats(tasks) {
  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  pctEl.textContent = `${pct}%`;
  metaEl.textContent = `${done}/${total} done`;
}

function render(tasks) {
  list.innerHTML = "";
  if (tasks.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No tasks yet. Keep it small: 3–5 is perfect.";
    list.appendChild(li);
    stats(tasks);
    return;
  }

  for (const t of tasks) {
    const li = document.createElement("li");
    li.className = `row ${t.done ? "done" : ""}`;

    const check = document.createElement("button");
    check.className = "check";
    check.textContent = t.done ? "✓" : "";
    check.onclick = () => {
      t.done = !t.done;
      save(tasks);
      render(tasks);
    };

    const text = document.createElement("button");
    text.className = "text";
    text.textContent = t.text;
    text.onclick = () => {
      const next = prompt("Edit task:", t.text);
      if (next === null) return;
      const trimmed = next.trim();
      if (!trimmed) return;
      t.text = trimmed;
      save(tasks);
      render(tasks);
    };

    const del = document.createElement("button");
    del.className = "trash";
    del.textContent = "×";
    del.onclick = () => {
      const next = tasks.filter(x => x.id !== t.id);
      save(next);
      render(next);
    };

    li.append(check, text, del);
    list.appendChild(li);
  }

  stats(tasks);
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

document.getElementById("clear").addEventListener("click", () => {
  if (!confirm("Clear all tasks?")) return;
  tasks = [];
  save(tasks);
  render(tasks);
});

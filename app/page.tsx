"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Task = {
  id: string;
  title: string;
  course: string;
  due: string;
  effort: number;
  importance: number;
  done: boolean;
  createdAt: number;
};

const STORAGE_KEY = "semester-focus-tasks-v1";
const COURSE_COLORS: Record<string, string> = {
  Biology: "#e06a47",
  Literature: "#8468d7",
  Calculus: "#2f86c5",
  History: "#2d9772",
};

function dateOffset(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const starterTasks: Task[] = [
  { id: "sample-1", title: "Finish lab report discussion", course: "Biology", due: dateOffset(1), effort: 2, importance: 3, done: false, createdAt: Date.now() },
  { id: "sample-2", title: "Read chapters 6–7", course: "Literature", due: dateOffset(3), effort: 1, importance: 2, done: false, createdAt: Date.now() - 1 },
  { id: "sample-3", title: "Problem set 4", course: "Calculus", due: dateOffset(2), effort: 3, importance: 3, done: false, createdAt: Date.now() - 2 },
  { id: "sample-4", title: "Choose research paper sources", course: "History", due: dateOffset(6), effort: 1, importance: 2, done: false, createdAt: Date.now() - 3 },
];

function daysUntil(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${date}T00:00:00`);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function score(task: Task) {
  const days = daysUntil(task.due);
  const urgency = days < 0 ? 12 : days === 0 ? 10 : Math.max(0, 9 - days);
  return urgency + task.importance * 4 + task.effort;
}

function dueLabel(date: string) {
  const days = daysUntil(date);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

function priorityLabel(task: Task) {
  const value = score(task);
  return value >= 21 ? "Do first" : value >= 16 ? "Plan next" : "On deck";
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>(starterTasks);
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState("All courses");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [course, setCourse] = useState("Biology");
  const [due, setDue] = useState(dateOffset(1));
  const [effort, setEffort] = useState(2);
  const [importance, setImportance] = useState(2);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setTasks(JSON.parse(saved));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks, ready]);

  const active = useMemo(
    () => tasks.filter((task) => !task.done).sort((a, b) => score(b) - score(a)),
    [tasks],
  );
  const visible = filter === "All courses" ? active : active.filter((task) => task.course === filter);
  const focusTask = active[0];
  const completed = tasks.filter((task) => task.done).length;
  const courses = Array.from(new Set([...Object.keys(COURSE_COLORS), ...tasks.map((task) => task.course)]));

  function addTask(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setTasks((current) => [
      ...current,
      { id: crypto.randomUUID(), title: title.trim(), course, due, effort, importance, done: false, createdAt: Date.now() },
    ]);
    setTitle("");
    setDue(dateOffset(1));
    setEffort(2);
    setImportance(2);
    setShowForm(false);
  }

  function toggleTask(id: string) {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, done: !task.done } : task));
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Semester Focus home">
          <span className="brand-mark">S</span>
          <span>Semester Focus</span>
        </a>
        <div className="header-actions">
          <span className="saved-label"><span className="saved-dot" /> Saved on this device</span>
          <button className="add-button" onClick={() => setShowForm(true)}><span>＋</span> Add task</button>
        </div>
      </header>

      <section className="page" id="top">
        <div className="intro-row">
          <div>
            <p className="eyebrow">YOUR SEMESTER, ONE STEP AT A TIME</p>
            <h1>Good evening. Let&apos;s make<br />tomorrow feel lighter.</h1>
          </div>
          <div className="mini-stats" aria-label="Task summary">
            <div><strong>{active.length}</strong><span>open</span></div>
            <div><strong>{completed}</strong><span>done</span></div>
          </div>
        </div>

        <section className="focus-card" aria-labelledby="focus-heading">
          <div className="focus-copy">
            <p className="focus-kicker"><span className="spark">✦</span> YOUR BEST NEXT MOVE</p>
            {focusTask ? (
              <>
                <h2 id="focus-heading">{focusTask.title}</h2>
                <div className="focus-meta">
                  <span className="course-dot" style={{ background: COURSE_COLORS[focusTask.course] || "#d07a4a" }} />
                  {focusTask.course}<span className="separator">•</span>{dueLabel(focusTask.due)}<span className="separator">•</span>{focusTask.effort * 25} min
                </div>
                <p className="focus-reason">It&apos;s important, coming up soon, and finishing it will clear the most mental space.</p>
              </>
            ) : (
              <>
                <h2 id="focus-heading">You&apos;re all caught up.</h2>
                <p className="focus-reason">Add your next assignment when it lands.</p>
              </>
            )}
          </div>
          {focusTask && <button className="start-button" onClick={() => toggleTask(focusTask.id)}>Mark complete <span>→</span></button>}
          <div className="focus-number" aria-hidden="true">01</div>
        </section>

        <section className="tasks-section" aria-labelledby="tasks-heading">
          <div className="section-heading">
            <div><p className="eyebrow">PRIORITIZED FOR YOU</p><h2 id="tasks-heading">What&apos;s on your plate</h2></div>
            <label className="filter-label">View
              <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option>All courses</option>
                {courses.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          </div>

          <div className="task-list">
            {visible.map((task, index) => (
              <article className="task-row" key={task.id}>
                <button className="check" onClick={() => toggleTask(task.id)} aria-label={`Complete ${task.title}`} />
                <div className="rank">{String(index + 1).padStart(2, "0")}</div>
                <div className="task-main">
                  <h3>{task.title}</h3>
                  <p><span className="course-dot" style={{ background: COURSE_COLORS[task.course] || "#d07a4a" }} />{task.course}<span>•</span>{dueLabel(task.due)}<span>•</span>{task.effort * 25} min</p>
                </div>
                <div className={`priority priority-${priorityLabel(task).toLowerCase().replace(" ", "-")}`}>{priorityLabel(task)}</div>
              </article>
            ))}
            {!visible.length && <div className="empty-state"><span>✓</span><h3>Nothing waiting here</h3><p>Pick another course or add a new task.</p></div>}
          </div>
        </section>

        {completed > 0 && (
          <details className="completed-section">
            <summary>{completed} completed {completed === 1 ? "task" : "tasks"}</summary>
            {tasks.filter((task) => task.done).map((task) => (
              <button key={task.id} onClick={() => toggleTask(task.id)}>↩ Restore “{task.title}”</button>
            ))}
          </details>
        )}
      </section>

      {showForm && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowForm(false)}>
          <form className="task-form" onSubmit={addTask} onMouseDown={(event) => event.stopPropagation()}>
            <div className="form-title"><div><p className="eyebrow">QUICK CAPTURE</p><h2>Add a task</h2></div><button type="button" className="close" onClick={() => setShowForm(false)} aria-label="Close">×</button></div>
            <label>What needs doing?<input autoFocus required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Draft essay introduction" /></label>
            <div className="form-grid">
              <label>Course<input list="courses" value={course} onChange={(event) => setCourse(event.target.value)} /><datalist id="courses">{courses.map((item) => <option key={item} value={item} />)}</datalist></label>
              <label>Due date<input type="date" required value={due} onChange={(event) => setDue(event.target.value)} /></label>
              <label>Effort<select value={effort} onChange={(event) => setEffort(Number(event.target.value))}><option value={1}>Quick · 25 min</option><option value={2}>Medium · 50 min</option><option value={3}>Deep · 75 min</option></select></label>
              <label>Importance<select value={importance} onChange={(event) => setImportance(Number(event.target.value))}><option value={1}>Low</option><option value={2}>Normal</option><option value={3}>High</option></select></label>
            </div>
            <p className="form-note"><span>✦</span> We&apos;ll rank it using due date, importance, and effort.</p>
            <button className="submit-button" type="submit">Add to my plan <span>→</span></button>
          </form>
        </div>
      )}
    </main>
  );
}

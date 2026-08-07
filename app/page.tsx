import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "../src/supabase";

type SchoolClass = { id: string; name: string; color: string; createdAt: number };
type Task = {
  id: string;
  title: string;
  classId: string;
  course: string;
  due: string;
  effort: number;
  importance: number;
  done: boolean;
  createdAt: number;
};
type TaskRow = {
  id: string; title: string; class_id: string | null; course: string; due_date: string;
  effort: number; importance: number; completed: boolean; created_at: string;
};
type ClassRow = { id: string; name: string; color: string; created_at: string };
type SyncState = "local" | "syncing" | "synced" | "error";

const STORAGE_KEY = "semester-focus-tasks-v1";
const CLASS_STORAGE_KEY = "semester-focus-classes-v1";
const CLASS_PALETTE = ["#e06a47", "#8468d7", "#2f86c5", "#2d9772", "#d69b3f", "#cc5f81", "#55708f", "#8a7158"];
const DEFAULT_CLASSES: SchoolClass[] = [
  { id: "class-biology", name: "Biology", color: "#e06a47", createdAt: Date.now() },
  { id: "class-literature", name: "Literature", color: "#8468d7", createdAt: Date.now() - 1 },
  { id: "class-calculus", name: "Calculus", color: "#2f86c5", createdAt: Date.now() - 2 },
  { id: "class-history", name: "History", color: "#2d9772", createdAt: Date.now() - 3 },
];

function dateOffset(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const starterTasks: Task[] = [
  { id: "sample-1", title: "Finish lab report discussion", classId: "class-biology", course: "Biology", due: dateOffset(1), effort: 2, importance: 3, done: false, createdAt: Date.now() },
  { id: "sample-2", title: "Read chapters 6–7", classId: "class-literature", course: "Literature", due: dateOffset(3), effort: 1, importance: 2, done: false, createdAt: Date.now() - 1 },
  { id: "sample-3", title: "Problem set 4", classId: "class-calculus", course: "Calculus", due: dateOffset(2), effort: 3, importance: 3, done: false, createdAt: Date.now() - 2 },
  { id: "sample-4", title: "Choose research paper sources", classId: "class-history", course: "History", due: dateOffset(6), effort: 1, importance: 2, done: false, createdAt: Date.now() - 3 },
];

function daysUntil(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(`${date}T00:00:00`).getTime() - today.getTime()) / 86400000);
}
function score(task: Task) {
  const days = daysUntil(task.due);
  return (days < 0 ? 12 : days === 0 ? 10 : Math.max(0, 9 - days)) + task.importance * 4 + task.effort;
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
function fromClassRow(row: ClassRow): SchoolClass {
  return { id: row.id, name: row.name, color: row.color, createdAt: new Date(row.created_at).getTime() };
}
function toClassRow(item: SchoolClass, userId: string) {
  return { user_id: userId, id: item.id, name: item.name, color: item.color, created_at: new Date(item.createdAt).toISOString() };
}
function fromTaskRow(row: TaskRow, classList: SchoolClass[]): Task {
  const matchingClass = classList.find((item) => item.id === row.class_id) || classList.find((item) => item.name === row.course);
  return {
    id: row.id, title: row.title, classId: matchingClass?.id || "", course: matchingClass?.name || row.course,
    due: row.due_date, effort: row.effort, importance: row.importance, done: row.completed,
    createdAt: new Date(row.created_at).getTime(),
  };
}
function toTaskRow(task: Task, userId: string) {
  return {
    user_id: userId, id: task.id, class_id: task.classId || null, title: task.title, course: task.course,
    due_date: task.due, effort: task.effort, importance: task.importance, completed: task.done,
    created_at: new Date(task.createdAt).toISOString(), updated_at: new Date().toISOString(),
  };
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>(starterTasks);
  const [classes, setClasses] = useState<SchoolClass[]>(DEFAULT_CLASSES);
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("local");
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [showClassForm, setShowClassForm] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authSent, setAuthSent] = useState(false);
  const [authError, setAuthError] = useState("");
  const [title, setTitle] = useState("");
  const [selectedClassId, setSelectedClassId] = useState(DEFAULT_CLASSES[0].id);
  const [due, setDue] = useState(dateOffset(1));
  const [effort, setEffort] = useState(2);
  const [importance, setImportance] = useState(2);
  const [className, setClassName] = useState("");
  const [classColor, setClassColor] = useState(CLASS_PALETTE[0]);

  useEffect(() => {
    try {
      const savedClasses = localStorage.getItem(CLASS_STORAGE_KEY);
      const classList: SchoolClass[] = savedClasses ? JSON.parse(savedClasses) : DEFAULT_CLASSES;
      const savedTasks = localStorage.getItem(STORAGE_KEY);
      const taskList: Task[] = savedTasks ? JSON.parse(savedTasks) : starterTasks;
      setClasses(classList);
      setTasks(taskList.map((task) => ({
        ...task,
        classId: task.classId || classList.find((item) => item.name === task.course)?.id || "",
      })));
      if (classList[0]) setSelectedClassId(classList[0].id);
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => { if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }, [tasks, ready]);
  useEffect(() => { if (ready) localStorage.setItem(CLASS_STORAGE_KEY, JSON.stringify(classes)); }, [classes, ready]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) setSession(data.session); });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => { if (active) setSession(nextSession); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!ready || !session) return;
    void syncFromCloud(session.user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, session?.user.id]);

  async function syncFromCloud(userId: string) {
    if (!supabase) return;
    setSyncState("syncing");
    const [taskResult, classResult] = await Promise.all([
      supabase.from("tasks").select("id,title,class_id,course,due_date,effort,importance,completed,created_at").order("created_at"),
      supabase.from("classes").select("id,name,color,created_at").order("created_at"),
    ]);
    if (taskResult.error || classResult.error) { setSyncState("error"); return; }

    const cloudTasks = taskResult.data as TaskRow[];
    let cloudClasses = (classResult.data as ClassRow[]).map(fromClassRow);
    const sourceNames = Array.from(new Set((cloudTasks.length ? cloudTasks.map((task) => task.course) : tasks.map((task) => task.course)).filter(Boolean)));
    const missingClasses = sourceNames.filter((name) => !cloudClasses.some((item) => item.name.toLowerCase() === name.toLowerCase())).map((name, index) => ({
      id: crypto.randomUUID(), name, color: CLASS_PALETTE[(cloudClasses.length + index) % CLASS_PALETTE.length], createdAt: Date.now() + index,
    }));
    if (cloudClasses.length === 0 && missingClasses.length === 0) cloudClasses = DEFAULT_CLASSES;
    else cloudClasses = [...cloudClasses, ...missingClasses];

    if (classResult.data.length === 0 || missingClasses.length > 0) {
      const { error } = await supabase.from("classes").upsert(cloudClasses.map((item) => toClassRow(item, userId)), { onConflict: "user_id,id" });
      if (error) { setSyncState("error"); return; }
    }
    setClasses(cloudClasses);
    if (cloudClasses[0]) setSelectedClassId((current) => cloudClasses.some((item) => item.id === current) ? current : cloudClasses[0].id);

    if (cloudTasks.length === 0 && tasks.length > 0) {
      const normalized = tasks.map((task) => ({ ...task, classId: task.classId || cloudClasses.find((item) => item.name === task.course)?.id || "" }));
      const { error } = await supabase.from("tasks").upsert(normalized.map((task) => toTaskRow(task, userId)), { onConflict: "user_id,id" });
      if (error) { setSyncState("error"); return; }
      setTasks(normalized);
    } else if (cloudTasks.length > 0) {
      const normalized = cloudTasks.map((task) => fromTaskRow(task, cloudClasses));
      setTasks(normalized);
      if (cloudTasks.some((task) => !task.class_id)) {
        await supabase.from("tasks").upsert(normalized.map((task) => toTaskRow(task, userId)), { onConflict: "user_id,id" });
      }
    }
    setSyncState("synced");
  }

  async function saveCloudTask(task: Task) {
    if (!supabase || !session) return;
    setSyncState("syncing");
    const { error } = await supabase.from("tasks").upsert(toTaskRow(task, session.user.id), { onConflict: "user_id,id" });
    setSyncState(error ? "error" : "synced");
  }
  async function saveCloudClass(item: SchoolClass) {
    if (!supabase || !session) return;
    setSyncState("syncing");
    const { error } = await supabase.from("classes").upsert(toClassRow(item, session.user.id), { onConflict: "user_id,id" });
    setSyncState(error ? "error" : "synced");
  }

  const activeTasks = useMemo(() => tasks.filter((task) => !task.done).sort((a, b) => score(b) - score(a)), [tasks]);
  const visible = filter === "all" ? activeTasks : activeTasks.filter((task) => task.classId === filter);
  const focusTask = activeTasks[0];
  const completed = tasks.filter((task) => task.done).length;
  const classFor = (task: Task) => classes.find((item) => item.id === task.classId) || classes.find((item) => item.name === task.course);

  function addTask(event: FormEvent) {
    event.preventDefault();
    const schoolClass = classes.find((item) => item.id === selectedClassId);
    if (!title.trim() || !schoolClass) return;
    const newTask: Task = { id: crypto.randomUUID(), title: title.trim(), classId: schoolClass.id, course: schoolClass.name, due, effort, importance, done: false, createdAt: Date.now() };
    setTasks((current) => [...current, newTask]);
    void saveCloudTask(newTask);
    setTitle(""); setDue(dateOffset(1)); setEffort(2); setImportance(2); setShowForm(false);
  }
  function addClass(event: FormEvent) {
    event.preventDefault();
    const name = className.trim();
    if (!name || classes.some((item) => item.name.toLowerCase() === name.toLowerCase())) return;
    const newClass: SchoolClass = { id: crypto.randomUUID(), name, color: classColor, createdAt: Date.now() };
    setClasses((current) => [...current, newClass]);
    setSelectedClassId(newClass.id);
    void saveCloudClass(newClass);
    setClassName(""); setClassColor(CLASS_PALETTE[(classes.length + 1) % CLASS_PALETTE.length]); setShowClassForm(false);
  }
  function toggleTask(id: string) {
    const existing = tasks.find((task) => task.id === id);
    if (!existing) return;
    const updated = { ...existing, done: !existing.done };
    setTasks((current) => current.map((task) => task.id === id ? updated : task));
    void saveCloudTask(updated);
  }
  async function requestMagicLink(event: FormEvent) {
    event.preventDefault(); setAuthError("");
    if (!supabase) { setAuthError("Cloud sync has not been connected yet."); return; }
    const { error } = await supabase.auth.signInWithOtp({ email: authEmail, options: { emailRedirectTo: window.location.origin } });
    if (error) setAuthError(error.message); else setAuthSent(true);
  }
  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut(); setSession(null); setSyncState("local");
  }

  const syncLabel = !supabaseConfigured ? "Cloud setup needed" : !session ? "Saved on this device" : syncState === "syncing" ? "Syncing…" : syncState === "error" ? "Sync paused" : "Synced across devices";

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Semester Focus home"><span className="brand-mark">S</span><span>Semester Focus</span></a>
        <div className="header-actions">
          <span className={`saved-label ${syncState === "error" ? "sync-error" : ""}`}><span className="saved-dot" /> {syncLabel}</span>
          {session ? <button className="account-button" onClick={signOut} title="Sign out">{session.user.email?.split("@")[0] || "Account"}</button> : <button className="account-button" onClick={() => setShowAuth(true)}>Sign in to sync</button>}
          <button className="add-button" onClick={() => setShowForm(true)}><span>＋</span> Add task</button>
        </div>
      </header>

      <section className="page" id="top">
        <div className="intro-row">
          <div><p className="eyebrow">YOUR SEMESTER, ONE STEP AT A TIME</p><h1>Good evening. Let&apos;s make<br />tomorrow feel lighter.</h1></div>
          <div className="mini-stats" aria-label="Task summary"><div><strong>{activeTasks.length}</strong><span>open</span></div><div><strong>{completed}</strong><span>done</span></div></div>
        </div>

        <section className="focus-card" aria-labelledby="focus-heading">
          <div className="focus-copy"><p className="focus-kicker"><span className="spark">✦</span> YOUR BEST NEXT MOVE</p>
            {focusTask ? <><h2 id="focus-heading">{focusTask.title}</h2><div className="focus-meta"><span className="course-dot" style={{ background: classFor(focusTask)?.color || "#d07a4a" }} />{classFor(focusTask)?.name || focusTask.course}<span>•</span>{dueLabel(focusTask.due)}<span>•</span>{focusTask.effort * 25} min</div><p className="focus-reason">It&apos;s important, coming up soon, and finishing it will clear the most mental space.</p></> : <><h2 id="focus-heading">You&apos;re all caught up.</h2><p className="focus-reason">Add your next assignment when it lands.</p></>}
          </div>
          {focusTask && <button className="start-button" onClick={() => toggleTask(focusTask.id)}>Mark complete <span>→</span></button>}
          <div className="focus-number" aria-hidden="true">01</div>
        </section>

        <section className="tasks-section" aria-labelledby="tasks-heading">
          <div className="section-heading">
            <div><p className="eyebrow">PRIORITIZED FOR YOU</p><h2 id="tasks-heading">What&apos;s on your plate</h2></div>
            <div className="class-controls">
              <button className="new-class-button" onClick={() => setShowClassForm(true)}>＋ New class</button>
              <label className="filter-label">View<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All classes</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            </div>
          </div>
          <div className="class-strip" aria-label="Your classes">{classes.map((item) => <button key={item.id} className={filter === item.id ? "class-chip active" : "class-chip"} onClick={() => setFilter(filter === item.id ? "all" : item.id)}><span style={{ background: item.color }} />{item.name}<small>{tasks.filter((task) => !task.done && task.classId === item.id).length}</small></button>)}</div>
          <div className="task-list">
            {visible.map((task, index) => <article className="task-row" key={task.id}><button className="check" onClick={() => toggleTask(task.id)} aria-label={`Complete ${task.title}`} /><div className="rank">{String(index + 1).padStart(2, "0")}</div><div className="task-main"><h3>{task.title}</h3><p><span className="course-dot" style={{ background: classFor(task)?.color || "#d07a4a" }} />{classFor(task)?.name || task.course}<span>•</span>{dueLabel(task.due)}<span>•</span>{task.effort * 25} min</p></div><div className={`priority priority-${priorityLabel(task).toLowerCase().replace(" ", "-")}`}>{priorityLabel(task)}</div></article>)}
            {!visible.length && <div className="empty-state"><span>✓</span><h3>Nothing waiting here</h3><p>Pick another class or add a new task.</p></div>}
          </div>
        </section>
        {completed > 0 && <details className="completed-section"><summary>{completed} completed {completed === 1 ? "task" : "tasks"}</summary>{tasks.filter((task) => task.done).map((task) => <button key={task.id} onClick={() => toggleTask(task.id)}>↩ Restore “{task.title}”</button>)}</details>}
      </section>

      {showForm && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowForm(false)}><form className="task-form" onSubmit={addTask} onMouseDown={(event) => event.stopPropagation()}><div className="form-title"><div><p className="eyebrow">QUICK CAPTURE</p><h2>Add a task</h2></div><button type="button" className="close" onClick={() => setShowForm(false)} aria-label="Close">×</button></div><label>What needs doing?<input autoFocus required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Draft essay introduction" /></label><div className="form-grid"><label>Class<select value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)}>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Due date<input type="date" required value={due} onChange={(event) => setDue(event.target.value)} /></label><label>Effort<select value={effort} onChange={(event) => setEffort(Number(event.target.value))}><option value={1}>Quick · 25 min</option><option value={2}>Medium · 50 min</option><option value={3}>Deep · 75 min</option></select></label><label>Importance<select value={importance} onChange={(event) => setImportance(Number(event.target.value))}><option value={1}>Low</option><option value={2}>Normal</option><option value={3}>High</option></select></label></div><p className="form-note"><span>✦</span> We&apos;ll rank it using due date, importance, and effort.</p><button className="submit-button" type="submit">Add to my plan <span>→</span></button></form></div>}

      {showClassForm && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowClassForm(false)}><form className="task-form class-form" onSubmit={addClass} onMouseDown={(event) => event.stopPropagation()}><div className="form-title"><div><p className="eyebrow">ORGANIZE YOUR SEMESTER</p><h2>Add a class</h2></div><button type="button" className="close" onClick={() => setShowClassForm(false)} aria-label="Close">×</button></div><label>Class name<input autoFocus required maxLength={100} value={className} onChange={(event) => setClassName(event.target.value)} placeholder="e.g. Organic Chemistry" /></label><fieldset className="color-picker"><legend>Color</legend><div>{CLASS_PALETTE.map((color) => <button key={color} type="button" className={classColor === color ? "color-swatch selected" : "color-swatch"} style={{ background: color }} onClick={() => setClassColor(color)} aria-label={`Choose ${color}`} />)}</div></fieldset><button className="submit-button" type="submit">Create class <span>→</span></button></form></div>}

      {showAuth && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowAuth(false)}><form className="task-form auth-form" onSubmit={requestMagicLink} onMouseDown={(event) => event.stopPropagation()}><div className="form-title"><div><p className="eyebrow">CLOUD SYNC</p><h2>Take your tasks anywhere</h2></div><button type="button" className="close" onClick={() => setShowAuth(false)} aria-label="Close">×</button></div>{authSent ? <div className="auth-success"><span>✉</span><h3>Check your email</h3><p>Use the secure link we sent to {authEmail}. Your browser tasks will import automatically.</p></div> : <><p className="auth-intro">Sign in with an email link to back up your plan and keep it in sync across your phone and computer.</p><label>Email address<input autoFocus type="email" required value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@example.com" /></label>{authError && <p className="auth-error">{authError}</p>}<button className="submit-button" type="submit">Email me a sign-in link <span>→</span></button><p className="privacy-note">No password needed. Your tasks stay private to your account.</p></>}</form></div>}
    </main>
  );
}

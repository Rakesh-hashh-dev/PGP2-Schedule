import { useState, useMemo, useRef, useEffect } from "react";
import "../styles/assignments.css";
import { CheckCircle2, Circle, Plus, Trash2, X, ChevronDown, Check, Sparkles, BookOpen, Clock, AlertCircle, List, CalendarRange, ArrowDownUp } from "lucide-react";
import { loadAssignments, pushAssignments } from "../lib/assignments.js";
import { EmptyState } from "./ui.jsx";

function daysUntil(dueDate) {
  if (!dueDate) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  const due = new Date(dueDate); due.setHours(0,0,0,0);
  return Math.floor((due - now) / 86400000);
}

function getUrgencyState(dueDate) {
  const d = daysUntil(dueDate);
  if (d === null) return "none";
  if (d < 0) return "overdue";
  if (d <= 2) return "danger";
  if (d <= 7) return "warning";
  return "good";
}

function formatShortDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDueLabel(dueDate) {
  const d = daysUntil(dueDate);
  if (d === null) return "";
  if (d < 0)  return `${-d}d overdue`;
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  if (d <= 7)  return `${d}d left`;
  return `Due ${formatShortDate(dueDate)}`;
}

const COLORS = ["var(--violet)","var(--live)","#E67E22","#2980B9","#9B59B6","#E74C3C"];
function getCourseColor(code) {
  const hash = Array.from(code).reduce((a, c) => a + c.charCodeAt(0), 0);
  return COLORS[hash % COLORS.length];
}

// Deadline buckets for the "By date" grouping — mirrors the urgency scale but
// splits "today" out from the 7-day window so the most pressing work reads first.
const DATE_BUCKETS = [
  { key: "overdue", label: "Overdue" },
  { key: "today",   label: "Due today" },
  { key: "week",    label: "This week" },
  { key: "later",   label: "Later" },
  { key: "nodate",  label: "No due date" },
];

function bucketOf(task) {
  if (!task.dueDate) return "nodate";
  const d = daysUntil(task.dueDate);
  if (d < 0)  return "overdue";
  if (d === 0) return "today";
  if (d <= 7) return "week";
  return "later";
}

function sortTasks(a, b, sortBy) {
  if (sortBy === "title") return (a.title || "").localeCompare(b.title || "");
  if (sortBy === "added")  return (b.createdAt || "").localeCompare(a.createdAt || ""); // newest first
  // default "due": dated first (soonest → latest), undated last
  if (!a.dueDate && !b.dueDate) return 0;
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return new Date(a.dueDate) - new Date(b.dueDate);
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Animates a number from its previous value to the new target (easeOutCubic),
// snapping instantly if the user prefers reduced motion.
function useCountUp(target, duration = 650) {
  const [val, setVal] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    const from = prev.current;
    const to = target;
    prev.current = target;
    if (prefersReducedMotion() || from === to) { setVal(to); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

function ProgressRing({ pct, color }) {
  const r = 14, circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="progress-ring-wrap">
      <svg width="36" height="36" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--border)" strokeWidth="2.5" />
        <circle
          cx="18" cy="18" r={r} fill="none"
          stroke={color} strokeWidth="2.5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 18 18)"
          style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.34,1.56,0.64,1)" }}
        />
      </svg>
      <span className="progress-pct">{Math.round(pct)}%</span>
    </div>
  );
}

function StatTile({ val, label, icon: Icon, cls, active, pulse, onClick, hint, index = 0 }) {
  const shown = useCountUp(val);
  return (
    <button
      className={`stat-tile ${cls} ${active ? "stat-tile-active" : ""} ${pulse && val > 0 ? "stat-tile-pulse" : ""} ${val === 0 ? "stat-tile-zero" : ""}`}
      style={{ "--tile-i": index }}
      onClick={onClick}
      aria-pressed={active}
      title={hint}
    >
      <div className="stat-tile-icon"><Icon size={16} /></div>
      <div className="stat-tile-val">{shown}</div>
      <div className="stat-tile-label">{label}</div>
    </button>
  );
}

const SWIPE_THRESHOLD = 72;

function SwipeableTaskRow({ task, onToggle, onDelete, onOpen, courseCode, courseColor }) {
  const [dx, setDx] = useState(0);
  const dragRef = useRef(null);
  const justSwiped = useRef(false);
  const rowRef = useRef(null);

  const onPointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, axis: null, moved: false };
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dxNow = e.clientX - d.startX;
    const dyNow = e.clientY - d.startY;
    if (!d.axis) {
      if (Math.abs(dxNow) < 8 && Math.abs(dyNow) < 8) return;
      d.axis = Math.abs(dxNow) > Math.abs(dyNow) ? "x" : "y";
      if (d.axis === "x") rowRef.current?.setPointerCapture?.(e.pointerId);
    }
    if (d.axis !== "x") return;
    d.moved = true;
    setDx(Math.max(-120, Math.min(120, dxNow)));
  };

  const onPointerEnd = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || !d.moved) return;
    justSwiped.current = true;
    if (dx > SWIPE_THRESHOLD)       { onToggle(); }
    else if (dx < -SWIPE_THRESHOLD) { setDx(0); onDelete(); return; }
    setDx(0);
  };

  const handleClick = () => {
    if (justSwiped.current) { justSwiped.current = false; return; }
    onOpen();
  };

  const urgency = task.completed ? "none" : getUrgencyState(task.dueDate);

  return (
    <div className="assign-swipe-wrap">
      <div className={`assign-swipe-bg ${dx > 0 ? "show-complete" : dx < 0 ? "show-delete" : ""}`}>
        <span className="swipe-ico complete">{task.completed ? <Circle size={18}/> : <Check size={18} strokeWidth={3}/>}</span>
        <span className="swipe-ico delete"><Trash2 size={18}/></span>
      </div>
      <div
        ref={rowRef}
        className={`assign-task-row ${task.completed ? "completed" : ""} ${dx !== 0 ? "dragging" : ""}`}
        style={{ transform: `translateX(${dx}px)`, transition: dx !== 0 ? "none" : "transform 0.25s cubic-bezier(0.16,1,0.3,1)" }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}
        onClick={handleClick}
      >
        <button
          className={`assign-check ${task.completed ? "checked" : ""}`}
          aria-label={task.completed ? "Mark as not done" : "Mark as done"}
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
        >
          {task.completed ? <CheckCircle2 size={20}/> : <Circle size={20}/>}
        </button>
        <div className="assign-task-content">
          <div className="assign-task-main">
            {courseCode && (
              <span
                className="assign-task-course-tag"
                style={{ color: courseColor, background: `color-mix(in srgb, ${courseColor} 15%, transparent)` }}
              >
                {courseCode}
              </span>
            )}
            <span className="assign-task-title">{task.title || "Untitled Task"}</span>
          </div>
          {task.description && <div className="assign-task-desc">{task.description}</div>}
        </div>
        {task.dueDate && !task.completed && (
          <div className={`assign-task-due due-${urgency}`}>{formatDueLabel(task.dueDate)}</div>
        )}
      </div>
    </div>
  );
}

export default function AssignmentsPanel({ enrolled, legend, userId, onTaskCompleted }) {
  const [assignments, setAssignments] = useState(() => loadAssignments());
  const [modalOpen, setModalOpen] = useState(false);
  const [collapsedCards, setCollapsedCards] = useState({});
  const [modalData, setModalData] = useState({ id: "", code: "", title: "", description: "", dueDate: "" });
  const [tab, setTab] = useState("open");
  const [filter, setFilter] = useState("all");
  const [groupBy, setGroupBy] = useState("course"); // "course" | "date"
  const [sortBy, setSortBy] = useState("due");       // "due" | "added" | "title"
  const [undoState, setUndoState] = useState(null);
  const undoTimer = useRef(null);
  const auraRef = useRef(null);
  const headRef = useRef(null);

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  // Scroll parallax: the ambient aura drifts slower than the page (depth) while
  // the header gently lifts + fades as it scrolls away. Transform/opacity only,
  // rAF-throttled, and disabled entirely under reduced-motion.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY || window.pageYOffset || 0;
        if (auraRef.current) auraRef.current.style.transform = `translate3d(0, ${(y * 0.35).toFixed(1)}px, 0)`;
        if (headRef.current) {
          const p = Math.min(1, y / 200);
          headRef.current.style.transform = `translate3d(0, ${(y * -0.1).toFixed(1)}px, 0)`;
          headRef.current.style.opacity = String(1 - p * 0.5);
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  const updateAssignments = (next) => { setAssignments(next); pushAssignments(userId, next); };

  const courses = useMemo(() => {
    if (!enrolled || !legend) return [];
    return Object.keys(enrolled).map(code => {
      const info = legend[code] || {};
      const tasks = assignments[code] || [];
      const pending = tasks.filter(a => !a.completed);
      return { code, name: info.name || code, color: info.color || getCourseColor(code), tasks, pendingCount: pending.length, doneCount: tasks.length - pending.length };
    }).sort((a, b) => a.code.localeCompare(b.code));
  }, [enrolled, legend, assignments]);

  const stats = useMemo(() => {
    let pending = 0, dueSoon = 0, overdue = 0, submitted = 0;
    courses.forEach(c => {
      pending += c.pendingCount;
      submitted += c.doneCount;
      c.tasks.filter(t => !t.completed).forEach(t => {
        const u = getUrgencyState(t.dueDate);
        if (u === "overdue") overdue++;
        else if (u === "danger" || u === "warning") dueSoon++;
      });
    });
    return { pending, dueSoon, overdue, submitted };
  }, [courses]);

  const upNext = useMemo(() => {
    const items = [];
    courses.forEach(c => c.tasks.forEach(t => { if (!t.completed) items.push({ task: t, course: c }); }));
    items.sort((a, b) => {
      if (!a.task.dueDate && !b.task.dueDate) return 0;
      if (!a.task.dueDate) return 1;
      if (!b.task.dueDate) return -1;
      return new Date(a.task.dueDate) - new Date(b.task.dueDate);
    });
    return items.slice(0, 5);
  }, [courses]);

  const matchesFilter = (task) => {
    if (filter === "all") return true;
    const u = getUrgencyState(task.dueDate);
    return filter === "soon" ? (u === "danger" || u === "warning") : u === "overdue";
  };

  const isVisible = (task) => tab === "open" ? (!task.completed && matchesFilter(task)) : task.completed;

  const totalVisible = useMemo(() => {
    let n = 0;
    courses.forEach(c => c.tasks.forEach(t => { if (isVisible(t)) n++; }));
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses, tab, filter]);

  // Flatten every visible task into deadline buckets for the "By date" grouping.
  const dateGroups = useMemo(() => {
    const map = { overdue: [], today: [], week: [], later: [], nodate: [] };
    courses.forEach(c => c.tasks.forEach(t => {
      if (!isVisible(t)) return;
      map[bucketOf(t)].push({ task: t, course: c });
    }));
    Object.values(map).forEach(arr => arr.sort((a, b) => sortTasks(a.task, b.task, sortBy)));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses, tab, filter, sortBy]);

  const handleUpdateTask = (code, taskId, field, value) => {
    const next = { ...assignments };
    const tasks = [...(next[code] || [])];
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx !== -1) { tasks[idx] = { ...tasks[idx], [field]: value }; next[code] = tasks; updateAssignments(next); }
    // Clearing a deadline feeds the pet. Keyed by task id, so ticking a task
    // off, undoing and ticking it again pays out exactly once.
    if (idx !== -1 && field === "completed" && value === true) onTaskCompleted?.(taskId);
  };

  const handleDeleteTask = (code, taskId) => {
    const next = { ...assignments };
    next[code] = (next[code] || []).filter(t => t.id !== taskId);
    updateAssignments(next);
  };

  const deleteWithUndo = (code, task) => {
    handleDeleteTask(code, task.id);
    setUndoState({ code, task });
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoState(null), 5000);
  };

  const undoDelete = () => {
    if (!undoState) return;
    const next = { ...assignments };
    next[undoState.code] = [...(next[undoState.code] || []), undoState.task];
    updateAssignments(next);
    setUndoState(null);
    clearTimeout(undoTimer.current);
  };

  const openModal = (code = "", taskToEdit = null) => {
    setModalData(taskToEdit
      ? { ...taskToEdit, code }
      : { id: "", code: code || (courses[0]?.code || ""), title: "", description: "", dueDate: "" }
    );
    setModalOpen(true);
  };

  const saveModalTask = () => {
    if (!modalData.code) return;
    const next = { ...assignments };
    const tasks = [...(next[modalData.code] || [])];
    if (modalData.id) {
      const idx = tasks.findIndex(t => t.id === modalData.id);
      if (idx !== -1) tasks[idx] = { ...tasks[idx], ...modalData };
    } else {
      tasks.push({ id: Date.now().toString(), title: modalData.title, description: modalData.description, dueDate: modalData.dueDate, completed: false, createdAt: new Date().toISOString() });
    }
    next[modalData.code] = tasks;
    updateAssignments(next);
    setModalOpen(false);
  };

  const deleteModalTask = () => {
    if (modalData.id) { handleDeleteTask(modalData.code, modalData.id); setModalOpen(false); }
  };

  const allClear = stats.pending === 0;
  const showSpotlight = groupBy === "course" && tab === "open" && filter === "all" && upNext.length > 0;
  const [hero, ...rest] = upNext;

  return (
    <div className="assign-page">
      <div className="assign-aura" ref={auraRef} aria-hidden="true"><i /><i /></div>

      <div className="assign-head-wrapper" ref={headRef}>
        <div className="assign-head">
          <h1>Assignments</h1>
          <span className="assign-sub">
            {allClear
              ? `${courses.length} subjects \u00b7 all clear`
              : <><b style={{color:"var(--text)"}}>{stats.pending}</b> open across <b style={{color:"var(--text)"}}>{courses.length}</b> subjects</>}
          </span>
        </div>
      </div>

      <div className="assign-stats-grid">
        <StatTile val={stats.pending}   label="Open"     icon={BookOpen}     cls="stat-open"    index={0} active={tab==="open" && filter==="all"}  hint="Show all open work"      onClick={() => { setTab("open"); setFilter("all"); }} />
        <StatTile val={stats.dueSoon}   label="Due soon"  icon={Clock}        cls="stat-soon"    index={1} active={filter==="soon"}    pulse hint="Filter: due within a week" onClick={() => { setTab("open"); setFilter(f => f==="soon" ? "all" : "soon"); }} />
        <StatTile val={stats.overdue}   label="Overdue"   icon={AlertCircle}  cls="stat-overdue" index={2} active={filter==="overdue"} pulse hint="Filter: past due"         onClick={() => { setTab("open"); setFilter(f => f==="overdue" ? "all" : "overdue"); }} />
        <StatTile val={stats.submitted} label="Done"      icon={CheckCircle2} cls="stat-done"    index={3} active={tab==="done"}             hint="Show completed work"      onClick={() => { setTab("done"); setFilter("all"); }} />
      </div>
      <div className="assign-stats-hint">Tap a stat to filter your list</div>

      <div className="assign-controls">
        <div className="assign-seg" role="tablist">
          <button role="tab" aria-selected={tab==="open"} className={tab==="open" ? "active" : ""} onClick={() => setTab("open")}>
            Open {stats.pending > 0 && <span className="seg-count">{stats.pending}</span>}
          </button>
          <button role="tab" aria-selected={tab==="done"} className={tab==="done" ? "active" : ""} onClick={() => { setTab("done"); setFilter("all"); }}>
            Done {stats.submitted > 0 && <span className="seg-count">{stats.submitted}</span>}
          </button>
        </div>
        {tab === "open" && filter !== "all" && (
          <button className="assign-filter-chip" onClick={() => setFilter("all")}>
            {filter === "soon" ? "Due soon" : "Overdue"} <X size={13} strokeWidth={3}/>
          </button>
        )}
        <div className="assign-controls-right">
          <div className="assign-group-toggle" role="group" aria-label="Group assignments">
            <button
              className={groupBy==="course" ? "active" : ""}
              aria-pressed={groupBy==="course"}
              title="Group by course"
              onClick={() => setGroupBy("course")}
            >
              <List size={14} /> <span className="assign-toggle-label">Course</span>
            </button>
            <button
              className={groupBy==="date" ? "active" : ""}
              aria-pressed={groupBy==="date"}
              title="Group by due date"
              onClick={() => setGroupBy("date")}
            >
              <CalendarRange size={14} /> <span className="assign-toggle-label">Date</span>
            </button>
          </div>
          <label className="assign-sort" title="Sort assignments">
            <ArrowDownUp size={14} />
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Sort assignments">
              <option value="due">Due date</option>
              <option value="added">Recently added</option>
              <option value="title">Title</option>
            </select>
          </label>
        </div>
      </div>

      {showSpotlight && hero && (
        <section className="assign-spotlight">
          <div className="spotlight-label">Up next</div>
          <div className="spotlight-hero">
            <div className="spotlight-bar" style={{ background: hero.course.color }} />
            <div className="spotlight-content">
              <div className="spotlight-course" style={{ color: hero.course.color }}>{hero.course.name}</div>
              <div className="spotlight-title">{hero.task.title || "Untitled Task"}</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              {hero.task.dueDate && (
                <div className={`assign-task-due due-${getUrgencyState(hero.task.dueDate)}`}>{formatDueLabel(hero.task.dueDate)}</div>
              )}
              <button
                className="assign-check"
                aria-label="Mark as done"
                onClick={() => handleUpdateTask(hero.course.code, hero.task.id, "completed", true)}
                style={{ color: "var(--muted)" }}
              >
                <Circle size={22}/>
              </button>
            </div>
          </div>
          {rest.length > 0 && (
            <div className="spotlight-list">
              {rest.map(({ task, course }) => (
                <div key={task.id} className="spotlight-item" onClick={() => openModal(course.code, task)}>
                  <div className="spotlight-dot" style={{ background: course.color }} />
                  <span className="spotlight-item-title">{task.title || "Untitled Task"}</span>
                  {task.dueDate && (
                    <span className={`assign-task-due due-${getUrgencyState(task.dueDate)}`} style={{ fontSize:10 }}>{formatDueLabel(task.dueDate)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "open" && allClear && (
        <div className="assign-empty">
          <Sparkles size={48} className="assign-empty-svg" />
          <h3>All clear!</h3>
          <p>Nothing due across your {courses.length} subjects</p>
          {stats.submitted > 0 && (
            <button className="assign-empty-action" onClick={() => setTab("done")}>View submitted work</button>
          )}
        </div>
      )}

      {tab === "done" && stats.submitted === 0 && (
        <EmptyState icon={CheckCircle2} title="Nothing here yet" sub="Completed assignments will appear here" />
      )}

      {!(tab === "open" && allClear) && !(tab === "done" && stats.submitted === 0) && (
        totalVisible === 0 ? (
          <div className="assign-empty-mini">
            No assignments match this filter.
            {tab === "open" && filter !== "all" && (
              <button className="assign-empty-mini-action" onClick={() => setFilter("all")}>Clear filter</button>
            )}
          </div>
        ) : groupBy === "date" ? (
          <section className="assign-date-groups">
            {DATE_BUCKETS.map(bucket => {
              const items = dateGroups[bucket.key];
              if (!items.length) return null;
              return (
                <div key={bucket.key} className={`assign-date-group dg-${bucket.key}`}>
                  <div className="assign-date-group-head">
                    <span className="assign-date-group-label">{bucket.label}</span>
                    <span className="assign-date-group-count">{items.length}</span>
                  </div>
                  <div className="assign-tasks">
                    {items.map(({ task, course }) => (
                      <SwipeableTaskRow
                        key={task.id}
                        task={task}
                        courseCode={course.code}
                        courseColor={course.color}
                        onToggle={() => handleUpdateTask(course.code, task.id, "completed", !task.completed)}
                        onDelete={() => deleteWithUndo(course.code, task)}
                        onOpen={() => openModal(course.code, task)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        ) : (
          <section className="assign-grid">
            {courses.map((course, i) => {
              const visibleTasks = (tab === "open"
                ? course.tasks.filter(t => !t.completed && matchesFilter(t))
                : course.tasks.filter(t => t.completed)
              ).slice().sort((a, b) => sortTasks(a, b, sortBy));
              if (visibleTasks.length === 0) return null;
              const progress = course.tasks.length > 0 ? (course.doneCount / course.tasks.length) * 100 : 0;
              const isOpen = !collapsedCards[course.code];
              return (
                <div
                  key={course.code}
                  className="assign-card"
                  style={{ "--course-color": course.color, animationDelay: `${i * 60}ms` }}
                >
                  <div
                    className="assign-card-header"
                    onClick={() => setCollapsedCards(p => ({ ...p, [course.code]: !p[course.code] }))}
                  >
                    <span className="assign-course-chip">{course.code}</span>
                    <span className="assign-course-name">{course.name}</span>
                    <div className="assign-card-meta">
                      <button className="assign-add-mini" onClick={(e) => { e.stopPropagation(); openModal(course.code); }}>
                        <Plus size={13} strokeWidth={3}/><span className="assign-add-label">Add</span>
                      </button>
                      <span className="assign-badge">{tab==="open" ? `${course.pendingCount} open` : `${course.doneCount} done`}</span>
                      <ProgressRing pct={progress} color={course.color} />
                      <ChevronDown size={16} className={`assign-chevron ${isOpen ? "open" : ""}`} />
                    </div>
                  </div>

                  {isOpen && (
                    <div className="assign-tasks">
                      {visibleTasks.map(task => (
                        <SwipeableTaskRow
                          key={task.id}
                          task={task}
                          onToggle={() => handleUpdateTask(course.code, task.id, "completed", !task.completed)}
                          onDelete={() => deleteWithUndo(course.code, task)}
                          onOpen={() => openModal(course.code, task)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )
      )}

      {undoState && (
        <div className="assign-undo-toast">
          <span>Deleted "{undoState.task.title || "Untitled Task"}"</span>
          <button onClick={undoDelete}>Undo</button>
        </div>
      )}

      {modalOpen && (
        <div className="assign-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="assign-modal" onClick={e => e.stopPropagation()}>
            <span className="assign-modal-drag-handle" />
            <div className="assign-modal-head">
              <h2>{modalData.id ? "Edit Assignment" : "New Assignment"}</h2>
              <button className="assign-modal-close" aria-label="Close" onClick={() => setModalOpen(false)}>
                <X size={16}/>
              </button>
            </div>
            <div className="assign-modal-body">
              <div className="assign-field">
                <label>Title</label>
                <input
                  type="text" className="assign-input"
                  placeholder="e.g. Brand Positioning Case Study"
                  value={modalData.title}
                  onChange={e => setModalData({ ...modalData, title: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="assign-field">
                <label>Subject</label>
                <select
                  className="assign-select"
                  value={modalData.code}
                  onChange={e => setModalData({ ...modalData, code: e.target.value })}
                >
                  <option value="" disabled>Select a subject...</option>
                  {courses.map(c => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="assign-field">
                <label>Due Date</label>
                <input
                  type="date" className="assign-input"
                  value={modalData.dueDate}
                  onChange={e => setModalData({ ...modalData, dueDate: e.target.value })}
                />
              </div>
              <div className="assign-field">
                <label>Notes</label>
                <textarea
                  className="assign-textarea"
                  placeholder="Submit via LMS, max 1500 words..."
                  value={modalData.description}
                  onChange={e => setModalData({ ...modalData, description: e.target.value })}
                />
              </div>
            </div>
            <div className="assign-modal-footer">
              {modalData.id ? (
                <button className="assign-btn-delete" onClick={deleteModalTask}>
                  <Trash2 size={15}/> Delete
                </button>
              ) : <div />}
              <div className="assign-footer-actions">
                <button className="assign-btn-cancel" onClick={() => setModalOpen(false)}>Cancel</button>
                <button className="assign-btn-save" onClick={saveModalTask}>
                  {modalData.id ? "Save Changes" : "Save Assignment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating Action Button ── */}
      {tab === "open" && (
        <button className="assign-fab" onClick={() => openModal()} aria-label="New Assignment">
          <div className="assign-fab-icon"><Plus size={24} strokeWidth={2.5} /></div>
          <span className="assign-fab-text">New Assignment</span>
        </button>
      )}

    </div>
  );
}

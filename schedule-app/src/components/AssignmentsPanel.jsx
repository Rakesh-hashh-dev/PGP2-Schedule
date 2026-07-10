import { useState, useMemo, useRef, useEffect } from "react";
import "../styles/assignments.css";
import { CheckCircle2, Circle, Plus, Trash2, X, ChevronDown, ChevronUp, Check } from "lucide-react";
import { loadAssignments, pushAssignments } from "../lib/assignments.js";
import { EmptyState, Button } from "./ui.jsx";
import { Inbox } from "lucide-react";

function daysUntil(dueDate) {
  if (!dueDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0); // compare dates only
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.floor((due - now) / (1000 * 60 * 60 * 24));
}

function getUrgencyState(dueDate) {
  const diffDays = daysUntil(dueDate);
  if (diffDays === null) return "none";
  if (diffDays < 0) return "overdue";
  if (diffDays <= 2) return "danger";
  if (diffDays <= 7) return "warning";
  return "good";
}

function formatShortDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDueLabel(dueDate) {
  const diffDays = daysUntil(dueDate);
  if (diffDays === null) return "";
  if (diffDays < 0) return `${-diffDays}d overdue`;
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  if (diffDays <= 7) return `${diffDays}d left`;
  return `Due ${formatShortDate(dueDate)}`;
}

const COLORS = [
  'var(--violet)',
  'var(--live)',
  '#E67E22',
  '#2980B9',
  '#9B59B6',
  '#E74C3C'
];

function getCourseColor(code) {
  const hash = Array.from(code).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return COLORS[hash % COLORS.length];
}

function StatCard({ val, label, colorClass, isMuted, active, onClick }) {
  return (
    <button className={`assign-stat ${active ? 'stat-active' : ''}`} onClick={onClick}>
      <span className={`assign-stat-val ${colorClass} ${isMuted && val === 0 ? 'stat-muted' : ''}`}>
        {val}
      </span>
      <span className="assign-stat-label">{label}</span>
    </button>
  );
}

const SWIPE_THRESHOLD = 72;

function SwipeableTaskRow({ task, onToggle, onDelete, onOpen }) {
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
    if (dx > SWIPE_THRESHOLD) {
      onToggle();
    } else if (dx < -SWIPE_THRESHOLD) {
      setDx(0);
      onDelete();
      return;
    }
    setDx(0);
  };

  const handleClick = () => {
    if (justSwiped.current) { justSwiped.current = false; return; }
    onOpen();
  };

  const urgency = task.completed ? "none" : getUrgencyState(task.dueDate);
  const dragging = dx !== 0;

  return (
    <div className="assign-swipe-wrap">
      <div className={`assign-swipe-bg ${dx > 0 ? 'show-complete' : dx < 0 ? 'show-delete' : ''}`}>
        <span className="swipe-ico complete">
          {task.completed ? <Circle size={18} /> : <Check size={18} strokeWidth={3} />}
        </span>
        <span className="swipe-ico delete"><Trash2 size={18} /></span>
      </div>
      <div
        ref={rowRef}
        className={`assign-task-row ${task.completed ? 'completed' : ''} ${dragging ? 'dragging' : ''}`}
        style={{ transform: `translateX(${dx}px)`, transition: dragRef.current ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClick={handleClick}
      >
        <button
          className={`assign-check ${task.completed ? 'checked' : ''}`}
          aria-label={task.completed ? "Mark as not done" : "Mark as done"}
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
        >
          {task.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
        </button>
        <div className="assign-task-content">
          <div className="assign-task-title">{task.title || "Untitled Task"}</div>
          {task.description && <div className="assign-task-desc">{task.description}</div>}
        </div>
        {task.dueDate && !task.completed && (
          <div className={`assign-task-due due-${urgency}`}>
            {formatDueLabel(task.dueDate)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AssignmentsPanel({ enrolled, legend, userId }) {
  const [assignments, setAssignments] = useState(() => loadAssignments());
  const [modalOpen, setModalOpen] = useState(false);
  const [collapsedCards, setCollapsedCards] = useState({});
  const [modalData, setModalData] = useState({ id: "", code: "", title: "", description: "", dueDate: "" });
  const [tab, setTab] = useState("open");
  const [filter, setFilter] = useState("all"); // all | soon | overdue
  const [undoState, setUndoState] = useState(null); // { code, task }
  const undoTimer = useRef(null);

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  const updateAssignments = (newAssignments) => {
    setAssignments(newAssignments);
    pushAssignments(userId, newAssignments);
  };

  const courses = useMemo(() => {
    if (!enrolled || !legend) return [];
    return Object.keys(enrolled).map(code => {
      const info = legend[code] || {};
      const subjectAssignments = assignments[code] || [];
      const pending = subjectAssignments.filter(a => !a.completed);

      return {
        code,
        name: info.name || code,
        color: info.color || getCourseColor(code),
        tasks: subjectAssignments,
        pendingCount: pending.length,
        doneCount: subjectAssignments.length - pending.length,
      };
    }).sort((a, b) => a.code.localeCompare(b.code));
  }, [enrolled, legend, assignments]);

  const stats = useMemo(() => {
    let pending = 0;
    let dueSoon = 0;
    let overdue = 0;
    let submitted = 0;

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
    courses.forEach(c => c.tasks.forEach(t => {
      if (!t.completed) items.push({ task: t, course: c });
    }));
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

  const handleUpdateTask = (code, taskId, field, value) => {
    const nextAssignments = { ...assignments };
    const tasks = nextAssignments[code] || [];
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx !== -1) {
      tasks[idx] = { ...tasks[idx], [field]: value };
      nextAssignments[code] = tasks;
      updateAssignments(nextAssignments);
    }
  };

  const handleDeleteTask = (code, taskId) => {
    const nextAssignments = { ...assignments };
    nextAssignments[code] = (nextAssignments[code] || []).filter(t => t.id !== taskId);
    updateAssignments(nextAssignments);
  };

  const deleteWithUndo = (code, task) => {
    handleDeleteTask(code, task.id);
    setUndoState({ code, task });
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoState(null), 5000);
  };

  const undoDelete = () => {
    if (!undoState) return;
    const nextAssignments = { ...assignments };
    nextAssignments[undoState.code] = [...(nextAssignments[undoState.code] || []), undoState.task];
    updateAssignments(nextAssignments);
    setUndoState(null);
    clearTimeout(undoTimer.current);
  };

  const openModal = (code = "", taskToEdit = null) => {
    if (taskToEdit) {
      setModalData({ ...taskToEdit, code });
    } else {
      setModalData({ id: "", code: code || (courses.length > 0 ? courses[0].code : ""), title: "", description: "", dueDate: "" });
    }
    setModalOpen(true);
  };

  const saveModalTask = () => {
    if (!modalData.code) return;
    const nextAssignments = { ...assignments };
    const tasks = nextAssignments[modalData.code] || [];

    if (modalData.id) {
      const idx = tasks.findIndex(t => t.id === modalData.id);
      if (idx !== -1) {
        tasks[idx] = { ...tasks[idx], ...modalData };
      }
    } else {
      tasks.push({
        id: Date.now().toString(),
        title: modalData.title,
        description: modalData.description,
        dueDate: modalData.dueDate,
        completed: false,
        createdAt: new Date().toISOString()
      });
    }
    nextAssignments[modalData.code] = tasks;
    updateAssignments(nextAssignments);
    setModalOpen(false);
  };

  const deleteModalTask = () => {
    if (modalData.id) {
      handleDeleteTask(modalData.code, modalData.id);
      setModalOpen(false);
    }
  };

  const allClear = stats.pending === 0;
  const showUpNext = tab === "open" && filter === "all" && upNext.length > 0;

  return (
    <div className="assign-page">
      <div className="assign-head-wrapper">
        <div className="assign-head">
          <h1>Assignments</h1>
          <span className="assign-sub">
            {allClear
              ? `${courses.length} subjects · all clear`
              : <><b style={{color: 'var(--text)'}}>{stats.pending}</b> open across <b style={{color: 'var(--text)'}}>{courses.length}</b> subjects</>}
          </span>
        </div>
        <button className="assign-new-btn" onClick={() => openModal()}>
          <Plus size={18} strokeWidth={2.5} /> New Assignment
        </button>
      </div>

      <section className="assign-hero">
          <StatCard
            val={stats.pending}
            label="Open"
            colorClass="stat-total"
            isMuted={false}
            active={filter === "all"}
            onClick={() => { setTab("open"); setFilter("all"); }}
          />
          <StatCard
            val={stats.dueSoon}
            label="Due soon"
            colorClass="stat-soon"
            isMuted={true}
            active={filter === "soon"}
            onClick={() => { setTab("open"); setFilter(f => f === "soon" ? "all" : "soon"); }}
          />
          <StatCard
            val={stats.overdue}
            label="Overdue"
            colorClass="stat-overdue"
            isMuted={true}
            active={filter === "overdue"}
            onClick={() => { setTab("open"); setFilter(f => f === "overdue" ? "all" : "overdue"); }}
          />
          <StatCard
            val={stats.submitted}
            label="Done"
            colorClass="stat-submitted"
            isMuted={false}
            active={false}
            onClick={() => { setTab("done"); setFilter("all"); }}
          />
        </section>

      <div className="assign-controls">
        <div className="assign-seg" role="tablist">
          <button
            role="tab"
            aria-selected={tab === "open"}
            className={tab === "open" ? "active" : ""}
            onClick={() => setTab("open")}
          >
            Open {stats.pending > 0 && <span className="seg-count">{stats.pending}</span>}
          </button>
          <button
            role="tab"
            aria-selected={tab === "done"}
            className={tab === "done" ? "active" : ""}
            onClick={() => { setTab("done"); setFilter("all"); }}
          >
            Done {stats.submitted > 0 && <span className="seg-count">{stats.submitted}</span>}
          </button>
        </div>
        {tab === "open" && filter !== "all" && (
          <button className="assign-filter-chip" onClick={() => setFilter("all")}>
            {filter === "soon" ? "Due soon" : "Overdue"} <X size={13} strokeWidth={3} />
          </button>
        )}
      </div>

      {showUpNext && (
        <section className="assign-upnext">
          <div className="assign-upnext-title">Up next</div>
          <div className="assign-upnext-list">
            {upNext.map(({ task, course }) => {
              const urgency = getUrgencyState(task.dueDate);
              return (
                <div key={task.id} className="upnext-row" onClick={() => openModal(course.code, task)}>
                  <div className="upnext-top">
                    <span className="upnext-dot" style={{ background: course.color }} />
                    <span className="upnext-course">{course.name}</span>
                    {task.dueDate && (
                      <div className={`assign-task-due due-${urgency}`}>
                        {formatDueLabel(task.dueDate)}
                      </div>
                    )}
                  </div>
                  <div className="upnext-main">
                    <button
                      className="assign-check"
                      aria-label="Mark as done"
                      onClick={(e) => { e.stopPropagation(); handleUpdateTask(course.code, task.id, "completed", true); }}
                    >
                      <Circle size={20} />
                    </button>
                    <div className="upnext-task">{task.title || "Untitled Task"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {tab === "open" && allClear ? (
        <EmptyState
          icon={CheckCircle2}
          title="You're all caught up"
          sub={`Nothing due across your ${courses.length} subjects`}
          action={stats.submitted > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setTab("done")}>
              View submitted work
            </Button>
          )}
        />
      ) : (
        <section className="assign-grid">
          {courses.map(course => {
            const visibleTasks = tab === "open"
              ? course.tasks.filter(t => !t.completed && matchesFilter(t))
              : course.tasks.filter(t => t.completed);
            if (visibleTasks.length === 0) return null;
            const progress = course.tasks.length > 0 ? (course.doneCount / course.tasks.length) * 100 : 0;
            return (
              <div key={course.code} className="assign-card" style={{ '--course-color': course.color }}>
                <div
                  className="assign-card-header"
                  onClick={() => setCollapsedCards(prev => ({ ...prev, [course.code]: !prev[course.code] }))}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="assign-course-name">{course.name}</span>
                  <div className="assign-card-actions">
                    <button className="assign-add-mini" onClick={(e) => { e.stopPropagation(); openModal(course.code); }}>
                      <Plus size={14} strokeWidth={3} /><span className="assign-add-label">Add</span>
                    </button>
                    <span className="assign-badge">
                      {tab === "open" ? `${course.pendingCount} open` : `${course.doneCount} done`}
                    </span>
                    {collapsedCards[course.code] ? <ChevronDown size={18} color="var(--muted)" /> : <ChevronUp size={18} color="var(--muted)" />}
                  </div>
                </div>
                <div className="assign-progress" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="assign-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                {!collapsedCards[course.code] && (
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
      )}

      {tab === "done" && stats.submitted === 0 && (
        <EmptyState compact icon={Inbox} title="Nothing submitted yet" sub="Completed assignments will show up here" />
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
            <div className="assign-modal-head">
              <h2>{modalData.id ? "Edit Assignment" : "New Assignment"}</h2>
              <button className="assign-modal-close" aria-label="Close" onClick={() => setModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="assign-modal-body">
              <div className="assign-field">
                <label>Title</label>
                <input
                  type="text" className="assign-input"
                  placeholder="e.g. Brand Positioning Case Study"
                  value={modalData.title} onChange={e => setModalData({...modalData, title: e.target.value})}
                  autoFocus
                />
              </div>

              <div className="assign-field">
                <label>Subject</label>
                <select
                  className="assign-select"
                  value={modalData.code}
                  onChange={e => setModalData({...modalData, code: e.target.value})}
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
                  value={modalData.dueDate} onChange={e => setModalData({...modalData, dueDate: e.target.value})}
                />
              </div>

              <div className="assign-field">
                <label>Notes</label>
                <textarea
                  className="assign-textarea"
                  placeholder="Submit via LMS, max 1500 words..."
                  value={modalData.description} onChange={e => setModalData({...modalData, description: e.target.value})}
                />
              </div>
            </div>

            <div className="assign-modal-footer">
              {modalData.id ? (
                <button className="assign-btn-delete" onClick={deleteModalTask}>
                  <Trash2 size={16} /> Delete
                </button>
              ) : <div></div>}
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
    </div>
  );
}

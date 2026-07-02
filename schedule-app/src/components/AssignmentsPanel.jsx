import { useState, useMemo } from "react";
import { CheckCircle2, Circle, Plus, Trash2, X, ChevronDown, ChevronUp } from "lucide-react";
import { loadAssignments, pushAssignments } from "../lib/assignments.js";

function getUrgencyState(dueDate) {
  if (!dueDate) return "none";
  const now = new Date();
  now.setHours(0, 0, 0, 0); // compare dates only
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  
  const diffDays = Math.floor((due - now) / (1000 * 60 * 60 * 24));

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

function StatCard({ val, label, colorClass, isMuted, tooltipItems, emptyMsg }) {
  const isEmpty = val === 0;
  return (
    <div className="assign-stat">
      <div className={`assign-stat-val ${colorClass} ${isMuted && isEmpty ? 'stat-muted' : ''}`}>
        {val}
      </div>
      <div className="assign-stat-label">{label}</div>
      <div className="assign-stat-tooltip">
        <div className="ast-header">{val} {label.toLowerCase()}</div>
        {isEmpty || tooltipItems.length === 0 ? (
          <div className="ast-empty">{emptyMsg || 'Nothing here 🎉'}</div>
        ) : (
          <ul className="ast-list">
            {tooltipItems.map((item, i) => (
              <li key={i} className="ast-item">
                <span className={`ast-dot ${colorClass}`} />
                <span className="ast-name">{item.name}</span>
                <span className="ast-count">{item.count}</span>
              </li>
            ))}
          </ul>
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
      };
    }).sort((a, b) => a.code.localeCompare(b.code));
  }, [enrolled, legend, assignments]);

  const stats = useMemo(() => {
    let pending = 0;
    let dueSoon = 0;
    let overdue = 0;
    let submitted = 0;

    const totalTooltip = [];
    const soonTooltip = [];
    const overdueTooltip = [];
    const doneTooltip = [];

    courses.forEach(c => {
      pending += c.pendingCount;
      const completedCount = c.tasks.filter(t => t.completed).length;
      if (completedCount > 0) doneTooltip.push({ name: c.name, count: completedCount });
      submitted += completedCount;

      let cSoon = 0, cOverdue = 0;
      c.tasks.filter(t => !t.completed).forEach(t => {
        const u = getUrgencyState(t.dueDate);
        if (u === "overdue") { overdue++; cOverdue++; }
        else if (u === "danger" || u === "warning") { dueSoon++; cSoon++; }
      });
      if (c.pendingCount > 0) totalTooltip.push({ name: c.name, count: c.pendingCount });
      if (cSoon > 0) soonTooltip.push({ name: c.name, count: cSoon });
      if (cOverdue > 0) overdueTooltip.push({ name: c.name, count: cOverdue });
    });

    return {
      pending, dueSoon, overdue, submitted,
      tooltips: { total: totalTooltip, dueSoon: soonTooltip, overdue: overdueTooltip, done: doneTooltip }
    };
  }, [courses]);

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

  return (
    <div className="assign-page">
      <div className="assign-head-wrapper">
        <div className="assign-head">
          <h1>Assignments</h1>
          <span className="assign-sub">
            {stats.pending === 0 
              ? `🎉 All caught up across your ${courses.length} subjects!`
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
          label="Total open"
          colorClass="stat-total"
          isMuted={false}
          tooltipItems={stats.tooltips.total}
          emptyMsg="All caught up! 🎉"
        />
        <StatCard
          val={stats.dueSoon}
          label="Due this week"
          colorClass="stat-soon"
          isMuted={true}
          tooltipItems={stats.tooltips.dueSoon}
          emptyMsg="Nothing due soon 🎉"
        />
        <StatCard
          val={stats.overdue}
          label="Overdue"
          colorClass="stat-overdue"
          isMuted={true}
          tooltipItems={stats.tooltips.overdue}
          emptyMsg="No overdue tasks 🎉"
        />
        <StatCard
          val={stats.submitted}
          label="Submitted"
          colorClass="stat-submitted"
          isMuted={false}
          tooltipItems={stats.tooltips.done}
          emptyMsg="None completed yet"
        />
      </section>

      <section className="assign-grid">
        {courses.map(course => {
          if (course.tasks.length === 0) return null; // Only show courses with tasks
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
                    <Plus size={14} strokeWidth={3} /> Add
                  </button>
                  <span className="assign-badge">{course.pendingCount} open</span>
                  {collapsedCards[course.code] ? <ChevronDown size={18} color="var(--muted)" /> : <ChevronUp size={18} color="var(--muted)" />}
                </div>
              </div>
              {!collapsedCards[course.code] && (
                <div className="assign-tasks">
                {course.tasks.sort((a, b) => a.completed === b.completed ? 0 : a.completed ? 1 : -1).map(task => {
                  const urgency = task.completed ? "none" : getUrgencyState(task.dueDate);
                  return (
                    <div key={task.id} className={`assign-task-row ${task.completed ? 'completed' : ''}`} onClick={() => openModal(course.code, task)}>
                      <button 
                        className={`assign-check ${task.completed ? 'checked' : ''}`}
                        onClick={(e) => { e.stopPropagation(); handleUpdateTask(course.code, task.id, "completed", !task.completed); }}
                      >
                        {task.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                      </button>
                      <div className="assign-task-content">
                        <div className="assign-task-title">{task.title || "Untitled Task"}</div>
                        {task.description && <div className="assign-task-desc">{task.description}</div>}
                      </div>
                      {task.dueDate && (
                        <div className={`assign-task-due due-${urgency}`}>
                          {urgency === "overdue" ? "Overdue" : `Due ${formatShortDate(task.dueDate)}`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          );
        })}
      </section>

      {modalOpen && (
        <div className="assign-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="assign-modal" onClick={e => e.stopPropagation()}>
            <div className="assign-modal-head">
              <h2>{modalData.id ? "Edit Assignment" : "New Assignment"}</h2>
              <button className="assign-modal-close" onClick={() => setModalOpen(false)}>
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

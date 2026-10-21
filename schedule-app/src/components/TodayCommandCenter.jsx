import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, BookOpenCheck, CalendarClock, Check, CheckCircle2, ChevronDown,
  CircleDot, ClipboardCheck, Clock3, Focus, ListChecks, MapPin, MoonStar,
  Plus, Sparkles, Target, X,
} from "lucide-react";
import { sessionKey } from "../lib/attendance.js";
import { loadAssignments } from "../lib/assignments.js";
import { courseHubId, courseHubStamp, loadCourseHubItems, saveCourseHubItems } from "../lib/courseHubStore.js";
import { readToolkitValue, TOOLKIT_KEYS } from "../lib/studentToolkit.js";
import { fmtTime12 } from "../lib/datetime.js";
import { buildTodayCommandState, readTodayGoals, TODAY_FOCUS_KEY, writeTodayGoals } from "../lib/todayEnhancements.js";
import "../styles/today-command-center.css";

const labelDate = iso => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const goalId = () => `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

function ActionCard({ id, icon: Icon, eyebrow, title, children, onDismiss }) {
  return <article className={`today-action-card today-action-${id}`}>
    <div className="today-action-icon"><Icon size={18} /></div>
    <div className="today-action-copy"><span>{eyebrow}</span><h3>{title}</h3>{children}</div>
    <button type="button" className="today-action-dismiss" aria-label={`Dismiss ${title}`} onClick={() => onDismiss(id)}><X size={15} /></button>
  </article>;
}

export default function TodayCommandCenter({
  todayList = [], tomorrowList = [], attendance = {}, now, todayISO, termNumber,
  changeCount = 0, onNavigate, onOpenSession, onOpenCourse, onMarkAttendance,
  focusMode: controlledFocusMode, onFocusModeChange, onRemove,
}) {
  const [assignments] = useState(loadAssignments);
  const [courseItems, setCourseItems] = useState(loadCourseHubItems);
  const [goals, setGoals] = useState(() => readTodayGoals(todayISO));
  const [goalDraft, setGoalDraft] = useState("");
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => new Set());
  const [localFocusMode, setFocusMode] = useState(() => {
    try { return localStorage.getItem(TODAY_FOCUS_KEY) === "1"; } catch { return false; }
  });
  const focusMode = controlledFocusMode ?? localFocusMode;
  const [capture, setCapture] = useState({ takeaway: "", doubt: "", review: false });
  const [savedNote, setSavedNote] = useState(false);
  const state = useMemo(() => buildTodayCommandState({ todayList, tomorrowList, attendance, assignments, courseItems, now }), [todayList, tomorrowList, attendance, assignments, courseItems, now]);
  const studyToday = readToolkitValue(TOOLKIT_KEYS.study, []).filter(item => item.date === todayISO && item.status !== "done");
  const careerDue = readToolkitValue(TOOLKIT_KEYS.careers, []).filter(item => item.deadline === todayISO && !["rejected", "withdrawn", "offered"].includes(item.stage));
  const reviewDue = courseItems.filter(item => !item.deleted && item.kind === "topic" && item.details?.flagged && (!item.details.reviewAt || item.details.reviewAt <= todayISO));
  const nextTaskForCourse = state.next ? state.pendingTasks.find(item => item.code === state.next.code) : null;
  const lastCourseNote = state.next ? courseItems.filter(item => !item.deleted && item.kind === "note" && item.code === state.next.code).sort((a, b) => b.updatedAt - a.updatedAt)[0] : null;
  const completedGoals = goals.filter(goal => goal.done).length;

  useEffect(() => { if (controlledFocusMode === undefined) onFocusModeChange?.(focusMode); }, [focusMode, controlledFocusMode, onFocusModeChange]);
  const updateGoals = next => { setGoals(next); writeTodayGoals(todayISO, next); };
  const addGoal = event => {
    event.preventDefault();
    if (!goalDraft.trim() || goals.length >= 3) return;
    updateGoals([...goals, { id: goalId(), text: goalDraft.trim(), done: false }]);
    setGoalDraft("");
  };
  const toggleFocus = () => {
    const next = !focusMode;
    if (controlledFocusMode === undefined) setFocusMode(next);
    else onFocusModeChange?.(next);
    try { localStorage.setItem(TODAY_FOCUS_KEY, next ? "1" : "0"); } catch { /* optional preference */ }
  };
  const dismiss = id => setDismissed(current => new Set([...current, id]));

  const saveCapture = event => {
    event.preventDefault();
    if (!state.recent || (!capture.takeaway.trim() && !capture.doubt.trim())) return;
    const stamp = courseHubStamp();
    const base = {
      term: termNumber || "", code: state.recent.code, url: "", deleted: false,
      updatedAt: stamp, pending: true, done: false,
    };
    const note = {
      ...base, id: courseHubId(), kind: "note", sessionKey: sessionKey(state.recent),
      title: `Class · ${labelDate(state.recent.date)} ${state.recent.start}`,
      details: { sessionDate: state.recent.date, takeaway: capture.takeaway.trim(), doubt: capture.doubt.trim(), followUp: capture.review ? "Review this class" : "" },
    };
    const nextItems = [...courseItems, note];
    if (capture.review) nextItems.push({
      ...base, id: courseHubId(), kind: "topic", sessionKey: "", title: `Review · ${state.recent.name || state.recent.code}`,
      details: { question: `What were the key ideas from ${state.recent.name || state.recent.code}?`, answer: capture.takeaway.trim(), flagged: true, reviewAt: todayISO, reviewStep: -1 },
    });
    saveCourseHubItems(nextItems);
    setCourseItems(nextItems);
    setCapture({ takeaway: "", doubt: "", review: false });
    setSavedNote(true);
  };

  const contextCards = [];
  if (state.transition) contextCards.push({ id: "transition", priority: 1 });
  if (state.next && state.minutesToNext >= 0 && state.minutesToNext <= 60) contextCards.push({ id: "readiness", priority: 2 });
  if (state.recent) contextCards.push({ id: "capture", priority: 3 });
  if (state.endOfDay) contextCards.push({ id: "closeout", priority: 4 });
  if (state.freeDay) contextCards.push({ id: "free-day", priority: 5 });
  if ((now.getHours() >= 17 || state.endOfDay || state.freeDay) && state.tomorrowFirst) contextCards.push({ id: "tomorrow", priority: 6 });
  const visibleCards = contextCards.filter(card => !dismissed.has(card.id)).sort((a, b) => a.priority - b.priority).slice(0, 2);

  const renderCard = ({ id }) => {
    if (id === "transition") return <ActionCard key={id} id={id} icon={MapPin} eyebrow="ROOM TRANSITION" title={`${state.transition.gap} minutes to move`} onDismiss={dismiss}><p>{state.transition.previous.room} → {state.transition.next.room} before {state.transition.next.code || state.transition.next.name}.</p><button onClick={() => onOpenSession?.(state.transition.next)}>Open class details <ArrowRight size={14} /></button></ActionCard>;
    if (id === "readiness") return <ActionCard key={id} id={id} icon={BookOpenCheck} eyebrow="NEXT CLASS" title={`${state.next.code || state.next.name} in ${state.minutesToNext} min`} onDismiss={dismiss}><p>{state.next.room || "Room TBA"}{nextTaskForCourse ? ` · ${nextTaskForCourse.title} due ${nextTaskForCourse.dueDate || "soon"}` : lastCourseNote?.details?.takeaway ? ` · Last note: ${lastCourseNote.details.takeaway}` : " · No pending prep found"}</p><div className="today-action-buttons"><button onClick={() => onOpenSession?.(state.next)}>Class prep</button><button onClick={() => onOpenCourse?.(state.next.code)}>Course hub</button></div></ActionCard>;
    if (id === "capture") return <ActionCard key={id} id={id} icon={Sparkles} eyebrow="AFTER CLASS" title={`Capture ${state.recent.code || state.recent.name}`} onDismiss={dismiss}><form className="today-capture" onSubmit={saveCapture}><input aria-label="Key takeaway" maxLength="500" value={capture.takeaway} onChange={event => setCapture({ ...capture, takeaway: event.target.value })} placeholder="One key takeaway…" /><input aria-label="Doubt to clarify" maxLength="300" value={capture.doubt} onChange={event => setCapture({ ...capture, doubt: event.target.value })} placeholder="A doubt to clarify…" /><label><input type="checkbox" checked={capture.review} onChange={event => setCapture({ ...capture, review: event.target.checked })} /> Add to revision queue</label><button type="submit">Save to Course Learning</button></form></ActionCard>;
    if (id === "closeout") return <ActionCard key={id} id={id} icon={MoonStar} eyebrow="DAY CLOSEOUT" title={state.unmarked.length ? `${state.unmarked.length} attendance mark${state.unmarked.length > 1 ? "s" : ""} left` : "Classes wrapped for today"} onDismiss={dismiss}><p>{state.nextTask ? `Next deadline: ${state.nextTask.title}${state.nextTask.dueDate ? ` · ${labelDate(state.nextTask.dueDate)}` : ""}` : state.tomorrowFirst ? `Tomorrow starts at ${fmtTime12(state.tomorrowFirst.start)}.` : "No pending academic tasks found."}</p>{state.unmarked[0] && <button onClick={() => onMarkAttendance?.(state.unmarked[0], "present")}><Check size={14} /> Mark {state.unmarked[0].code} present</button>}</ActionCard>;
    if (id === "free-day") return <ActionCard key={id} id={id} icon={Target} eyebrow="FREE DAY" title="Shape the day your way" onDismiss={dismiss}><p>{state.pendingTasks.length} open task{state.pendingTasks.length === 1 ? "" : "s"} · {reviewDue.length} revision item{reviewDue.length === 1 ? "" : "s"} · {studyToday.length} study plan{studyToday.length === 1 ? "" : "s"}{careerDue.length ? ` · ${careerDue.length} placement deadline` : ""}</p><div className="today-action-buttons"><button onClick={() => onNavigate?.("assignments")}>Open tasks</button><button onClick={() => onNavigate?.("planner")}>Open planner</button></div></ActionCard>;
    if (id === "tomorrow") return <ActionCard key={id} id={id} icon={CalendarClock} eyebrow="TOMORROW PREVIEW" title={`${state.tomorrowFirst.code || state.tomorrowFirst.name} at ${fmtTime12(state.tomorrowFirst.start)}`} onDismiss={dismiss}><p>{state.tomorrowFirst.room || "Room TBA"}{state.tomorrowFirst.start < "09:00" ? " · Early start" : ""}{state.nextTask?.dueDate === state.tomorrowFirst.date ? ` · ${state.nextTask.title} is due` : ""}</p><button onClick={() => onNavigate?.("tomorrow")}>Open tomorrow <ArrowRight size={14} /></button></ActionCard>;
    return null;
  };

  return <section className={`today-command${focusMode ? " is-focus" : ""}`} aria-labelledby="today-command-title">
    <header className="today-command-head"><div><span><Sparkles size={14} /> TODAY COMMAND</span><h2 id="today-command-title">Keep the day moving</h2></div><div className="today-command-controls"><button type="button" className={`today-focus-toggle${focusMode ? " is-active" : ""}`} aria-pressed={focusMode} onClick={toggleFocus}><Focus size={15} /> {focusMode ? "Exit focus" : "Focus mode"}</button><button type="button" className="today-command-remove" onClick={onRemove} aria-label="Remove Today Command from the Today page" title="Remove from Today"><X size={16} /></button></div></header>
    <div className="today-progress" aria-label={`${state.progress}% of today's scheduled sessions complete`}><div><span>Day progress</span><strong>{state.teaching.filter(item => new Date(`${item.date}T${item.end}`) <= now).length}/{state.teaching.length || 0} sessions</strong></div><div className="today-progress-track"><span style={{ width: `${state.progress}%` }} /></div><div><span>Attendance</span><strong>{state.marked.length}/{state.completed.length || 0} marked</strong></div><div><span>Goals</span><strong>{completedGoals}/{goals.length || 0} done</strong></div></div>
    <div className="today-brief" aria-label="Today's priority brief">
      <button onClick={() => state.next ? onOpenSession?.(state.next) : onNavigate?.("fullSchedule")}><Clock3 size={16} /><span><small>Next</small><strong>{state.current ? `${state.current.code || state.current.name} now` : state.next ? `${state.next.code || state.next.name} · ${fmtTime12(state.next.start)}` : "No more classes"}</strong></span></button>
      <button onClick={() => onNavigate?.("assignments")}><ClipboardCheck size={16} /><span><small>Deadline</small><strong>{state.nextTask ? `${state.nextTask.title}${state.nextTask.dueDate ? ` · ${labelDate(state.nextTask.dueDate)}` : ""}` : "Nothing pending"}</strong></span></button>
      <button onClick={() => changeCount ? onNavigate?.("notifications") : state.unmarked[0] && onMarkAttendance?.(state.unmarked[0], "present")}><CircleDot size={16} /><span><small>Action</small><strong>{changeCount ? `${changeCount} schedule update${changeCount > 1 ? "s" : ""}` : state.unmarked.length ? `${state.unmarked.length} attendance mark${state.unmarked.length > 1 ? "s" : ""}` : "You’re caught up"}</strong></span></button>
    </div>
    {savedNote && <div className="today-saved" role="status"><CheckCircle2 size={15} /> Saved to Course Learning.</div>}
    {visibleCards.length > 0 && <div className="today-action-grid">{visibleCards.map(renderCard)}</div>}
    <div className={`today-goals${goalsOpen ? " is-open" : ""}`}><button type="button" className="today-goals-toggle" onClick={() => setGoalsOpen(value => !value)} aria-expanded={goalsOpen}><span><ListChecks size={16} /><strong>Daily goals</strong><small>{goals.length ? `${completedGoals}/${goals.length} complete` : "Choose up to three priorities"}</small></span><ChevronDown size={16} /></button>{goalsOpen && <div className="today-goals-body">{goals.map(goal => <label key={goal.id}><input type="checkbox" checked={goal.done} onChange={() => updateGoals(goals.map(item => item.id === goal.id ? { ...item, done: !item.done } : item))} /><span>{goal.text}</span><button type="button" aria-label={`Remove ${goal.text}`} onClick={() => updateGoals(goals.filter(item => item.id !== goal.id))}><X size={14} /></button></label>)}{goals.length < 3 && <form onSubmit={addGoal}><input maxLength="100" value={goalDraft} onChange={event => setGoalDraft(event.target.value)} placeholder="Add today’s priority" aria-label="New daily goal" /><button type="submit"><Plus size={15} /> Add</button></form>}</div>}</div>
  </section>;
}

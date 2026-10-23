import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, CheckCircle2,
  ClipboardList, Clock3, ExternalLink, GraduationCap, Link2, Plus,
  Search, Trash2, WifiOff,
} from "lucide-react";
import { fmtTime12 } from "../lib/datetime.js";
import { subjectClass } from "../lib/subjectColors.js";
import { buildCourseHub, courseAttention, courseJourney, courseWeeklyLoad } from "../lib/courseHub.js";
import CourseLearning from "./CourseLearning.jsx";
import MobileV2Breadcrumbs from "./mobile/MobileV2Breadcrumbs.jsx";
import { loadAssignments } from "../lib/assignments.js";
import { courseHubId, courseHubStamp, loadCourseHubItems, saveCourseHubItems, syncCourseHubItems } from "../lib/courseHubStore.js";
import { safeUrl } from "../lib/safeUrl.js";
import "../styles/course-hub.css";
import { useBackClose } from "../lib/backClose.js";

const dateLabel = (iso, options = { weekday: "short", day: "numeric", month: "short" }) => {
  if (!iso) return "Date to be announced";
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString([], options);
};
const hourLabel = (minutes) => `${Math.round(minutes / 60 * 10) / 10}h`;
const isoDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const validWebUrl = (value) => {
  if (!/^https?:\/\//i.test(String(value).trim())) return null;
  const url = safeUrl(value);
  return url && /^https?:/i.test(url) ? url : null;
};

function Empty({ title, text, action }) { return title ? <div className="ch-empty ch-empty-overview" role="status"><BookOpen size={20} aria-hidden="true" /><strong>{title}</strong><p>{text}</p>{action}</div> : <p className="ch-empty">{text}</p>; }

function Journey({ course, now, onOpen }) {
  const events = courseJourney(course, now);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weeks = Array.from({ length: 4 }, (_, index) => {
    const from = new Date(start); from.setDate(from.getDate() + index * 7);
    const to = new Date(from); to.setDate(to.getDate() + 7);
    const fromISO = isoDate(from);
    const toISO = isoDate(to);
    return { from, to, events: events.filter((event) => event.date >= fromISO && event.date < toISO) };
  });
  return <section className="ch-panel ch-journey" aria-labelledby="ch-journey-title">
    <div className="ch-panel-head"><div><span className="ch-eyebrow">NEXT 4 WEEKS</span><h2 id="ch-journey-title">Course journey</h2></div><CalendarDays size={18} aria-hidden="true" /></div>
    <p className="ch-sub">Classes, due work and confirmed exams in one timeline.</p>
    <div className="ch-journey-weeks">{weeks.map((week, index) => <div className="ch-journey-week" key={index}>
      <div className="ch-week-label"><span>Week {index + 1}</span><small>{dateLabel(isoDate(week.from), { day: "numeric", month: "short" })}–{dateLabel(isoDate(new Date(week.to.getTime() - 86400000)), { day: "numeric", month: "short" })}</small></div>
      <div className="ch-week-events">{week.events.length ? week.events.map((event, eventIndex) => <button type="button" className={`ch-event is-${event.kind}`} key={`${event.kind}-${event.date}-${eventIndex}`} onClick={() => onOpen(event)}>
        <span className="ch-event-dot" aria-hidden="true" /><span><strong>{event.title}</strong><small>{dateLabel(event.date)}{event.kind !== "task" && event.start ? ` · ${fmtTime12(event.start)}` : ""}</small></span><ArrowRight size={14} aria-hidden="true" />
      </button>) : <span className="ch-week-clear">No course events</span>}</div>
    </div>)}</div>
  </section>;
}

function AttendanceRunway({ course, onOpen }) {
  const { stats } = course;
  const requirement = Number(course.credits) === 0 ? 90 : 80;
  const pct = stats.pct;
  const targetText = [1.5, 3].includes(Number(course.credits)) ? `${stats.totalAllowedSkips} skips allowed` : `${requirement}% requirement`;
  return <section className="ch-panel ch-attendance" aria-labelledby="ch-att-title">
    <div className="ch-panel-head"><div><span className="ch-eyebrow">ATTENDANCE</span><h2 id="ch-att-title">Attendance runway</h2></div><button className="ch-inline-link" onClick={onOpen}>Open <ArrowRight size={14} /></button></div>
    <div className="ch-att-top"><strong>{pct == null ? "—" : `${pct}%`}</strong><span>{stats.present}/{stats.present + stats.absent} marked present</span></div>
    <div className="ch-att-track" role="img" aria-label={pct == null ? "No attendance marked yet" : `${pct}% attendance, ${requirement}% reference line`}>
      <i style={{ width: `${pct ?? 0}%` }} /><b style={{ left: `${requirement}%` }} />
    </div>
    <div className="ch-att-scale"><span>0%</span><span>{requirement}% reference</span><span>100%</span></div>
    <div className="ch-att-facts"><div><strong>{stats.skipsRemaining}</strong><span>skips remaining</span></div><div><strong>{course.coverage}%</strong><span>past sessions recorded</span></div></div>
    <p className="ch-footnote">{targetText}. Unmarked classes are excluded from the attendance percentage.</p>
  </section>;
}

function WorkloadRhythm({ course, now, estimates, onOpenTask }) {
  const weeks = courseWeeklyLoad(course, estimates, now);
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(null);
  const totals = weeks.map((week) => week.classMinutes + week.estimatedMinutes);
  const max = Math.max(60, ...totals);
  const points = totals.map((value, index) => ({ x: 24 + index * 96, y: 104 - value / max * 78 }));
  const line = points.reduce((path, point, index) => index === 0 ? `M ${point.x} ${point.y}` : `${path} C ${points[index - 1].x + 48} ${points[index - 1].y}, ${point.x - 48} ${point.y}, ${point.x} ${point.y}`, "");
  const shown = hovered ?? active;
  const hoveredWeek = hovered == null ? null : weeks[hovered];
  const hoverWeekAt = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width) return;
    const x = (event.clientX - bounds.left) / bounds.width * 336;
    setHovered(Math.max(0, Math.min(3, Math.round((x - 24) / 96))));
  };
  return <section className="ch-panel ch-workload" aria-labelledby="ch-workload-title">
    <div className="ch-panel-head"><div><span className="ch-eyebrow">COMING MONTH</span><h2 id="ch-workload-title">Workload rhythm</h2></div><Clock3 size={18} aria-hidden="true" /></div>
    <p className="ch-sub">A smooth view of class time and estimated work due each week.</p>
    <div className="ch-work-curve"><svg viewBox="0 0 336 120" role="img" aria-label="Four-week workload curve; move across it for details or select a week below" onPointerMove={hoverWeekAt} onPointerLeave={() => setHovered(null)}><defs><linearGradient id="ch-work-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--violet)" stopOpacity=".24" /><stop offset="100%" stopColor="var(--violet)" stopOpacity=".01" /></linearGradient></defs><path className="ch-work-area" d={`${line} L ${points[3].x} 112 L ${points[0].x} 112 Z`} fill="url(#ch-work-fill)" /><path className="ch-work-line" d={line} pathLength="1" fill="none" stroke="var(--violet)" strokeWidth="3" strokeLinecap="round" />{points.map((point, index) => <circle className="ch-work-point" key={index} cx={point.x} cy={point.y} r="3.5" fill="var(--card)" stroke="var(--violet)" strokeWidth="2.5" style={{ animationDelay: `${280 + index * 90}ms` }} />)}</svg><span className="ch-work-cursor" aria-hidden="true" style={{ left: `${points[shown].x / 336 * 100}%`, top: `${points[shown].y / 120 * 100}%` }} />{hoveredWeek && <div className="ch-work-tooltip" aria-hidden="true" style={{ left: `clamp(100px, ${points[hovered].x / 336 * 100}%, calc(100% - 100px))` }}><strong>Week {hovered + 1} · {dateLabel(hoveredWeek.first, { day: "numeric", month: "short" })}</strong><span>{hourLabel(totals[hovered])} total · {hourLabel(hoveredWeek.classMinutes)} class · {hourLabel(hoveredWeek.estimatedMinutes)} work</span><small>{hoveredWeek.due.length} task{hoveredWeek.due.length === 1 ? "" : "s"} due · {hoveredWeek.examCount} exam{hoveredWeek.examCount === 1 ? "" : "s"}{hoveredWeek.unestimated ? ` · ${hoveredWeek.unestimated} unestimated` : ""}</small></div>}</div>
    <div className="ch-work-axis" role="group" aria-label="Select a week to view tasks">{weeks.map((week, index) => <button type="button" key={week.first} className={shown === index ? "is-active" : ""} onClick={() => setActive(index)} aria-pressed={active === index} aria-label={`Week ${index + 1}, ${hourLabel(totals[index])} total, ${hourLabel(week.classMinutes)} class time, ${hourLabel(week.estimatedMinutes)} estimated work, ${week.due.length} tasks due${week.examCount ? `, ${week.examCount} exams` : ""}`}><strong>W{index + 1}</strong><small>{hourLabel(totals[index])}</small></button>)}</div>
    <div className="ch-week-detail"><strong>Week {shown + 1} · {dateLabel(weeks[shown].first, { day: "numeric", month: "short" })}</strong>
      <span>{hourLabel(weeks[shown].classMinutes)} classes · {hourLabel(weeks[shown].estimatedMinutes)} estimated work{weeks[shown].unestimated ? ` · ${weeks[shown].unestimated} without estimates` : ""}</span>
      {weeks[shown].due.map((task) => <button key={task.id} className="ch-task-link" onClick={() => onOpenTask(task)}>{task.title || "Untitled assignment"}<ArrowRight size={13} /></button>)}
    </div>
  </section>;
}

export default function CourseHub({ allClasses = [], enrolled = {}, legend = {}, attendance = {}, now = new Date(), termNumber = "current", userId, isOffline, isArchived = false, selectedCode, onSelectCode, onOpenSchedule, onNavigate, onOpenTask, v2Navigation }) {
  const [assignments, setAssignments] = useState(loadAssignments);
  const [items, setItems] = useState(loadCourseHubItems);
  const [synced, setSynced] = useState(false);
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ kind: "", id: "", title: "", url: "" });
  useBackClose(() => setForm({ kind: "", id: "", title: "", url: "" }), !!form.kind);
  const [error, setError] = useState("");
  const courses = useMemo(() => buildCourseHub({ allClasses, enrolled, legend, attendance, assignments: isArchived ? {} : assignments, now }), [allClasses, enrolled, legend, attendance, assignments, now, isArchived]);
  const visibleCourses = courses.filter((item) => `${item.name} ${item.code}`.toLowerCase().includes(query.toLowerCase()));
  const course = courses.find((item) => item.code === selectedCode);
  const term = String(termNumber || "current");
  const courseItems = items.filter((item) => !item.deleted && item.term === term && item.code === course?.code);
  const nextKey = course?.nextClass ? `${course.nextClass.date}_${course.nextClass.start}_${course.code}_${course.nextClass.section}` : "";
  const prep = courseItems.filter((item) => item.kind === "prep" && item.sessionKey === nextKey);
  const links = courseItems.filter((item) => item.kind === "link");
  let estimates = {};
  try { estimates = JSON.parse(localStorage.getItem("pgp2.planner-effort") || "{}"); } catch { /* no saved estimates */ }

  useEffect(() => { const refresh = () => setAssignments(loadAssignments()); window.addEventListener("focus", refresh); return () => window.removeEventListener("focus", refresh); }, []);
  useEffect(() => { saveCourseHubItems(items); }, [items]);
  useEffect(() => { const online = () => setRevision((value) => value + 1); window.addEventListener("online", online); return () => window.removeEventListener("online", online); }, []);
  useEffect(() => {
    if (isOffline || !userId) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const snapshot = loadCourseHubItems();
      const result = await syncCourseHubItems(userId, snapshot, { readOnly: isArchived });
      if (cancelled) return;
      setSynced(result.synced);
      setItems((current) => {
        const merged = new Map(result.items.map((item) => [item.id, item]));
        current.forEach((item) => { if (!merged.has(item.id) || item.updatedAt > merged.get(item.id).updatedAt) merged.set(item.id, item); });
        return [...merged.values()];
      });
    }, 450);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [revision, userId, isOffline, isArchived]);

  const saveItem = () => {
    const title = form.title.trim();
    const url = form.kind === "link" ? validWebUrl(form.url) : "";
    if (!title) { setError("Add a short title."); return; }
    if (form.kind === "link" && !url) { setError("Use a valid http or https link."); return; }
    const stamp = courseHubStamp();
    const existing = items.find((item) => item.id === form.id);
    const item = { id: form.id || courseHubId(), term, code: course.code, kind: form.kind, title,
      url, sessionKey: form.kind === "prep" ? nextKey : "", done: existing?.done || false,
      deleted: false, updatedAt: Math.max(stamp, (existing?.updatedAt || 0) + 1), pending: true };
    setItems((current) => [...current.filter((row) => row.id !== item.id), item]);
    setSynced(false); setRevision((value) => value + 1); setForm({ kind: "", id: "", title: "", url: "" }); setError("");
  };
  const changeItem = (item, patch) => {
    const stamp = courseHubStamp();
    setItems((current) => current.map((row) => row.id === item.id ? { ...row, ...patch, updatedAt: Math.max(stamp, row.updatedAt + 1), pending: true } : row));
    setSynced(false); setRevision((value) => value + 1);
  };
  const saveLearning = (kind, title, details, sessionKey = "", id = "") => {
    const stamp = courseHubStamp();
    const existing = items.find((item) => item.id === id);
    const item = { id: id || courseHubId(), term, code: course.code, kind, title, url: "", sessionKey,
      details, done: existing?.done || false, deleted: false,
      updatedAt: Math.max(stamp, (existing?.updatedAt || 0) + 1), pending: true };
    setItems((current) => [...current.filter((row) => row.id !== item.id), item]);
    setSynced(false); setRevision((value) => value + 1);
  };
  const openEvent = (event) => event.kind === "task" ? onOpenTask?.(course.code, event.item) : event.kind === "exam" ? onNavigate("exams") : onOpenSchedule?.(event.item);

  if (!course) return <div className="course-hub">
    {v2Navigation && <MobileV2Breadcrumbs view="courseHub" {...v2Navigation} />}
    <header className="ch-overview-head"><span className="ch-eyebrow">YOUR TERM, BY COURSE</span><h1>Courses</h1><p>Classes, work and progress brought together for each subject.</p></header>
    <label className="ch-search"><Search size={17} /><input aria-label="Search courses" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a course" /></label>
    {courses.length ? visibleCourses.length ? <div className="ch-course-grid">{visibleCourses.map((item) => {
      const attention = isArchived ? null : courseAttention(item, now);
      const status = attention?.label || (item.nextClass ? `Next class ${dateLabel(item.nextClass.date)}` : "No class ahead");
      return <button type="button" className={`ch-course-card${attention ? " has-attention" : ""}`} key={item.code} onClick={() => onSelectCode(item.code)} aria-label={`Open ${item.name}. ${status}`}>
        <span className="ch-course-card-top"><span className={`ch-course-code ${subjectClass(item.code)}`}>{item.code}</span><span className="ch-card-status">{status}</span></span>
        <h2>{item.name}</h2><small>{item.area}{item.credits ? ` · ${item.credits} credits` : ""}</small>
        {attention && <span className="ch-attention">{attention.detail}</span>}
        <div className="ch-course-card-stats"><span>{item.nextClass ? dateLabel(item.nextClass.date) : "—"}<b>Next class</b></span><span>{item.openTasks.length}<b>Open tasks</b></span><span>{item.stats.pct == null ? "—" : `${item.stats.pct}%`}<b>Attendance</b></span></div><span className="ch-card-open" aria-hidden="true"><ArrowRight size={16} /></span>
      </button>;
    })}</div> : <Empty title="No matching courses" text="Try another name or course code." action={<button type="button" className="ch-empty-action" onClick={() => setQuery("")}>Clear search</button>} /> : <Empty title="Your courses will appear here" text="Complete setup to see classes, work and progress by subject." />}
  </div>;

  return <div className="course-hub ch-detail" key={course.code}>
    {v2Navigation
      ? <MobileV2Breadcrumbs view="courseHub" {...v2Navigation} detail={course.name || course.code} onBack={() => onSelectCode(null)} />
      : <button className="ch-back" onClick={() => onSelectCode(null)}><ArrowLeft size={16} /> All courses</button>}
    <header className="ch-detail-head"><div><span className="ch-eyebrow">{course.code} · {course.area || "COURSE"}</span><h1>{course.name}</h1><p>Section {course.section || "Single"}{course.credits ? ` · ${course.credits} credits` : ""}</p></div><span className="ch-sync-status">{isArchived ? "Archived term" : !courseItems.length ? "Private course view" : isOffline ? <><WifiOff size={13} /> Saved on device</> : courseItems.some((item) => item.pending) || !synced ? "Sync pending" : "Synced"}</span></header>
    <section className="ch-next"><div><span className="ch-eyebrow">NEXT CLASS</span><strong>{course.nextClass ? dateLabel(course.nextClass.date, { weekday: "long", day: "numeric", month: "short" }) : "No upcoming class"}</strong><span>{course.nextClass ? `${fmtTime12(course.nextClass.start)}–${fmtTime12(course.nextClass.end)}${course.nextClass.room ? ` · ${course.nextClass.room}` : ""}` : "Your schedule is clear for this course."}</span></div>{course.nextClass && <button onClick={() => onOpenSchedule?.(course.nextClass)}>View in timetable <ArrowRight size={15} /></button>}</section>
    <div className="ch-snapshot" aria-label="Course snapshot"><div><span>Sessions left</span><strong>{course.sessions.filter((item) => item.date >= isoDate(now)).length}</strong></div><div><span>Open work</span><strong>{course.openTasks.length}</strong></div><div><span>Attendance</span><strong>{course.stats.pct == null ? "—" : `${course.stats.pct}%`}</strong></div><div><span>Next exam</span><strong>{course.nextExam ? dateLabel(course.nextExam.date, { day: "numeric", month: "short" }) : "—"}</strong></div></div>
    <div className="ch-detail-grid"><div className="ch-main-col">
      <section className="ch-panel ch-prep" aria-labelledby="ch-prep-title"><div className="ch-panel-head"><div><span className="ch-eyebrow">BEFORE CLASS</span><h2 id="ch-prep-title">Prepare for next class</h2></div><ClipboardList size={18} /></div>
        <p className="ch-sub">{course.nextClass ? `Your checklist for ${dateLabel(course.nextClass.date)}.` : "A checklist appears when another class is scheduled."}</p>
        {prep.length ? <div className="ch-items">{prep.map((item) => <div className="ch-prep-item" key={item.id}><button disabled={isArchived} className={item.done ? "is-done" : ""} onClick={() => changeItem(item, { done: !item.done })} aria-label={`${item.done ? "Mark incomplete" : "Mark complete"}: ${item.title}`}><Check size={13} /></button><span className={item.done ? "is-done" : ""}>{item.title}</span>{!isArchived && <button className="ch-item-edit" onClick={() => setForm({ kind: "prep", id: item.id, title: item.title, url: "" })}>Edit</button>}{!isArchived && <button className="ch-item-delete" aria-label={`Remove ${item.title}`} onClick={() => changeItem(item, { deleted: true })}><Trash2 size={14} /></button>}</div>)}</div> : <Empty text="No preparation items for the next class." />}
        {!isArchived && course.nextClass && <button className="ch-add" onClick={() => { setForm({ kind: "prep", id: "", title: "", url: "" }); setError(""); }}><Plus size={15} /> Add preparation item</button>}
      </section>
      <CourseLearning course={course} items={courseItems} now={now} isArchived={isArchived} onSave={saveLearning} onChange={changeItem} />
      <Journey course={course} now={now} onOpen={openEvent} />
      <section className="ch-panel ch-resources" aria-labelledby="ch-resources-title"><div className="ch-panel-head"><div><span className="ch-eyebrow">YOUR LINKS</span><h2 id="ch-resources-title">Course resources</h2></div><Link2 size={18} /></div><p className="ch-sub">Save readings, slides or course pages for your own use.</p>
        {links.length ? <div className="ch-items">{links.map((item) => <div className="ch-resource-item" key={item.id}><a href={validWebUrl(item.url) || undefined} target="_blank" rel="noopener noreferrer"><BookOpen size={16} /><span>{item.title}</span><ExternalLink size={14} /></a>{!isArchived && <button className="ch-item-edit" onClick={() => setForm({ kind: "link", id: item.id, title: item.title, url: item.url })}>Edit</button>}{!isArchived && <button className="ch-item-delete" aria-label={`Remove ${item.title}`} onClick={() => changeItem(item, { deleted: true })}><Trash2 size={14} /></button>}</div>)}</div> : <Empty text="No saved links for this course." />}
        {!isArchived && <button className="ch-add" onClick={() => { setForm({ kind: "link", id: "", title: "", url: "" }); setError(""); }}><Plus size={15} /> Add resource link</button>}
      </section>
    </div><div className="ch-side-col">
      <AttendanceRunway course={course} onOpen={() => onNavigate("attendance")} />
      <WorkloadRhythm course={course} now={now} estimates={estimates} onOpenTask={(task) => onOpenTask?.(course.code, task)} />
      <section className="ch-panel ch-work-list"><div className="ch-panel-head"><div><span className="ch-eyebrow">OPEN WORK</span><h2>Assignments</h2></div><button className="ch-inline-link" onClick={() => onOpenTask?.(course.code)}>Open <ArrowRight size={14} /></button></div>{course.openTasks.length ? course.openTasks.slice(0, 4).map((task) => <button className="ch-work-item" key={task.id} onClick={() => onOpenTask?.(course.code, task)}><span>{task.title || "Untitled assignment"}<small>{task.dueDate ? `Due ${dateLabel(task.dueDate)}` : "No due date"}</small></span><ArrowRight size={14} /></button>) : <Empty text="No open assignments." />}</section>
      <section className="ch-panel ch-exam-list"><div className="ch-panel-head"><div><span className="ch-eyebrow">ASSESSMENTS</span><h2>Exams</h2></div><GraduationCap size={18} /></div>{course.exams.filter((item) => item.date >= isoDate(now)).length ? course.exams.filter((item) => item.date >= isoDate(now)).slice(0, 3).map((item, index) => <button className="ch-work-item" key={`${item.date}-${index}`} onClick={() => onNavigate("exams")}><span>{item.name || "Exam"}<small>{dateLabel(item.date)}{item.start ? ` · ${fmtTime12(item.start)}` : ""}</small></span><ArrowRight size={14} /></button>) : <Empty text="No confirmed exam ahead." />}</section>
    </div></div>
    {form.kind && <div className="ch-modal-backdrop" onClick={() => setForm({ kind: "", id: "", title: "", url: "" })}><div className="ch-modal" role="dialog" aria-modal="true" aria-labelledby="ch-modal-title" onClick={(event) => event.stopPropagation()}><h2 id="ch-modal-title">{form.id ? "Edit" : "Add"} {form.kind === "link" ? "resource link" : "preparation item"}</h2><label>Title<input autoFocus maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder={form.kind === "link" ? "Course reading" : "Review case notes"} /></label>{form.kind === "link" && <label>Web address<input type="url" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder="https://" /></label>}{error && <p role="alert" className="ch-error">{error}</p>}<div className="ch-modal-actions"><button onClick={() => { setForm({ kind: "", id: "", title: "", url: "" }); setError(""); }}>Cancel</button><button onClick={saveItem}><CheckCircle2 size={15} /> Save</button></div></div></div>}
  </div>;
}

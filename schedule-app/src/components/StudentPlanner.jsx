import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowRight, BarChart3, BellRing,
  CalendarClock, CalendarDays, CalendarSync, CheckCircle2,
  ChevronRight, CircleGauge, Cloud, CloudOff, Sparkles, Target,
  Workflow,
} from "lucide-react";
import { loadAssignments } from "../lib/assignments.js";
import { fmtTime12 } from "../lib/datetime.js";
import {
  ATTENDANCE_TARGET, buildAttendanceForecast, buildDailyBrief, buildPlannerInsights,
  buildAttendanceScenario, buildWeeklyPlanner, findFreeWindows, flattenAssignments, minutesLabel,
} from "../lib/studentPlanner.js";
import { OfflineSyncCenter, SmartCalendar } from "./StudentPlannerTools.jsx";
import "../styles/planner.css";

const MISSES_KEY = "pgp2.planner-misses";
const EFFORT_KEY = "pgp2.planner-effort";
const BUDGET_KEY = "pgp2.planner-daily-study-budget";
const TABS = [
  ["brief", "What's next", Sparkles],
  ["forecast", "Forecast", Target],
  ["workload", "Workload", CalendarClock],
  ["calendar", "Calendar", CalendarSync],
  ["changes", "Changes", BellRing],
  ["sync", "Sync", Cloud],
  ["insights", "Insights", BarChart3],
];

function loadObject(key) {
  try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; }
}

function saveObject(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* local planning remains optional */ }
}

function loadBudget() {
  try {
    const value = Number(JSON.parse(localStorage.getItem(BUDGET_KEY)));
    return [60, 120, 180, 240].includes(value) ? value : 120;
  } catch { return 120; }
}

function hoursLabel(minutes) {
  const hours = Math.round(minutes / 60 * 10) / 10;
  return `${hours}h`;
}

function fmtDate(iso) {
  if (!iso) return "No date";
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

function classTitle(item, legend) {
  return item?.name || legend[item?.code]?.name || item?.code || "Scheduled session";
}

function urgencyLabel(task) {
  if (task.urgency === "overdue") return `${Math.abs(task.days)}d overdue`;
  if (task.urgency === "today") return "Due today";
  if (task.urgency === "soon") return `Due in ${task.days}d`;
  return task.dueDate ? fmtDate(task.dueDate) : "No due date";
}

function Empty({ title, copy }) {
  return <div className="planner-empty"><CheckCircle2 size={22} /><strong>{title}</strong><span>{copy}</span></div>;
}

function Metric({ label, value, detail, tone = "neutral" }) {
  return <div className={`planner-metric tone-${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function CapacityPanel({ week, budgetMinutes, setBudgetMinutes, onNavigate }) {
  const dailyCapacity = week.days.map((day) => Math.min(day.potentialMinutes, budgetMinutes));
  const capacity = dailyCapacity.reduce((sum, minutes) => sum + minutes, 0);
  const firstShortfall = week.days.find((_, index) =>
    week.days.slice(0, index + 1).reduce((sum, day) => sum + day.estimatedMinutes, 0) >
    dailyCapacity.slice(0, index + 1).reduce((sum, minutes) => sum + minutes, 0)
  );
  return (
    <section className="planner-card planner-capacity-card" aria-labelledby="planner-capacity-title">
      <div className="planner-card-head">
        <div><div className="planner-card-label">NEXT 7 DAYS</div><h2 id="planner-capacity-title">Work vs potential study time</h2></div>
        <button className="planner-text-btn" onClick={() => onNavigate("planner", "workload")}>Set task estimates</button>
      </div>
      <div className="planner-capacity-controls">
        <label>Daily study limit <select value={budgetMinutes} onChange={(event) => setBudgetMinutes(Number(event.target.value))}>
          <option value="60">1 hour</option><option value="120">2 hours</option><option value="180">3 hours</option><option value="240">4 hours</option>
        </select></label>
        <span>Timetable gaps of at least 1 hour, from 08:00AM to 10:00PM</span>
      </div>
      <div className="planner-capacity-summary">
        <div><strong>{hoursLabel(week.estimatedMinutes)}</strong><span>estimated work due</span></div>
        <div><strong>{hoursLabel(capacity)}</strong><span>potential study time</span></div>
        <div><strong>{week.dueCount}</strong><span>tasks due this week</span></div>
      </div>
      <div className="planner-capacity-track" aria-hidden="true"><span style={{ width: `${capacity ? Math.min(100, week.estimatedMinutes / capacity * 100) : 0}%` }} /></div>
      <p className={`planner-capacity-note${firstShortfall ? " is-short" : ""}`}>
        {week.unestimatedCount ? `${week.unestimatedCount} due task${week.unestimatedCount === 1 ? " needs" : "s need"} an effort estimate. ` : ""}
        {firstShortfall ? `Estimated work may exceed this study limit by ${fmtDate(firstShortfall.date)}.` : "Timetable gaps are possible study time; personal commitments are not included."}
      </p>
    </section>
  );
}

function BriefTab({ brief, legend, week, budgetMinutes, setBudgetMinutes, onNavigate, onOpenChange }) {
  const next = brief.nextClass;
  return (
    <div className="planner-grid planner-grid-brief">
      <CapacityPanel week={week} budgetMinutes={budgetMinutes} setBudgetMinutes={setBudgetMinutes} onNavigate={onNavigate} />
      <section className="planner-card planner-next-card">
        <div className="planner-card-label">NEXT UP</div>
        {next ? (
          <>
            <h2>{classTitle(next, legend)}</h2>
            <p>{fmtTime12(next.start)}–{fmtTime12(next.end)}{next.room ? ` · ${next.room}` : ""}</p>
            <div className="planner-card-actions">
              <button onClick={() => onNavigate("today")}>Open today <ArrowRight size={14} /></button>
              <span>{brief.classesLeft} class{brief.classesLeft === 1 ? "" : "es"} left today</span>
            </div>
          </>
        ) : <Empty title="No more classes today" copy={`${brief.tomorrowCount} class${brief.tomorrowCount === 1 ? "" : "es"} scheduled tomorrow.`} />}
      </section>

      <section className="planner-card">
        <div className="planner-card-head"><div><div className="planner-card-label">DEADLINES</div><h2>Needs attention</h2></div><button className="planner-text-btn" onClick={() => onNavigate("assignments")}>All tasks</button></div>
        {brief.tasks.length ? <div className="planner-list">{brief.tasks.map((task) => (
          <button key={`${task.code}-${task.id || task.title}`} className="planner-list-row" onClick={() => onNavigate("assignments")}>
            <span className={`planner-row-dot is-${task.urgency}`} />
            <span><strong>{task.title || "Untitled assignment"}</strong><small>{task.code} · {urgencyLabel(task)}</small></span>
            <ChevronRight size={15} />
          </button>
        ))}</div> : <Empty title="No urgent deadlines" copy="Nothing due in the next three days." />}
      </section>

      <section className="planner-card">
        <div className="planner-card-head"><div><div className="planner-card-label">ATTENDANCE</div><h2>Risk watch</h2></div><button className="planner-text-btn" onClick={() => onNavigate("attendance")}>Attendance</button></div>
        {brief.risks.length ? <div className="planner-list">{brief.risks.map((course) => (
          <button key={course.code} className="planner-list-row" onClick={() => onNavigate("planner", "forecast")}>
            <span className={`planner-score is-${course.risk}`}>{course.projectedPct ?? "—"}%</span>
            <span><strong>{course.code}</strong><small>{course.risk === "risk" ? `${course.recoveryNeeded} class${course.recoveryNeeded === 1 ? "" : "es"} to recover` : "Close to the threshold"}</small></span>
            <ChevronRight size={15} />
          </button>
        ))}</div> : <Empty title="No attendance warnings" copy={`Marked courses are at or above ${ATTENDANCE_TARGET}%.`} />}
      </section>

      <section className="planner-card">
        <div className="planner-card-head"><div><div className="planner-card-label">SCHEDULE</div><h2>Recent changes</h2></div><button className="planner-text-btn" onClick={() => onNavigate("notifications")}>All updates</button></div>
        {brief.changes.length ? <div className="planner-list">{brief.changes.map((change, index) => (
          <button key={change.id || `${change.ts}-${index}`} className="planner-list-row" onClick={() => onOpenChange(change)}>
            <span className={`planner-change-kind is-${change.kind || "update"}`}>{change.kind || "update"}</span>
            <span><strong>{change.code || fmtDate(change.date)}</strong><small>{change.text || "Schedule updated"}</small></span>
            <ChevronRight size={15} />
          </button>
        ))}</div> : <Empty title="No upcoming changes" copy="Your current schedule has no flagged updates." />}
      </section>
    </div>
  );
}

function ForecastTab({ forecast, setMisses }) {
  if (!forecast.length) return <Empty title="No attendance data" copy="Complete course setup to use forecasting." />;
  return (
    <div className="planner-stack">
      <div className="planner-callout"><CircleGauge size={20} /><div><strong>What-if simulator</strong><span>Adjust future misses below. This preview never changes your real attendance.</span></div></div>
      {forecast.map((course) => (
        <section className={`planner-card planner-forecast-row is-${course.risk}`} key={course.code}>
          <div className="planner-course-copy">
            <span className="planner-code">{course.code}</span>
            <div><h2>{course.name}</h2><p>{course.present}/{course.marked || 0} marked present · {course.upcoming} upcoming</p></div>
          </div>
          <div className="planner-forecast-values">
            <div><span>Now</span><strong>{course.currentPct == null ? "—" : `${course.currentPct}%`}</strong></div>
            <ArrowRight size={16} />
            <div><span>Projected</span><strong className="tf-motion-value" key={`${course.code}-${course.projectedPct}`}>{course.projectedPct == null ? "—" : `${course.projectedPct}%`}</strong></div>
          </div>
          <div className="planner-stepper" aria-label={`Planned future misses for ${course.code}`}>
            <button aria-label={`Decrease planned misses for ${course.code}`} disabled={!course.plannedMisses} onClick={() => setMisses(course.code, Math.max(0, course.plannedMisses - 1))}>−</button>
            <span><strong>{course.plannedMisses}</strong><small>planned misses</small></span>
            <button aria-label={`Increase planned misses for ${course.code}`} disabled={course.plannedMisses >= course.upcoming} onClick={() => setMisses(course.code, course.plannedMisses + 1)}>+</button>
          </div>
          <AttendanceScenarioChart course={course} />
          <div className="planner-forecast-note">
            {course.projectedPct == null ? "Mark at least one completed class to begin forecasting."
              : course.risk === "risk" ? `Attend the next ${course.recoveryNeeded} class${course.recoveryNeeded === 1 ? "" : "es"} to return to ${ATTENDANCE_TARGET}%.`
                : `${course.safeMisses} additional miss${course.safeMisses === 1 ? "" : "es"} currently fit above ${ATTENDANCE_TARGET}%.`}
          </div>
        </section>
      ))}
    </div>
  );
}

function AttendanceScenarioChart({ course }) {
  const scenario = buildAttendanceScenario(course);
  if (course.currentPct == null) return null;
  const rows = [
    ["Current", course.currentPct, "current"],
    [`Attend next ${scenario.count}`, scenario.count ? scenario.attendPct : null, "attend"],
    [`Miss next ${scenario.count}`, scenario.count ? scenario.missPct : null, "miss"],
  ];
  return (
    <div className="planner-scenario" aria-label={`${course.code} attendance scenarios, target ${ATTENDANCE_TARGET}%`}>
      <div className="planner-scenario-head"><strong>Next sessions at a glance</strong><span>{scenario.count ? `Comparing the next ${scenario.count} session${scenario.count === 1 ? "" : "s"}` : "Use + to compare outcomes"}</span></div>
      {rows.map(([label, value, tone]) => (
        <div className={`planner-scenario-row is-${tone}`} key={tone}>
          <span>{label}</span>
          <div className="planner-scenario-track" aria-hidden="true"><i style={{ width: `${value ?? 0}%` }} /><b style={{ left: `${ATTENDANCE_TARGET}%` }} /></div>
          <strong>{value == null ? "—" : `${value}%`}</strong>
        </div>
      ))}
      <small>Line marks the {ATTENDANCE_TARGET}% target. These are scenarios based on marked attendance.</small>
    </div>
  );
}

function WorkloadTab({ tasks, freeWindows, effort, setEffort, onNavigate }) {
  const open = tasks.filter((task) => !task.completed).sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999));
  const available = [...freeWindows];
  const suggestions = open.flatMap((task) => {
    const minutes = Number(effort[task.id]);
    if (!minutes) return [];
    const index = available.findIndex((slot) => slot.minutes >= minutes);
    if (index < 0) return [];
    const [slot] = available.splice(index, 1);
    return [{ task, slot, minutes }];
  }).slice(0, 5);
  return (
    <div className="planner-grid planner-grid-workload">
      <section className="planner-card">
        <div className="planner-card-head"><div><div className="planner-card-label">OPEN WORK</div><h2>Estimate your effort</h2></div><button className="planner-text-btn" onClick={() => onNavigate("assignments")}>Edit tasks</button></div>
        {open.length ? <div className="planner-list">{open.map((task) => (
          <div className="planner-task-estimate" key={`${task.code}-${task.id || task.title}`}>
            <div><strong>{task.title || "Untitled assignment"}</strong><small>{task.code} · {urgencyLabel(task)}</small></div>
            <label><span className="sr-only">Estimated effort for {task.title}</span><select value={effort[task.id] || ""} onChange={(event) => setEffort(task.id, event.target.value)}>
              <option value="">Set estimate</option><option value="30">30 min</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option><option value="180">3 hours</option>
            </select></label>
          </div>
        ))}</div> : <Empty title="Workload clear" copy="There are no open assignments." />}
      </section>
      <section className="planner-card">
        <div className="planner-card-label">SUGGESTED STUDY WINDOWS</div><h2>Your week, fitted around class</h2>
        {suggestions.length ? <div className="planner-list">{suggestions.map(({ task, slot, minutes }) => (
          <div className="planner-study-slot" key={`${task.code}-${task.id}-${slot.date}`}>
            <span><CalendarDays size={16} /></span><div><strong>{task.title}</strong><small>{fmtDate(slot.date)} · {minutesLabel(slot.start)}–{minutesLabel(slot.start + minutes)} · {minutes} min</small></div>
          </div>
        ))}</div> : <Empty title="Add effort estimates" copy="TermFlow will place estimated work into free timetable windows. Suggestions stay local to this device." />}
      </section>
    </div>
  );
}

function ChangesTab({ changes, readKeys, keyOf, onOpenChange, onOpenAll }) {
  return (
    <section className="planner-card planner-changes-card">
      <div className="planner-card-head"><div><div className="planner-card-label">SCHEDULE CHANGE CENTRE</div><h2>What changed</h2></div><button className="planner-text-btn" onClick={onOpenAll}>Notification controls</button></div>
      {changes.length ? <div className="planner-change-list">{changes.map((change, index) => {
        const unread = !readKeys?.has(keyOf(change));
        return <button key={change.id || `${change.ts}-${index}`} className={`planner-change-row${unread ? " is-unread" : ""}`} onClick={() => onOpenChange(change)}>
          <span className={`planner-change-icon is-${change.kind || "update"}`}><Workflow size={16} /></span>
          <span className="planner-change-copy"><span><strong>{change.code || "Schedule"}</strong>{unread && <i>New</i>}</span><small>{change.text || "Schedule information updated"}</small><em>{fmtDate(change.date)}{change.start ? ` · ${fmtTime12(change.start)}` : ""}</em></span>
          <ChevronRight size={16} />
        </button>;
      })}</div> : <Empty title="No schedule changes" copy="Updates that affect your enrolled courses will appear here." />}
    </section>
  );
}

function WeeklyLoadChart({ week }) {
  const maxMinutes = Math.max(60, ...week.days.map((day) => day.classMinutes));
  return (
    <section className="planner-card planner-week-card" aria-labelledby="planner-week-title">
      <div className="planner-card-label">COMING WEEK</div><h2 id="planner-week-title">Weekly load</h2>
      <p>Scheduled class and exam hours, with assignment deadlines on each day.</p>
      <div className="planner-week-chart">
        {week.days.map((day) => (
          <div className="planner-week-day" key={day.date}>
            <strong>{fmtDate(day.date).split(",")[0]}</strong>
            <div className="planner-week-track" aria-label={`${hoursLabel(day.classMinutes)} scheduled, ${day.dueCount} tasks due`}><span style={{ height: `${day.classMinutes ? Math.max(5, day.classMinutes / maxMinutes * 100) : 0}%` }} /></div>
            <span>{hoursLabel(day.classMinutes)}</span>
            <small>{day.dueCount ? `${day.dueCount} due` : "—"}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function InsightsTab({ insights, week }) {
  const busiest = week.days.reduce((max, day) => day.classMinutes > max.classMinutes ? day : max, week.days[0]);
  return (
    <div className="planner-stack">
      <div className="planner-metrics-grid">
        <Metric label="Average attendance" value={insights.averageAttendance == null ? "—" : `${insights.averageAttendance}%`} detail="Across marked courses" tone={insights.averageAttendance != null && insights.averageAttendance < ATTENDANCE_TARGET ? "risk" : "good"} />
        <Metric label="Assignment completion" value={insights.completionRate == null ? "—" : `${insights.completionRate}%`} detail={`${insights.completed} completed · ${insights.open} open`} tone="violet" />
        <Metric label="Due this week" value={insights.dueThisWeek} detail={`${insights.overdue} currently overdue`} tone={insights.overdue ? "risk" : "neutral"} />
        <Metric label="Busiest next 7 days" value={busiest.classMinutes ? fmtDate(busiest.date).split(",")[0] : "—"} detail={`${hoursLabel(busiest.classMinutes)} scheduled`} tone="blue" />
      </div>
      <WeeklyLoadChart week={week} />
      <div className="planner-callout"><Activity size={20} /><div><strong>Private by design</strong><span>These insights are calculated in your browser from your own timetable, assignments and attendance. They are not a leaderboard.</span></div></div>
    </div>
  );
}

export default function StudentPlanner({
  visible = [], today = [], tomorrow = [], now, attendance, enrolled, legend,
  changes = [], readChangeKeys, changeKeyOf, isOffline, syncing, syncedAgo,
  onSync, onNavigate, onOpenChange,
}) {
  const [tab, setTab] = useState("brief");
  const [assignments, setAssignments] = useState(() => loadAssignments());
  const [misses, setMissesState] = useState(() => loadObject(MISSES_KEY));
  const [effort, setEffortState] = useState(() => loadObject(EFFORT_KEY));
  const [budgetMinutes, setBudgetState] = useState(loadBudget);

  useEffect(() => {
    const refresh = () => setAssignments(loadAssignments());
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  const forecast = useMemo(() => buildAttendanceForecast({ allClasses: visible, enrolled, attendance, legend, now, plannedMisses: misses }), [visible, enrolled, attendance, legend, now, misses]);
  const brief = useMemo(() => buildDailyBrief({ today, tomorrow, assignments, changes, attendanceForecast: forecast, legend, now }), [today, tomorrow, assignments, changes, forecast, legend, now]);
  const tasks = useMemo(() => flattenAssignments(assignments, legend, now), [assignments, legend, now]);
  const freeWindows = useMemo(() => findFreeWindows(visible, now), [visible, now]);
  const insights = useMemo(() => buildPlannerInsights({ visible, assignments, attendanceForecast: forecast, now }), [visible, assignments, forecast, now]);
  const week = useMemo(() => buildWeeklyPlanner({ visible, assignments, effort, now }), [visible, assignments, effort, now]);

  const setMisses = (code, value) => setMissesState((current) => { const next = { ...current, [code]: value }; saveObject(MISSES_KEY, next); return next; });
  const setEffort = (id, value) => setEffortState((current) => { const next = { ...current, [id]: value }; saveObject(EFFORT_KEY, next); return next; });
  const setBudgetMinutes = (value) => { setBudgetState(value); saveObject(BUDGET_KEY, value); };
  const navigate = (view, plannerTab) => { if (plannerTab) setTab(plannerTab); else onNavigate(view); };
  const openChange = (change) => change?.date ? onOpenChange(change) : onNavigate("notifications");

  return (
    <div className="planner-page">
      <header className="planner-head">
        <div><span className="planner-kicker"><Sparkles size={14} /> PERSONAL PLANNER</span><h1>Your academic command centre</h1><p>Today’s priorities, attendance scenarios and workload—built from your existing TermFlow data.</p></div>
        <div className={`planner-live-pill${isOffline ? " is-offline" : ""}`}>{isOffline ? <CloudOff size={14} /> : <Cloud size={14} />}{isOffline ? "Offline" : `Synced ${syncedAgo === 0 ? "now" : `${syncedAgo}m ago`}`}</div>
      </header>
      <nav className="planner-tabs" aria-label="Planner sections">{TABS.map(([id, label, Icon]) => (
        <button key={id} className={tab === id ? "is-active" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}><Icon size={16} />{label}</button>
      ))}</nav>
      <div className="planner-content">
        {tab === "brief" && <BriefTab brief={brief} legend={legend} week={week} budgetMinutes={budgetMinutes} setBudgetMinutes={setBudgetMinutes} onNavigate={navigate} onOpenChange={openChange} />}
        {tab === "forecast" && <ForecastTab forecast={forecast} setMisses={setMisses} />}
        {tab === "workload" && <WorkloadTab tasks={tasks} freeWindows={freeWindows} effort={effort} setEffort={setEffort} onNavigate={navigate} />}
        {tab === "calendar" && <SmartCalendar enrolled={enrolled} />}
        {tab === "changes" && <ChangesTab changes={changes} readKeys={readChangeKeys} keyOf={changeKeyOf} onOpenChange={openChange} onOpenAll={() => onNavigate("notifications")} />}
        {tab === "sync" && <OfflineSyncCenter isOffline={isOffline} syncing={syncing} syncedAgo={syncedAgo} onSync={onSync} />}
        {tab === "insights" && <InsightsTab insights={insights} week={week} />}
      </div>
    </div>
  );
}

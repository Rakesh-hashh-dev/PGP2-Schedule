import { CalendarDays, CheckCircle2, Flame, GraduationCap, Sunrise, Trophy, UtensilsCrossed } from "lucide-react";
import { subjectClass } from "../../lib/subjectColors.js";

function compactHours(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function WeeklyLoadChart({ weeks, onSelectWeek }) {
  const width = 640;
  const height = 230;
  const plot = { left: 20, right: 620, top: 28, bottom: 184 };
  const max = Math.max(1, ...weeks.map((week) => week.hours));
  const points = weeks.map((week, index) => ({
    ...week,
    x: weeks.length === 1 ? width / 2 : plot.left + (index / (weeks.length - 1)) * (plot.right - plot.left),
    y: plot.bottom - (week.hours / max) * (plot.bottom - plot.top),
  }));
  const line = points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = points.length ? `${line} L${points[points.length - 1].x},${plot.bottom} L${points[0].x},${plot.bottom} Z` : "";
  const peak = [...points].sort((a, b) => b.hours - a.hours || b.sessions - a.sessions)[0];
  const labelEvery = Math.max(1, Math.ceil(weeks.length / 6));

  return (
    <svg className="wrapped-load-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="wrapped-load-title wrapped-load-desc">
      <title id="wrapped-load-title">Weekly classroom workload</title>
      <desc id="wrapped-load-desc">{weeks.map((week) => `${week.label}: ${compactHours(week.hours)} hours`).join(", ")}</desc>
      {[0, .5, 1].map((fraction) => {
        const y = plot.bottom - fraction * (plot.bottom - plot.top);
        return <line key={fraction} className="wrapped-chart-grid" x1={plot.left} x2={plot.right} y1={y} y2={y} />;
      })}
      {area && <path className="wrapped-load-area" d={area} />}
      {line && <path className="wrapped-load-line" d={line} />}
      {points.map((point) => (
        <g
          key={point.startISO}
          className={`wrapped-load-point${point === peak ? " is-peak" : ""}${onSelectWeek ? " is-interactive" : ""}`}
          tabIndex="0"
          role={onSelectWeek ? "button" : "img"}
          aria-label={`${point.label}, ${point.rangeLabel}: ${compactHours(point.hours)} hours across ${point.sessions} classes${onSelectWeek ? ". Open week details." : ""}`}
          onClick={onSelectWeek ? () => onSelectWeek(point) : undefined}
          onKeyDown={onSelectWeek ? (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelectWeek(point);
            }
          } : undefined}
        >
          {onSelectWeek && <circle className="wrapped-load-hit" cx={point.x} cy={point.y} r="17" />}
          <circle cx={point.x} cy={point.y} r={point === peak ? 5.5 : 4} />
          <title>{`${point.label}: ${compactHours(point.hours)} hours, ${point.sessions} classes`}</title>
        </g>
      ))}
      {peak && (
        <g className="wrapped-peak-label" aria-hidden="true">
          <text x={Math.max(54, Math.min(peak.x, width - 54))} y={Math.max(16, peak.y - 14)} textAnchor="middle">{compactHours(peak.hours)}h</text>
        </g>
      )}
      {points.map((point, index) => (index % labelEvery === 0 || index === points.length - 1) && (
        <text key={point.startISO} className="wrapped-chart-axis" x={point.x} y="214" textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}>{`W${point.index}`}</text>
      ))}
    </svg>
  );
}

export function CourseLoadBars({ courses, mostSkipped, onSelectCourse }) {
  const rows = courses.slice(0, 5);
  const max = Math.max(1, ...rows.map((course) => course.hours));
  return (
    <div className="wrapped-course-list" aria-label="Top courses by classroom hours">
      {rows.map((course) => (
        <button type="button" className="wrapped-course-row" key={course.code} onClick={() => onSelectCourse?.(course)}>
          <span className={`ses ${subjectClass(course.code)}`}>{course.code}</span>
          <span className="wrapped-course-track" aria-hidden="true">
            <span className="wrapped-course-fill" style={{ width: `${(course.hours / max) * 100}%` }} />
          </span>
          <span className="wrapped-course-hours">{compactHours(course.hours)}h</span>
          <span className="wrapped-course-name">{course.name}</span>
          <span className="wrapped-course-open" aria-hidden="true">View</span>
        </button>
      ))}
      {mostSkipped && (
        <p className="wrapped-panel-note">
          Most skipped: <span className={`ses ${subjectClass(mostSkipped.code)}`}>{mostSkipped.code}</span> · {mostSkipped.absent} session{mostSkipped.absent === 1 ? "" : "s"}.
        </p>
      )}
    </div>
  );
}

export function AttendanceDonut({ attendance, confidence }) {
  const total = Math.max(1, attendance.present + attendance.absent + attendance.unmarked);
  const presentEnd = (attendance.present / total) * 360;
  const absentEnd = presentEnd + (attendance.absent / total) * 360;
  const description = attendance.pct === null
    ? `No attendance marks yet. ${attendance.unmarked} completed sessions are unmarked.`
    : `${attendance.pct}% attendance among marked sessions. ${attendance.present} present, ${attendance.absent} skipped, and ${attendance.unmarked} unmarked.`;

  return (
    <div className="wrapped-attendance-layout">
      <div
        className="wrapped-donut"
        style={{ "--wrapped-present-end": `${presentEnd}deg`, "--wrapped-absent-end": `${absentEnd}deg` }}
        role="img"
        aria-label={description}
      >
        <div className="wrapped-donut-center">
          <strong>{attendance.pct === null ? "—" : `${attendance.pct}%`}</strong>
          <span>of marked</span>
        </div>
      </div>
      <div className="wrapped-attendance-legend">
        <div><span className="wrapped-legend-dot is-present" /><span>Present</span><strong>{attendance.present}</strong></div>
        <div><span className="wrapped-legend-dot is-absent" /><span>Skipped</span><strong>{attendance.absent}</strong></div>
        <div><span className="wrapped-legend-dot is-unmarked" /><span>Unmarked</span><strong>{attendance.unmarked}</strong></div>
      </div>
      <div className="wrapped-coverage">
        <div className="wrapped-coverage-copy"><span>Marking coverage</span><strong>{attendance.coveragePct}%</strong></div>
        <div className="wrapped-coverage-track" role="progressbar" aria-label="Attendance marking coverage" aria-valuemin="0" aria-valuemax="100" aria-valuenow={attendance.coveragePct}>
          <span style={{ width: `${attendance.coveragePct}%` }} />
        </div>
        {confidence && (
          <div className={`wrapped-confidence is-${confidence.level}`}>
            <span aria-hidden="true" />
            <div><strong>{confidence.label}</strong><p>{confidence.message}</p></div>
          </div>
        )}
      </div>
    </div>
  );
}

export function WeeklyRhythmHeatmap({ rhythm }) {
  return (
    <div>
      <div className="wrapped-heatmap" role="group" aria-label="Class density by weekday and time of day">
        <span aria-hidden="true" />
        {rhythm.dayLabels.map((day) => <span className="wrapped-heat-day" key={day}>{day.slice(0, 1)}</span>)}
        {rhythm.rows.flatMap((row) => [
          <span className="wrapped-heat-band" key={`${row.id}-label`}>{row.shortLabel}</span>,
          ...row.cells.map((cell) => {
            const level = cell.hours === 0 ? 0 : Math.max(1, Math.ceil(cell.intensity * 4));
            return (
              <span
                className={`wrapped-heat-cell level-${level}`}
                key={`${row.id}-${cell.day}`}
                role="img"
                aria-label={`${cell.day} ${row.label}: ${compactHours(cell.hours)} hours across ${cell.sessions} classes`}
                title={`${cell.day} ${row.label} · ${compactHours(cell.hours)}h · ${cell.sessions} classes`}
              />
            );
          }),
        ])}
      </div>
      {rhythm.busiest && (
        <p className="wrapped-panel-note">Your busiest recurring window was {rhythm.busiest.day} {rhythm.busiest.bandLabel.toLowerCase()}.</p>
      )}
    </div>
  );
}

export function MomentsTimeline({ stats }) {
  const moments = [
    stats.busiestDay ? { icon: Flame, title: "Heaviest day", value: `${stats.busiestDay.count} classes · ${stats.busiestDay.label}` } : null,
    stats.longestPresentStreak ? { icon: Trophy, title: "Confirmed attendance streak", value: `${stats.longestPresentStreak.count} marked-present classes in a row` } : null,
    stats.earliest ? { icon: Sunrise, title: "Earliest start", value: `${stats.earliest.time} · ${stats.earliest.count} time${stats.earliest.count === 1 ? "" : "s"}` } : null,
    stats.busiestWeek ? { icon: CalendarDays, title: "Peak week", value: `${compactHours(stats.busiestWeek.hours)} hours · ${stats.busiestWeek.rangeLabel}` } : null,
  ].filter(Boolean);

  return (
    <div className="wrapped-moments">
      {moments.map(({ icon: Icon, title, value }) => (
        <div className="wrapped-moment" key={title}>
          <span className="wrapped-moment-icon"><Icon size={16} aria-hidden="true" /></span>
          <div><strong>{title}</strong><span>{value}</span></div>
        </div>
      ))}
    </div>
  );
}

export function BeyondClassroom({ stats }) {
  const hasAssignments = stats.assignmentsTotal > 0;
  const dishCount = stats.likedDishes.length || stats.favouriteCount;
  if (!stats.examsTaken && !hasAssignments && !dishCount) return null;

  return (
    <section className="wrapped-panel wrapped-beyond">
      <div className="wrapped-panel-head">
        <div><h2>Beyond classroom hours</h2><p>The other pieces of your term that TermFlow could see.</p></div>
      </div>
      <div className="wrapped-beyond-grid">
        {stats.examsTaken > 0 && <div><GraduationCap size={18} aria-hidden="true" /><strong>{stats.examsTaken}</strong><span>exams faced</span></div>}
        {hasAssignments && <div><CheckCircle2 size={18} aria-hidden="true" /><strong>{stats.assignmentsDone}/{stats.assignmentsTotal}</strong><span>assignments completed</span></div>}
        {dishCount > 0 && <div><UtensilsCrossed size={18} aria-hidden="true" /><strong>{dishCount}</strong><span>mess picks you liked</span></div>}
      </div>
    </section>
  );
}

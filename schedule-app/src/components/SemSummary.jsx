import { useMemo } from "react";
import { sessionKey } from "../lib/attendance.js";

function clsEnd(c) {
  const [Y, Mo, D] = c.date.split("-").map(Number);
  const [h, m] = c.end.split(":").map(Number);
  return new Date(Y, Mo - 1, D, h, m);
}

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function SemSummary({ enrolled, legend, attendance, visible, todayISO, now, classes, onAttendanceClick }) {
  const totalCredits = useMemo(() => {
    if (!enrolled) return null;
    const sum = Object.keys(enrolled).reduce((acc, code) => {
      const n = parseFloat(legend[code]?.credits);
      return acc + (isNaN(n) ? 0 : n);
    }, 0);
    return sum > 0 ? sum : null;
  }, [enrolled, legend]);

  const { pct, present, total } = useMemo(() => {
    const past = visible.filter(c => c.type === "class" && clsEnd(c) <= now);
    const totalSes = past.length;
    if (!totalSes) return { pct: null, present: 0, total: 0 };
    const presentCount = past.filter(c => attendance[sessionKey(c)] === "present").length;
    return { pct: Math.round((presentCount / totalSes) * 100), present: presentCount, total: totalSes };
  }, [visible, now, attendance]);

  const upcomingExams = useMemo(() => {
    const in7 = ymd(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
    const codes = new Set(Object.keys(enrolled || {}));
    return classes.filter(c =>
      c.type === "exam" && c.date >= todayISO && c.date <= in7 && codes.has(c.code)
    ).length;
  }, [classes, todayISO, now, enrolled]);

  const sessionsLeft = useMemo(() => {
    return visible.filter(c => c.type === "class" && c.date >= todayISO && clsEnd(c) > now).length;
  }, [visible, todayISO, now]);

  const pctColor = pct === null ? "" : pct >= 80 ? "good" : pct >= 75 ? "warn" : "bad";

  if (!enrolled || Object.keys(enrolled).length === 0) return null;

  return (
    <div className="sem-summary">
      <button className={`sem-stat sem-stat-cta ${pctColor}`} onClick={onAttendanceClick}>
        <span className="sem-val">
          {pct === null ? "—" : `${pct}%`}
        </span>
        <span className="sem-label">Attendance{total > 0 ? ` · ${present}/${total}` : ""}</span>
      </button>

      <div className="sem-divider" />

      <div className="sem-stat">
        <span className="sem-val">{totalCredits ?? "—"}</span>
        <span className="sem-label">Credits</span>
      </div>

      <div className="sem-divider" />

      <div className={`sem-stat ${upcomingExams > 0 ? "warn" : ""}`}>
        <span className="sem-val">{upcomingExams === 0 ? "None" : upcomingExams}</span>
        <span className="sem-label">Exam{upcomingExams !== 1 ? "s" : ""} this week</span>
      </div>

      <div className="sem-divider" />

      <div className="sem-stat">
        <span className="sem-val">{sessionsLeft}</span>
        <span className="sem-label">Sessions left</span>
      </div>
    </div>
  );
}

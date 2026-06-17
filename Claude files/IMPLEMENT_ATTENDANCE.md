# Task: add an Attendance tracker page

Add a new **Attendance** view (a tab alongside Today / Tomorrow / Week) that shows how many
sessions the student has attended vs missed, a per-course breakdown, which sessions were
missed, and a quick way to mark past sessions present/absent.

How it works: the app already knows the student's exact sessions (their enrolled courses at
their chosen sections → `visible`). Attendance is **self-reported** — the student taps
present/absent on each past session, and the page computes everything from that. Marks are
saved in `localStorage` (per-device; a Clerk-metadata/Supabase upgrade can sync across devices
later).

Only **past** sessions count (a class whose end time is already behind `now`).

---

## 1. Create `src/lib/attendance.js`

```js
const ATT_KEY = "pgp2.attendance";

export function readAttendance() {
  try { return JSON.parse(localStorage.getItem(ATT_KEY)) || {}; } catch { return {}; }
}
export function saveAttendance(map) {
  try { localStorage.setItem(ATT_KEY, JSON.stringify(map)); } catch (e) {}
}
// Stable per-session id: date + course + section + slot
export function sessionKey(c) {
  return `${c.date}|${c.code}|${c.section}|${c.slot}`;
}
```

---

## 2. Create `src/components/Attendance.jsx`

Props: `visible` (the student's sessions), `now`, `legend`, `attendance` (the saved map),
`onMark(key, value)`.

```jsx
import { useMemo } from "react";
import { Check, X, Clock, MapPin, AlertTriangle } from "lucide-react";
import { sessionKey } from "../lib/attendance.js";

const THRESHOLD = 75; // % to flag a course as low (configurable)

function endDate(c) { const [Y, Mo, D] = c.date.split("-").map(Number); const [h, m] = c.end.split(":").map(Number); return new Date(Y, Mo - 1, D, h, m); }
function prettyDate(iso) { const [Y, M, D] = iso.split("-").map(Number); return new Date(Y, M - 1, D).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }); }
const tone = (p) => (p == null ? "none" : p >= THRESHOLD ? "good" : p >= 60 ? "warn" : "bad");

export default function Attendance({ visible, now, legend, attendance, onMark }) {
  const past = useMemo(
    () => visible
      .filter((c) => c.type === "class" && endDate(c) <= now)
      .sort((a, b) => (a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date))),
    [visible, now]
  );

  const stat = (list) => {
    let present = 0, absent = 0;
    list.forEach((c) => { const s = attendance[sessionKey(c)]; if (s === "present") present++; else if (s === "absent") absent++; });
    const unmarked = list.length - present - absent;
    const pct = present + absent ? Math.round((present / (present + absent)) * 100) : null;
    return { present, absent, unmarked, pct, total: list.length };
  };

  const overall = useMemo(() => stat(past), [past, attendance]);
  const byCourse = useMemo(() => {
    const codes = [...new Set(past.map((c) => c.code))];
    return codes
      .map((code) => ({ code, name: (legend[code] && legend[code].name) || code, ...stat(past.filter((c) => c.code === code)) }))
      .sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101));
  }, [past, attendance, legend]);

  const toMark = useMemo(() => past.filter((c) => !attendance[sessionKey(c)]).reverse(), [past, attendance]);
  const missed = useMemo(() => past.filter((c) => attendance[sessionKey(c)] === "absent").reverse(), [past, attendance]);

  if (past.length === 0) {
    return <div className="att"><div className="att-card"><div className="att-empty">No classes have happened yet — your attendance will appear here once the term starts.</div></div></div>;
  }

  return (
    <div className="att">
      <section className={`att-hero tone-${tone(overall.pct)}`}>
        <Ring pct={overall.pct ?? 0} tone={tone(overall.pct)} />
        <div className="att-hero-r">
          <div className="att-hero-label">Overall attendance</div>
          <div className="att-hero-line">
            <b>{overall.present}</b> attended <span className="att-d">·</span> <b>{overall.absent}</b> missed
            {overall.unmarked > 0 && <><span className="att-d">·</span> <b>{overall.unmarked}</b> to mark</>}
          </div>
          {overall.pct != null && overall.pct < THRESHOLD && (
            <div className="att-flag"><AlertTriangle size={13} /> Below the {THRESHOLD}% mark</div>
          )}
        </div>
      </section>

      <section className="att-card">
        <div className="att-card-h"><h2>By course</h2><span className="att-count">{byCourse.length}</span></div>
        {byCourse.map((c) => (
          <div key={c.code} className="att-row">
            <div className="att-row-top">
              <span className="att-k">{c.code}</span>
              <span className="att-name">{c.name}</span>
              <span className={`att-pct tone-${tone(c.pct)}`}>{c.pct == null ? "—" : c.pct + "%"}</span>
            </div>
            <div className="att-bar"><div className={`att-bar-fill tone-${tone(c.pct)}`} style={{ width: `${c.pct ?? 0}%` }} /></div>
            <div className="att-row-sub">{c.present}/{c.present + c.absent} attended{c.unmarked ? ` · ${c.unmarked} to mark` : ""}</div>
          </div>
        ))}
      </section>

      {toMark.length > 0 && (
        <section className="att-card">
          <div className="att-card-h"><h2>To mark</h2><span className="att-count">{toMark.length}</span></div>
          {toMark.map((c) => {
            const k = sessionKey(c);
            return (
              <div key={k} className="att-mark">
                <div className="att-mark-info">
                  <span className="att-k sm">{c.code}{c.session ? " " + c.session : ""}</span>
                  <span className="att-mark-name">{(legend[c.code] && legend[c.code].name) || c.code}</span>
                  <span className="att-mark-meta"><Clock size={11} /> {prettyDate(c.date)} · {c.start}</span>
                </div>
                <div className="att-btns">
                  <button className="att-b present" onClick={() => onMark(k, "present")} aria-label="Present"><Check size={16} /></button>
                  <button className="att-b absent" onClick={() => onMark(k, "absent")} aria-label="Absent"><X size={16} /></button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="att-card">
        <div className="att-card-h"><h2>Missed sessions</h2><span className="att-count">{missed.length}</span></div>
        {missed.length === 0 ? (
          <div className="att-empty">Nothing missed yet — keep it up.</div>
        ) : missed.map((c) => {
          const k = sessionKey(c);
          return (
            <div key={k} className="att-missed">
              <span className="att-mdot" />
              <span className="att-k sm">{c.code}{c.session ? " " + c.session : ""}</span>
              <span className="att-missed-name">{(legend[c.code] && legend[c.code].name) || c.code}</span>
              <span className="att-missed-meta">{prettyDate(c.date)} · {c.start}{c.room ? <> <MapPin size={11} /> {c.room}</> : null}</span>
              <button className="att-undo" onClick={() => onMark(k, "absent")}>undo</button>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function Ring({ pct, tone }) {
  const r = 34, C = 2 * Math.PI * r;
  const off = C * (1 - Math.max(0, Math.min(100, pct)) / 100);
  const col = tone === "good" ? "var(--live)" : tone === "warn" ? "#C9882B" : tone === "bad" ? "#C0392B" : "rgba(255,255,255,.3)";
  return (
    <svg className="att-ring" width="92" height="92" viewBox="0 0 92 92">
      <circle cx="46" cy="46" r={r} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="9" />
      <circle cx="46" cy="46" r={r} fill="none" stroke={col} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 46 46)" style={{ transition: "stroke-dashoffset .6s ease" }} />
      <text x="46" y="46" textAnchor="middle" dominantBaseline="central" className="att-ring-t">{pct}%</text>
    </svg>
  );
}
```

---

## 3. Wire into `src/App.jsx`

**3a. Imports:**
```jsx
import Attendance from "./components/Attendance.jsx";
import { readAttendance, saveAttendance } from "./lib/attendance.js";
import { ClipboardCheck } from "lucide-react"; // add to the existing lucide-react import
```

**3b. State + mark handler** (inside `AppCore`):
```jsx
const [attendance, setAttendance] = useState(() => readAttendance());

function markAttendance(key, value) {
  setAttendance((prev) => {
    const next = { ...prev };
    if (next[key] === value) delete next[key]; // tapping the same state again clears it
    else next[key] = value;
    saveAttendance(next);
    return next;
  });
}
```

**3c. Add the tab** in the `<nav className="tabs">` block, after the Week button:
```jsx
<button className={`tab ${view === "attendance" ? "on" : ""}`} onClick={() => setView("attendance")}>
  <ClipboardCheck size={15} /> Attendance
</button>
```

**3d. Render the view.** Replace the `Hero` + view switch:
```jsx
      <Hero current={current} next={next} now={now} todayISO={todayISO} />

      {view === "today"
        ? <Timeline list={todayList} current={current} now={now} />
        : view === "tomorrow"
        ? <Timeline list={tomorrowList} current={null} now={now} showNowLine={false} label="Tomorrow" />
        : <WeekAgenda visible={visible} now={now} offset={weekOffset} setOffset={setWeekOffset} todayISO={todayISO} />}
```
with:
```jsx
      {view === "attendance" ? (
        <Attendance visible={visible} now={now} legend={LEGEND} attendance={attendance} onMark={markAttendance} />
      ) : (
        <>
          <Hero current={current} next={next} now={now} todayISO={todayISO} />
          {view === "today"
            ? <Timeline list={todayList} current={current} now={now} />
            : view === "tomorrow"
            ? <Timeline list={tomorrowList} current={null} now={now} showNowLine={false} label="Tomorrow" />
            : <WeekAgenda visible={visible} now={now} offset={weekOffset} setOffset={setWeekOffset} todayISO={todayISO} />}
        </>
      )}
```

---

## 4. Append to `src/styles.css`

```css
/* ---------- Attendance ---------- */
.att{padding:4px 0 8px;}
.att-hero{display:flex;align-items:center;gap:20px;background:var(--ink);color:#fff;border-radius:18px;padding:20px 22px;box-shadow:0 18px 40px -24px rgba(21,24,43,.7);position:relative;overflow:hidden;}
.att-hero::after{content:"";position:absolute;inset:0;background:radial-gradient(120% 90% at 90% -10%,rgba(31,169,113,.16),transparent 55%);pointer-events:none;}
.tone-warn.att-hero::after{background:radial-gradient(120% 90% at 90% -10%,rgba(201,136,43,.18),transparent 55%);}
.tone-bad.att-hero::after{background:radial-gradient(120% 90% at 90% -10%,rgba(192,57,43,.20),transparent 55%);}
.att-ring{flex:none;}
.att-ring-t{font-family:var(--mono);font-weight:700;font-size:20px;fill:#fff;}
.att-hero-r{flex:1;}
.att-hero-label{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.6);font-weight:600;margin-bottom:6px;}
.att-hero-line{font-size:15px;color:rgba(255,255,255,.9);}
.att-hero-line b{font-family:var(--mono);font-weight:700;color:#fff;}
.att-d{opacity:.4;margin:0 4px;}
.att-flag{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#FFD9B0;background:rgba(201,136,43,.18);border-radius:7px;padding:5px 9px;margin-top:11px;}
.tone-bad .att-flag{color:#FFC7C0;background:rgba(192,57,43,.22);}
.att-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;margin-top:12px;}
.att-card-h{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px;}
.att-card-h h2{font-family:var(--display);font-weight:700;font-size:16px;margin:0;}
.att-count{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums;}
.att-empty{color:var(--muted);font-size:14px;padding:8px 2px;}
.att-row{padding:11px 0;border-top:1px solid var(--line);}
.att-row:first-of-type{border-top:none;}
.att-row-top{display:flex;align-items:center;gap:9px;}
.att-k{font-family:var(--mono);font-weight:700;font-size:11px;background:var(--ink);color:#fff;border-radius:6px;padding:3px 7px;flex:none;}
.att-k.sm{font-size:10.5px;padding:2px 6px;}
.att-name{flex:1;font-weight:500;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.att-pct{font-family:var(--mono);font-weight:700;font-size:14px;}
.att-pct.tone-good{color:var(--live);} .att-pct.tone-warn{color:#C9882B;} .att-pct.tone-bad{color:#C0392B;} .att-pct.tone-none{color:var(--muted);}
.att-bar{height:6px;border-radius:99px;background:#ECE9E0;margin:8px 0 6px;overflow:hidden;}
.att-bar-fill{height:100%;border-radius:99px;transition:width .5s ease;}
.att-bar-fill.tone-good{background:var(--live);} .att-bar-fill.tone-warn{background:#C9882B;} .att-bar-fill.tone-bad{background:#C0392B;} .att-bar-fill.tone-none{background:#ccc;}
.att-row-sub{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums;}
.att-mark{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--line);}
.att-mark:first-of-type{border-top:none;}
.att-mark-info{flex:1;display:flex;flex-direction:column;gap:3px;min-width:0;}
.att-mark-name{font-weight:500;font-size:13.5px;}
.att-mark-meta{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:var(--muted);font-family:var(--mono);}
.att-btns{display:flex;gap:7px;flex:none;}
.att-b{width:38px;height:38px;border-radius:10px;border:1.5px solid var(--line);background:var(--card);display:grid;place-items:center;cursor:pointer;color:var(--muted);transition:all .12s;}
.att-b.present:hover{border-color:var(--live);color:var(--live);background:rgba(31,169,113,.08);}
.att-b.absent:hover{border-color:#C0392B;color:#C0392B;background:rgba(192,57,43,.07);}
.att-missed{display:flex;align-items:center;gap:9px;padding:9px 0;border-top:1px solid var(--line);font-size:13px;}
.att-missed:first-of-type{border-top:none;}
.att-mdot{width:7px;height:7px;border-radius:50%;background:#C0392B;flex:none;}
.att-missed-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.att-missed-meta{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;color:var(--muted);font-family:var(--mono);white-space:nowrap;}
.att-undo{background:none;border:none;color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;text-decoration:underline;flex:none;}
@media (prefers-reduced-motion:reduce){.att-bar-fill,.att-ring circle{transition:none!important;}}
```

---

## Verify

- A new **Attendance** tab appears next to Week.
- It lists only sessions that have already ended; tapping ✓/✗ records present/absent, tapping
  the same one again clears it. The ring, the per-course bars and the missed list all update
  live, and the marks survive a page reload.
- Courses below 75% show amber/red and sort to the top of "By course" so they stand out.
- `THRESHOLD` in `Attendance.jsx` controls the flag level if your programme's minimum differs.

Note (data dependency): this relies on each class record having `date`, `start`, `end`,
`code`, `section`, `slot`, and ideally `session`/`room`/`name` (via `legend`) — which the
current parser already produces.

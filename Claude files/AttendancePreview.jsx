import React, { useState, useMemo } from "react";
import { Check, X, Clock, MapPin, AlertTriangle } from "lucide-react";

const THRESHOLD = 75; // minimum attendance % to flag (configurable)

// Sample past sessions for the preview. key = date|code|slot
const SESSIONS = [
  { key: "s1", code: "CS", name: "Corporate Strategy", date: "Mon 15 Jun", no: 1, time: "18:30", room: "A01", init: "present" },
  { key: "s2", code: "CS", name: "Corporate Strategy", date: "Mon 15 Jun", no: 2, time: "20:30", room: "A01", init: "present" },
  { key: "s3", code: "CS", name: "Corporate Strategy", date: "Wed 17 Jun", no: 3, time: "18:30", room: "A01", init: "absent" },
  { key: "s4", code: "CS", name: "Corporate Strategy", date: "Wed 17 Jun", no: 4, time: "20:30", room: "A01", init: "present" },
  { key: "s5", code: "SAPM", name: "Security Analysis & PM", date: "Mon 15 Jun", no: 1, time: "14:30", room: "A01", init: "present" },
  { key: "s6", code: "SAPM", name: "Security Analysis & PM", date: "Wed 17 Jun", no: 2, time: "16:30", room: "A01", init: "absent" },
  { key: "s7", code: "SAPM", name: "Security Analysis & PM", date: "Mon 22 Jun", no: 3, time: "16:30", room: "A01", init: "present" },
  { key: "s8", code: "SAPM", name: "Security Analysis & PM", date: "Wed 24 Jun", no: 4, time: "16:30", room: "A01", init: null },
  { key: "s9", code: "BAMD", name: "Business Analytics", date: "Wed 17 Jun", no: 1, time: "12:00", room: "A02", init: "present" },
  { key: "s10", code: "TCBA", name: "Tech Consulting & BA", date: "Mon 15 Jun", no: 1, time: "14:30", room: "A02", init: "present" },
  { key: "s11", code: "TCBA", name: "Tech Consulting & BA", date: "Wed 17 Jun", no: 2, time: "16:30", room: "A02", init: "absent" },
  { key: "s12", code: "PM", name: "Project Management", date: "Mon 22 Jun", no: 3, time: "10:00", room: "A02", init: "present" },
  { key: "s13", code: "PM", name: "Project Management", date: "Wed 24 Jun", no: 4, time: "10:00", room: "A02", init: null },
];

export default function AttendancePreview() {
  const [status, setStatus] = useState(() => Object.fromEntries(SESSIONS.filter((s) => s.init).map((s) => [s.key, s.init])));
  const mark = (key, val) => setStatus((m) => ({ ...m, [key]: m[key] === val ? undefined : val }));

  const stat = (list) => {
    const present = list.filter((s) => status[s.key] === "present").length;
    const absent = list.filter((s) => status[s.key] === "absent").length;
    const unmarked = list.length - present - absent;
    const pct = present + absent ? Math.round((present / (present + absent)) * 100) : null;
    return { present, absent, unmarked, pct, total: list.length };
  };

  const overall = useMemo(() => stat(SESSIONS), [status]);
  const byCourse = useMemo(() => {
    const codes = [...new Set(SESSIONS.map((s) => s.code))];
    return codes.map((code) => {
      const list = SESSIONS.filter((s) => s.code === code);
      return { code, name: list[0].name, ...stat(list) };
    }).sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101));
  }, [status]);

  const toMark = SESSIONS.filter((s) => !status[s.key]);
  const missed = SESSIONS.filter((s) => status[s.key] === "absent");
  const tone = (p) => (p == null ? "none" : p >= THRESHOLD ? "good" : p >= 60 ? "warn" : "bad");

  return (
    <div className="att">
      <style>{CSS}</style>
      <div className="att-head"><h1>Attendance</h1><span className="att-sub">Term so far</span></div>

      {/* summary */}
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

      {/* per course */}
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

      {/* to mark */}
      {toMark.length > 0 && (
        <section className="att-card">
          <div className="att-card-h"><h2>To mark</h2><span className="att-count">{toMark.length}</span></div>
          {toMark.map((s) => (
            <div key={s.key} className="att-mark">
              <div className="att-mark-info">
                <span className="att-k sm">{s.code} {s.no}</span>
                <span className="att-mark-name">{s.name}</span>
                <span className="att-mark-meta"><Clock size={11} /> {s.date} · {s.time}</span>
              </div>
              <div className="att-btns">
                <button className="att-b present" onClick={() => mark(s.key, "present")} aria-label="Present"><Check size={16} /></button>
                <button className="att-b absent" onClick={() => mark(s.key, "absent")} aria-label="Absent"><X size={16} /></button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* missed */}
      <section className="att-card">
        <div className="att-card-h"><h2>Missed sessions</h2><span className="att-count">{missed.length}</span></div>
        {missed.length === 0 ? (
          <div className="att-empty">Nothing missed yet — keep it up.</div>
        ) : missed.map((s) => (
          <div key={s.key} className="att-missed">
            <span className="att-mdot" />
            <span className="att-k sm">{s.code} {s.no}</span>
            <span className="att-missed-name">{s.name}</span>
            <span className="att-missed-meta">{s.date} · {s.time} <MapPin size={11} /> {s.room}</span>
            <button className="att-undo" onClick={() => mark(s.key, "absent")}>undo</button>
          </div>
        ))}
      </section>
    </div>
  );
}

function Ring({ pct, tone }) {
  const r = 34, C = 2 * Math.PI * r;
  const off = C * (1 - Math.max(0, Math.min(100, pct)) / 100);
  const col = tone === "good" ? "var(--live)" : tone === "warn" ? "var(--amber)" : tone === "bad" ? "#C0392B" : "rgba(255,255,255,.3)";
  return (
    <svg className="att-ring" width="92" height="92" viewBox="0 0 92 92">
      <circle cx="46" cy="46" r={r} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="9" />
      <circle cx="46" cy="46" r={r} fill="none" stroke={col} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 46 46)" style={{ transition: "stroke-dashoffset .6s ease" }} />
      <text x="46" y="46" textAnchor="middle" dominantBaseline="central" className="att-ring-t">{pct}%</text>
    </svg>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap');
:root{ --card:#FFFFFF; --card-hi:#F7F5EF; --muted:#6A6E7E; --live:#1FA971; --amber:#C9882B; --bad:#C0392B; --text:#1A1C2A; --ink:#15182B; --bone:#F3F1EA; --line:#E4E0D5;
  --display:'Bricolage Grotesque',system-ui,sans-serif; --body:'Inter',system-ui,sans-serif; --mono:'JetBrains Mono',ui-monospace,Menlo,monospace; }
*{box-sizing:border-box;}
.att{font-family:var(--body);background:var(--bone);color:var(--text);min-height:100vh;max-width:760px;margin:0 auto;padding:18px 16px 60px;-webkit-font-smoothing:antialiased;}
.att-head{display:flex;align-items:baseline;gap:10px;margin-bottom:14px;}
.att-head h1{font-family:var(--display);font-weight:800;font-size:24px;margin:0;letter-spacing:-.5px;}
.att-sub{font-size:13px;color:var(--muted);}
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
.att-pct.tone-good{color:var(--live);} .att-pct.tone-warn{color:var(--amber);} .att-pct.tone-bad{color:var(--bad);} .att-pct.tone-none{color:var(--muted);}
.att-bar{height:6px;border-radius:99px;background:#ECE9E0;margin:8px 0 6px;overflow:hidden;}
.att-bar-fill{height:100%;border-radius:99px;transition:width .5s ease;}
.att-bar-fill.tone-good{background:var(--live);} .att-bar-fill.tone-warn{background:var(--amber);} .att-bar-fill.tone-bad{background:var(--bad);} .att-bar-fill.tone-none{background:#ccc;}
.att-row-sub{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums;}

.att-mark{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--line);}
.att-mark:first-of-type{border-top:none;}
.att-mark-info{flex:1;display:flex;flex-direction:column;gap:3px;min-width:0;}
.att-mark-name{font-weight:500;font-size:13.5px;}
.att-mark-meta{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:var(--muted);font-family:var(--mono);}
.att-btns{display:flex;gap:7px;flex:none;}
.att-b{width:38px;height:38px;border-radius:10px;border:1.5px solid var(--line);background:var(--card);display:grid;place-items:center;cursor:pointer;color:var(--muted);transition:all .12s;}
.att-b.present:hover{border-color:var(--live);color:var(--live);background:rgba(31,169,113,.08);}
.att-b.absent:hover{border-color:var(--bad);color:var(--bad);background:rgba(192,57,43,.07);}

.att-missed{display:flex;align-items:center;gap:9px;padding:9px 0;border-top:1px solid var(--line);font-size:13px;}
.att-missed:first-of-type{border-top:none;}
.att-mdot{width:7px;height:7px;border-radius:50%;background:var(--bad);flex:none;}
.att-missed-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.att-missed-meta{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;color:var(--muted);font-family:var(--mono);white-space:nowrap;}
.att-undo{background:none;border:none;color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;text-decoration:underline;flex:none;}

@media (max-width:440px){ .att-missed-meta .att-room{display:none;} .att-name{font-size:13px;} }
@media (prefers-reduced-motion:reduce){ .att-bar-fill,.att-ring circle{transition:none!important;} }
`;

import { useMemo, useState } from "react";
import { Check, X, Clock, MapPin, AlertTriangle, ChevronDown } from "lucide-react";
import { sessionKey } from "../lib/attendance.js";
import WeatherWidget from "./WeatherWidget.jsx";

const THRESHOLD = 75;

function clsEnd(c) {
  const [Y, Mo, D] = c.date.split("-").map(Number);
  const [h, m] = c.end.split(":").map(Number);
  return new Date(Y, Mo - 1, D, h, m);
}

function fmtDate(iso) {
  const [Y, M, D] = iso.split("-").map(Number);
  return new Date(Y, M - 1, D).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

function tone(p) {
  if (p == null) return "none";
  if (p >= THRESHOLD) return "good";
  if (p >= 60) return "warn";
  return "bad";
}

function Ring({ pct, t, noData }) {
  const r = 34, C = 2 * Math.PI * r;
  const off = C * (1 - Math.max(0, Math.min(100, pct)) / 100);
  const col = t === "good" ? "var(--live)" : t === "warn" ? "var(--amber)" : t === "bad" ? "#C0392B" : "rgba(255,255,255,.25)";
  return (
    <svg className="att-ring" width="92" height="92" viewBox="0 0 92 92">
      <circle cx="46" cy="46" r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="9" />
      {!noData && (
        <circle cx="46" cy="46" r={r} fill="none" stroke={col} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 46 46)"
          style={{ transition: "stroke-dashoffset .6s ease" }} />
      )}
      <text x="46" y="46" textAnchor="middle" dominantBaseline="central" className="att-ring-t">
        {noData ? "—" : `${pct}%`}
      </text>
    </svg>
  );
}

function StatusDot({ status }) {
  return <span className={`att-sdot${status === "present" ? " att-sdot-p" : status === "absent" ? " att-sdot-a" : ""}`} />;
}

export default function AttendancePanel({ allClasses, now, attendance, enrolled, legend, markAttendance, weather, termNumber }) {
  const [expandedCode, setExpandedCode] = useState(null);
  const codes = Object.keys(enrolled || {});
  const allPast = useMemo(() => {
    if (!enrolled) return [];
    const out = [];
    for (const [code, section] of Object.entries(enrolled)) {
      const name = legend[code]?.name || code;
      allClasses
        .filter(c => c.type === "class" && c.code === code && (c.section === "Single" || c.section === section) && clsEnd(c) <= now)
        .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
        .forEach(c => out.push({ ...c, name, key: sessionKey(c) }));
    }
    return out;
  }, [allClasses, enrolled, legend, now]);

  const stat = (list) => {
    const present  = list.filter(s => attendance[s.key] === "present").length;
    const absent   = list.filter(s => attendance[s.key] === "absent").length;
    const unmarked = list.length - present - absent;
    const pct = (present + absent) > 0 ? Math.round((present / (present + absent)) * 100) : null;
    return { present, absent, unmarked, pct, total: list.length };
  };

  const overall = useMemo(() => stat(allPast), [allPast, attendance]);

  const byCourse = useMemo(() => {
    return codes.map(code => {
      const list = allPast.filter(s => s.code === code);
      return { code, name: legend[code]?.name || code, sessions: list, ...stat(list) };
    }).sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101));
  }, [allPast, attendance, codes]);

  const toMark = allPast.filter(s => !attendance[s.key]);
  const missed  = allPast.filter(s => attendance[s.key] === "absent");
  const noData  = allPast.length === 0;
  const overall_tone = tone(overall.pct);

  if (!codes.length)
    return (
      <div className="att-page">
        <div className="att-head"><h1>Attendance</h1></div>
        <div className="empty">No courses enrolled. Complete setup first.</div>
      </div>
    );

  function toggle(code) {
    setExpandedCode(prev => prev === code ? null : code);
  }

  return (
    <div className="att-page">
      <div className="att-head">
        <div className="att-head-left">
          <h1>Attendance</h1>
          <span className="att-sub">{termNumber ? `Term ${termNumber}` : "Term so far"}</span>
        </div>
        <WeatherWidget now={now} weather={weather} />
      </div>

      {/* ── Overall hero ── */}
      <section className={`att-hero tone-${overall_tone}`}>
        <Ring pct={overall.pct ?? 0} t={overall_tone} noData={noData} />
        <div className="att-hero-r">
          <div className="att-hero-label">Overall attendance</div>
          {noData ? (
            <div className="att-hero-line" style={{ opacity: .6 }}>No sessions logged yet</div>
          ) : (
            <div className="att-hero-line">
              <b>{overall.present}</b> attended
              <span className="att-d">·</span>
              <b>{overall.absent}</b> missed
              {overall.unmarked > 0 && (
                <><span className="att-d">·</span><b>{overall.unmarked}</b> to mark</>
              )}
            </div>
          )}
          {overall.pct != null && overall.pct < THRESHOLD && (
            <div className="att-flag"><AlertTriangle size={13} /> Below the {THRESHOLD}% mark</div>
          )}
        </div>
      </section>

      {/* ── By course ── */}
      <section className="att-card">
        <div className="att-card-h">
          <h2>By course</h2>
          <span className="att-count att-expand-hint">tap row to edit</span>
        </div>
        {noData ? (
          <div className="att-empty-msg">No past classes yet — check back once sessions end.</div>
        ) : (
          <div className="att-grid">
            {byCourse.map(c => {
              const t = tone(c.pct);
              const open = expandedCode === c.code;
              const canExpand = c.sessions.length > 0 && !!markAttendance;
              return (
            <div key={c.code} className={`att-row ar-${(Array.from(c.code).reduce((h, char) => h + char.charCodeAt(0), 0)) % 6}${open ? " att-row-open" : ""}`}>
              <button
                className="att-row-hd"
                onClick={() => canExpand && toggle(c.code)}
                disabled={!canExpand}
                aria-expanded={open}
                style={{ display: "flex", width: "100%", alignItems: "stretch", textAlign: "left" }}
              >
                <div className="ar-left">
                  <div className={`ar-pct tone-${t}`}>{c.pct == null ? "—" : c.pct + "%"}</div>
                  <div className="ar-code">{c.code}</div>
                </div>
                <div className="ar-body">
                  <div className="att-row-top">
                    <span className="att-name" style={{ fontSize: 14.5 }}>{c.name}</span>
                    {c.unmarked > 0 && (
                      <span className="att-unmarked-badge">{c.unmarked}</span>
                    )}
                    {canExpand && <ChevronDown size={14} className={`att-chev${open ? " open" : ""}`} />}
                  </div>
                  <div className="att-row-sub" style={{ marginTop: 2 }}>
                    {c.present}/{c.present + c.absent} attended
                    {c.unmarked > 0 ? <span className="att-sub-warn"> · {c.unmarked} to mark</span> : ""}
                    {` · ${c.total} total`}
                  </div>
                  <div className="att-bar" style={{ marginTop: 8, marginBottom: 0 }}>
                    {c.present > 0 && <div className="att-bar-p" style={{ width: `${(c.present / c.total * 100).toFixed(1)}%` }} />}
                    {c.absent  > 0 && <div className="att-bar-a" style={{ width: `${(c.absent  / c.total * 100).toFixed(1)}%` }} />}
                  </div>
                </div>
              </button>

              {open && (
                <div className="att-edit-list" style={{ padding: "0 14px 12px", borderTop: "none" }}>
                  <div className="att-spark">
                    {c.sessions.map((s, i) => {
                      const st = attendance[s.key] || null;
                      const label = st === "present" ? "Present" : st === "absent" ? "Absent" : "Unmarked";
                      return (
                        <span key={s.key} className="tb-wrap">
                          <span className={`att-sp${st === "present" ? " att-sp-p" : st === "absent" ? " att-sp-a" : ""}`} />
                          <span className="tooltip att-sp-tip" role="tooltip">{`Session ${s.session || i + 1} · ${label}\n${fmtDate(s.date)} · ${s.start}–${s.end}`}</span>
                        </span>
                      );
                    })}
                    <span className={`att-spark-pct att-pct tone-${t}`}>
                      {c.pct != null ? `${c.pct}%` : "—"}
                    </span>
                  </div>
                  {c.sessions.map((s, i) => {
                    const status = attendance[s.key] || null;
                    return (
                      <div key={s.key} className="att-edit-row">
                        <StatusDot status={status} />
                        <div className="att-edit-info">
                          <span className="att-edit-no">Session {s.session || i + 1}</span>
                          <span className="att-mark-meta">
                            <Clock size={11} /> {fmtDate(s.date)} · {s.start}–{s.end}
                          </span>
                        </div>
                        <div className="att-btns">
                          <button
                            className={`att-b present${status === "present" ? " active" : ""}`}
                            onClick={() => markAttendance(s, status === "present" ? null : "present")}
                            aria-label="Present"
                            title={status === "present" ? "Unmark" : "Mark present"}
                          >
                            <Check size={15} />
                          </button>
                          <button
                            className={`att-b absent${status === "absent" ? " active" : ""}`}
                            onClick={() => markAttendance(s, status === "absent" ? null : "absent")}
                            aria-label="Absent"
                            title={status === "absent" ? "Unmark" : "Mark absent"}
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
            })}
          </div>
        )}
      </section>

      {/* ── To mark ── */}
      {toMark.length > 0 && (
        <section className="att-card">
          <div className="att-card-h">
            <h2>To mark</h2>
            <span className="att-count att-count-urgent">{toMark.length} pending</span>
          </div>
          <div className="att-grid">
            {toMark.map(s => (
              <div key={s.key} className={`att-mark ar-${(Array.from(s.code).reduce((h, char) => h + char.charCodeAt(0), 0)) % 6}`}>
                <div className="ar-left">
                  <div className="ar-pct" style={{ fontSize: 13, lineHeight: 1.2 }}>{s.code}</div>
                  {s.session && <div className="ar-code" style={{ marginTop: 4 }}>S{s.session}</div>}
                </div>
                <div className="ar-body" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <div className="att-mark-info" style={{ paddingRight: 8 }}>
                    <span className="att-mark-name">{s.name}</span>
                    <span className="att-mark-meta" style={{ marginTop: 2 }}>
                      <Clock size={11} /> {fmtDate(s.date)} · {s.start}
                    </span>
                  </div>
                  <div className="att-btns">
                    <button className="att-b present" onClick={() => markAttendance(s, "present")} aria-label="Present">
                      <Check size={16} />
                    </button>
                    <button className="att-b absent" onClick={() => markAttendance(s, "absent")} aria-label="Absent">
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Missed sessions ── */}
      <section className="att-card">
        <div className="att-card-h">
          <h2>Missed sessions</h2>
          <span className="att-count">{missed.length}</span>
        </div>
        {missed.length === 0 ? (
          <div className="att-empty-msg">Nothing missed yet — keep it up.</div>
        ) : missed.map(s => (
          <div key={s.key} className="att-missed">
            <span className="att-mdot" />
            <span className="att-missed-label">MISSED</span>
            <span className="att-missed-name">
              <span className="att-missed-text">{s.name}</span>
              {s.session && (
                <span className={`ses ses-${(Array.from(s.code).reduce((h, char) => h + char.charCodeAt(0), 0)) % 6}`}>
                  {s.code} {s.session}
                </span>
              )}
            </span>
            <span className="att-missed-time">
              <span>{s.start}</span>
              <button className="att-b present att-b-sm" onClick={() => markAttendance(s, "present")} title="Mark as present" aria-label="Mark as present">
                <Check size={13} />
              </button>
              <button className="att-undo" onClick={() => markAttendance(s, null)}>unmark</button>
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}

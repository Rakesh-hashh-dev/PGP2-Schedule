import { useMemo, useState } from "react";
import { Check, X, Clock, AlertTriangle, ChevronDown, Flame } from "lucide-react";
import { sessionKey, courseSkipStats, isExamSession } from "../lib/attendance.js";
import { subjectClass } from "../lib/subjectColors.js";
import { EmptyState } from "./ui.jsx";
import { BookOpen, CalendarCheck2, PartyPopper } from "lucide-react";
import WeatherWidget from "./WeatherWidget.jsx";

const THRESHOLD = 80;

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

function Ring({ pct, t, noData, size = 92 }) {
  const r = size * 0.38, C = 2 * Math.PI * r;
  const off = C * (1 - Math.max(0, Math.min(100, pct)) / 100);
  const col = t === "good" ? "var(--live)" : t === "warn" ? "var(--amber)" : t === "bad" ? "#C0392B" : "rgba(255,255,255,.25)";
  const strokeW = size * 0.08;
  return (
    <svg className="att-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={strokeW} />
      {!noData && (
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={strokeW} strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={off} transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.23, 1, 0.32, 1)" }} />
      )}
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central" style={{ fill: "#ffffff", fontSize: size * 0.22, fontWeight: 800, letterSpacing: "-0.5px", fontVariantNumeric: "tabular-nums" }}>
        {noData ? "—" : `${pct}%`}
      </text>
    </svg>
  );
}

function StatusDot({ status }) {
  return <span className={`att-sdot${status === "present" ? " att-sdot-p" : status === "absent" ? " att-sdot-a" : ""}`} />;
}

function SparkTrend({ sessions, attendance }) {
  if (!sessions.length) return null;

  // Build running cumulative % after each session
  const points = [];
  let present = 0, marked = 0;
  sessions.forEach(s => {
    const st = attendance[s.key];
    if (st === "present") { present++; marked++; }
    else if (st === "absent") { marked++; }
    points.push(marked > 0 ? (present / marked) * 100 : null);
  });

  const W = 200, H = 30;
  const n = points.length;
  const validPts = points.map((p, i) => ({ p, i })).filter(v => v.p !== null);
  const svgPoints = validPts.map(({ p, i }) => {
    const x = n <= 1 ? W / 2 : (i / (n - 1)) * W;
    const y = H - 3 - (p / 100) * (H - 10);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  const last = validPts.length ? validPts[validPts.length - 1].p : null;
  const lineColor = last == null ? "rgba(255,255,255,.2)" : last >= 80 ? "var(--live)" : last >= 75 ? "var(--amber)" : "#C0392B";
  const t = last == null ? "none" : last >= 80 ? "good" : last >= 75 ? "warn" : "bad";
  const threshold80Y = H - 3 - (80 / 100) * (H - 10);

  return (
    <div className="att-spark-wrap">
      <div className="att-spark">
        {sessions.map((s, i) => {
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
          {last != null ? `${Math.round(last)}%` : "—"}
        </span>
      </div>
      {n >= 3 && svgPoints && (
        <svg className="att-trend-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" y1={threshold80Y.toFixed(1)} x2={W} y2={threshold80Y.toFixed(1)}
            stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="3,4" />
          <polyline points={svgPoints} fill="none" stroke={lineColor}
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
        </svg>
      )}
    </div>
  );
}

export default function AttendancePanel({ allClasses, now, attendance, enrolled, legend, markAttendance, weather, termNumber }) {
  const [expandedCode, setExpandedCode] = useState(null);
  const [showChart, setShowChart] = useState(false);
  const codes = Object.keys(enrolled || {});
  const allPast = useMemo(() => {
    if (!enrolled) return [];
    const out = [];
    for (const [code, section] of Object.entries(enrolled)) {
      const name = legend[code]?.name || code;
      allClasses
        .filter(c => c.type === "class" && !isExamSession(c) && c.code === code && (c.section === "Single" || c.section === section) && clsEnd(c) <= now)
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
      const section = enrolled[code];
      const rawCredit = legend[code]?.credits;
      const zeroCredit = rawCredit === "0" || rawCredit === 0;
      const budget = courseSkipStats(allClasses, code, section, attendance, { zeroCredit });

      const st = stat(list);
      return {
        code, name: legend[code]?.name || code, sessions: list,
        totalScheduled: budget.totalScheduled,
        totalAllowedSkips: budget.totalAllowedSkips,
        skipsRemaining: budget.skipsRemaining,
        penaltyHit: budget.penaltyHit,
        ...st,
      };
    }).sort((a, b) => {
      // Sort by penalty hit first, then skips remaining, then percentage
      if (a.penaltyHit !== b.penaltyHit) return a.penaltyHit ? -1 : 1;
      if (a.skipsRemaining !== b.skipsRemaining) return a.skipsRemaining - b.skipsRemaining;
      return (a.pct ?? 101) - (b.pct ?? 101);
    });
  }, [allPast, attendance, codes, allClasses, enrolled]);

  const overallSkipBudget = useMemo(() => {
    let allowed = 0;
    let absent = 0;
    let hasPenalty = false;
    byCourse.forEach(c => {
      if (c.totalAllowedSkips > 0) {
        allowed += c.totalAllowedSkips;
        absent += c.absent;
      }
      if (c.penaltyHit) hasPenalty = true;
    });
    return { allowed, absent, remaining: Math.max(0, allowed - absent), hasPenalty };
  }, [byCourse]);

  const toMark = allPast.filter(s => !attendance[s.key]);
  const missed  = allPast.filter(s => attendance[s.key] === "absent");
  const noData  = allPast.length === 0;
  const overall_tone = tone(overall.pct);

  if (!codes.length)
    return (
      <div className="att-page">
        <div className="att-head"><h1>Attendance</h1></div>
        <EmptyState icon={BookOpen} title="No courses enrolled" sub="Complete setup first — your attendance will show up here." />
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
          <span className="att-sub">{termNumber ? `Term ${["", "I", "II", "III", "IV", "V", "VI"][termNumber] || termNumber}` : "Term so far"}</span>
        </div>
        <WeatherWidget now={now} weather={weather} />
      </div>

      {/* ── Overall hero (tap to toggle subject-wise chart) ── */}
      <section
        className={`att-hero tone-${overall_tone}${noData ? "" : " att-hero-clickable"}${showChart ? " att-hero-open" : ""}`}
        onClick={noData ? undefined : () => setShowChart(s => !s)}
        role={noData ? undefined : "button"}
        tabIndex={noData ? undefined : 0}
        onKeyDown={noData ? undefined : (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShowChart(s => !s); } }}
        aria-expanded={noData ? undefined : showChart}
      >
        {!noData && (
          <span className="att-hero-hint" aria-hidden="true">
            <ChevronDown size={18} className="att-hero-chev" />
          </span>
        )}
        <div className="att-hero-bg-text">
          {termNumber ? ["", "I", "II", "III", "IV", "V", "VI"][termNumber] || termNumber : ""}
        </div>
        <div className="att-hero-ring">
          <Ring pct={overall.pct ?? 0} t={overall_tone} noData={noData} size={64} />
        </div>
        <div className="att-hero-r">
          <div className="att-hero-label">Overall Attendance</div>
          {noData ? (
            <div className="att-hero-line" style={{ opacity: .6 }}>No sessions logged yet</div>
          ) : (
            <>
              <div className="att-hero-big">
                <b>{overall.present}</b> attended
                <span className="att-d">·</span>
                <b>{overall.absent}</b> missed
              </div>
              <div className="att-hero-areas">
                {overall.unmarked > 0 && (
                  <span className="att-area-chip">
                    To mark: {overall.unmarked}
                  </span>
                )}
                {overallSkipBudget.hasPenalty ? (
                  <span className="att-area-chip att-area-chip-bad">
                    <AlertTriangle size={11} />
                    Grade Penalty Hit
                  </span>
                ) : overallSkipBudget.allowed > 0 ? (
                  <span className="att-area-chip att-area-chip-hi">
                    <Flame size={11} />
                    {overallSkipBudget.remaining} / {overallSkipBudget.allowed} skips left
                  </span>
                ) : null}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── Subject-wise chart (toggled by tapping the hero) ── */}
      {!noData && byCourse.length > 0 && showChart && (
        <section className="att-card att-chart-card att-chart-reveal">
          <div className="att-card-h">
            <h2>Subject-wise attendance</h2>
            <span className="att-count">{THRESHOLD}% required</span>
          </div>
          <div className="att-chart">
            <div className="att-chart-plot" style={{ gridTemplateColumns: `repeat(${byCourse.length}, 1fr)` }}>
              <div className="att-chart-threshold" style={{ bottom: `${THRESHOLD}%` }}>
                <span className="att-chart-threshold-lbl">{THRESHOLD}%</span>
              </div>
              {byCourse.map((c, i) => {
                const t = tone(c.pct);
                const noBar = c.pct == null;
                const targetH = noBar ? "3px" : `${Math.max(5, c.pct)}%`;
                const delay = `${i * 65}ms`;
                const marked = c.present + c.absent;
                return (
                  <div
                    key={c.code}
                    className={`att-chart-col${noBar ? " att-chart-col-empty" : ""}`}
                    style={{ "--i": i }}
                  >
                    <div
                      className={`att-chart-bar att-chart-${t}`}
                      style={{ "--barh": targetH, animationDelay: delay }}
                    >
                      <span className="att-chart-val" style={{ animationDelay: `calc(${delay} + 260ms)` }}>
                        {noBar ? "—" : `${c.pct}%`}
                      </span>
                    </div>
                    <div className={`att-ctip att-ctip-${noBar ? "none" : t}`} role="tooltip">
                      <div className="att-ctip-name">{c.name}</div>
                      {noBar ? (
                        <div className="att-ctip-empty">No sessions marked yet</div>
                      ) : (
                        <>
                          <div className="att-ctip-head">
                            <span className={`att-ctip-pct att-pct tone-${t}`}>{c.pct}%</span>
                            <span className="att-ctip-ratio">{c.present}/{marked} attended</span>
                          </div>
                          <div className="att-ctip-bar">
                            {c.present > 0 && <span className="att-ctip-bar-seg p" style={{ flexGrow: c.present }} />}
                            {c.absent > 0 && <span className="att-ctip-bar-seg a" style={{ flexGrow: c.absent }} />}
                            {c.unmarked > 0 && <span className="att-ctip-bar-seg u" style={{ flexGrow: c.unmarked }} />}
                          </div>
                          <div className="att-ctip-legend">
                            <span className="att-ctip-seg"><i className="att-ctip-dot p" />{c.present} present</span>
                            <span className="att-ctip-seg"><i className="att-ctip-dot a" />{c.absent} absent</span>
                            {c.unmarked > 0 && <span className="att-ctip-seg"><i className="att-ctip-dot u" />{c.unmarked} to mark</span>}
                          </div>
                          {c.totalScheduled > 0 && (
                            <div className="att-ctip-skips">
                              {c.penaltyHit
                                ? <><AlertTriangle size={11} /> Grade penalty hit</>
                                : <><Flame size={11} /> {c.skipsRemaining} skip{c.skipsRemaining === 1 ? "" : "s"} left</>}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="att-chart-xaxis" style={{ gridTemplateColumns: `repeat(${byCourse.length}, 1fr)` }}>
              {byCourse.map((c, i) => (
                <span key={c.code} className="att-chart-code" style={{ animationDelay: `calc(${i * 65}ms + 120ms)` }} title={c.name}>{c.code}</span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── By course ── */}
      <section className="att-card">
        <div className="att-card-h">
          <h2>By course</h2>
          <span className="att-count att-expand-hint">tap row to edit</span>
        </div>
        {noData ? (
          <EmptyState compact icon={CalendarCheck2} title="No past classes yet" sub="Check back once sessions end." />
        ) : (
          <div className="att-grid">
            {byCourse.map(c => {
              const t = tone(c.pct);
              const open = expandedCode === c.code;
              const canExpand = c.sessions.length > 0 && !!markAttendance;
              return (
            <div key={c.code} className={`att-row att-subj ${subjectClass(c.code)}${open ? " att-row-open" : ""}`}>
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
                    {c.totalScheduled > 0 && (
                      <span className={`att-skip-chip ${c.penaltyHit ? 'skip-critical' : c.skipsRemaining <= 1 ? 'skip-warn' : 'skip-safe'}`}>
                        {c.penaltyHit ? (
                          <><AlertTriangle size={10} /> Penalty Hit</>
                        ) : c.skipsRemaining <= 1 ? (
                          <><Flame size={10} /> {c.skipsRemaining} {c.skipsRemaining === 1 ? "skip" : "skips"} left</>
                        ) : (
                          <>{c.skipsRemaining} skips left</>
                        )}
                      </span>
                    )}
                    {canExpand && <ChevronDown size={14} className={`att-chev${open ? " open" : ""}`} />}
                  </div>
                  <div className="att-row-sub" style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', columnGap: 12, rowGap: 4 }}>
                    <span style={{ whiteSpace: 'nowrap' }}>{c.present}/{c.present + c.absent} attended</span>
                    <span style={{ opacity: 0.6, whiteSpace: 'nowrap' }}>{c.totalScheduled} total classes</span>
                  </div>
                  <div className="att-bar" style={{ marginTop: 8, marginBottom: 0 }}>
                    {c.present > 0 && <div className="att-bar-p" style={{ width: `${(c.present / c.total * 100).toFixed(1)}%` }} />}
                    {c.absent  > 0 && <div className="att-bar-a" style={{ width: `${(c.absent  / c.total * 100).toFixed(1)}%` }} />}
                  </div>
                </div>
              </button>

              <div className={`att-collapse${open ? " open" : ""}`} inert={open ? undefined : true} aria-hidden={!open}>
                <div className="att-collapse-in">
                <div className="att-edit-list">
                  <SparkTrend sessions={c.sessions} attendance={attendance} />
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
                </div>
              </div>
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
              <div key={s.key} className={`att-mark att-subj ${subjectClass(s.code)}`}>
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
          <EmptyState compact icon={PartyPopper} title="Nothing missed yet" sub="Keep it up." />
        ) : missed.map(s => (
          <div key={s.key} className="att-missed">
            <span className="att-mdot" />
            <span className="att-missed-label">MISSED</span>
            <span className="att-missed-name">
              <span className="att-missed-text">{s.name}</span>
              {s.session && (
                <span className={`ses ${subjectClass(s.code)}`}>
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

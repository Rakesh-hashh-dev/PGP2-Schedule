import { useMemo, useState, useRef, useEffect } from "react";
import {
  CalendarOff, ArrowLeft, AlertTriangle, TrendingDown, Clock,
  MapPin, CalendarCheck2, PartyPopper, ChevronRight, ArrowRight, Check,
  ChevronDown, ChevronUp, CalendarRange, CalendarCheck, Flame,
  Copy, ShieldCheck, AlertCircle, Users, X,
} from "lucide-react";
import { sessionKey, courseSkipStats, isExamSession } from "../lib/attendance.js";
import { loadMyAway, setMyAway, fmtAwayEnd } from "../lib/status.js";
import { subjectClass } from "../lib/subjectColors.js";
import { EmptyState } from "./ui.jsx";

const THRESHOLD = 80;

const prefersReducedMotion = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// Small count-up for the summary headline; snaps instantly if motion is reduced.
function useCountUp(target, ms = 550) {
  const [n, setN] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    const from = prev.current;
    prev.current = target;
    if (from === target || prefersReducedMotion()) { setN(target); return; }
    let raf;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return n;
}

function parseISO(iso) {
  const [Y, M, D] = iso.split("-").map(Number);
  return new Date(Y, M - 1, D);
}
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function clsStart(c) {
  const [Y, Mo, D] = c.date.split("-").map(Number);
  const [h, m] = c.start.split(":").map(Number);
  return new Date(Y, Mo - 1, D, h, m);
}
function fmtFull(iso) {
  return parseISO(iso).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
}
function fmtShort(iso) {
  return parseISO(iso).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}
function fmtTime(t) {
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ap}`;
}
function dayDiff(fromISO, toISO) {
  return Math.round((parseISO(toISO) - parseISO(fromISO)) / 86400000) + 1;
}
function durHours(c) {
  const [sh, sm] = c.start.split(":").map(Number);
  const [eh, em] = c.end.split(":").map(Number);
  return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
}

export default function LeavePlanner({ allClasses, enrolled, legend, attendance, now, termStart, termEnd, onBack, onOpenAttendance, userId, awayEnabled = true, onAwayChange }) {
  const todayISO = ymd(now);
  const minDate = termStart && termStart > todayISO ? termStart : todayISO;
  const maxDate = termEnd || undefined;

  // Applied range drives all the results; the draft range is what the pickers
  // edit until the user taps Apply. Nothing is applied until the first Apply.
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [draftFrom, setDraftFrom] = useState(minDate);
  const [draftTo, setDraftTo] = useState(minDate);
  const applied = from !== null;

  // Editing "from" never leaves "to" earlier than it.
  const editFrom = (v) => {
    setDraftFrom(v);
    if (v > draftTo) setDraftTo(v);
  };
  // Quick chips set a span of N days starting at the current "from".
  const setSpan = (nDays) => {
    const d = parseISO(draftFrom);
    d.setDate(d.getDate() + nDays - 1);
    const end = maxDate && ymd(d) > maxDate ? maxDate : ymd(d);
    setDraftTo(end);
  };
  const dirty = !applied || draftFrom !== from || draftTo !== to;
  const apply = () => { setFrom(draftFrom); setTo(draftTo); };
  const draftDays = dayDiff(draftFrom, draftTo);

  const codes = Object.keys(enrolled || {});

  // Away sharing (social plan Phase E) — strictly opt-in: nothing is published
  // until the user taps Share; friends then see an "Away till …" chip instead
  // of free/busy on the Social page while the window is current.
  const [sharedAway, setSharedAway] = useState(() => loadMyAway());
  const [shareBusy, setShareBusy] = useState(false);
  const stopSharingAway = async () => {
    if (shareBusy) return;
    setShareBusy(true);
    await setMyAway(userId, null);
    setSharedAway(null);
    onAwayChange?.(null);
    setShareBusy(false);
  };
  // "Book Leave" — the one-tap version: applies the drafted dates (so the
  // impact preview below reflects it) and marks the window on leave in the
  // same action, using the draft values directly rather than waiting on
  // `from`/`to` state so there's no race with the Apply click.
  const isBooked = sharedAway && sharedAway.from === draftFrom && sharedAway.to === draftTo;
  const bookLeave = async () => {
    if (shareBusy) return;
    setFrom(draftFrom); setTo(draftTo);
    setShareBusy(true);
    await setMyAway(userId, { from: draftFrom, to: draftTo });
    setSharedAway({ from: draftFrom, to: draftTo });
    onAwayChange?.({ from: draftFrom, to: draftTo });
    setShareBusy(false);
  };

  // Every enrolled, attendance-counting session that falls inside the leave window.
  const missed = useMemo(() => {
    if (!enrolled || !from) return [];
    return allClasses
      .filter(c =>
        c.type === "class" && !isExamSession(c) && enrolled[c.code] !== undefined &&
        (c.section === "Single" || c.section === "All" || c.section === enrolled[c.code]) &&
        c.date >= from && c.date <= to
      )
      .sort((a, b) => clsStart(a) - clsStart(b));
  }, [allClasses, enrolled, from, to]);

  // Per-course impact: current standing vs. standing after this leave.
  const impact = useMemo(() => {
    const byCode = {};
    missed.forEach(c => { (byCode[c.code] = byCode[c.code] || []).push(c); });
    return Object.entries(byCode).map(([code, list]) => {
      const section = enrolled[code];
      const rawCredit = legend[code]?.credits;
      const zeroCredit = rawCredit === "0" || rawCredit === 0;
      const b = courseSkipStats(allClasses, code, section, attendance, { zeroCredit, credits: rawCredit });
      const missCount = list.length;
      const projAbsent = b.absent + missCount;
      const projSkipsRemaining = Math.max(0, b.totalAllowedSkips - projAbsent);
      const markedAfter = b.present + projAbsent;
      const projPct = markedAfter > 0 ? Math.round((b.present / markedAfter) * 100) : null;
      const breach = projAbsent > b.totalAllowedSkips;
      // "Getting tight" scales with the budget: ≤1 left on a 2-skip
      // (1.5-credit) course, ≤2 left on a 4-skip (3-credit) course.
      const warnAt = Math.max(1, Math.floor(b.totalAllowedSkips / 2));
      const verdict = breach
        ? { tone: "bad", label: "Over limit" }
        : projSkipsRemaining <= warnAt
          ? { tone: "warn", label: "Getting tight" }
          : { tone: "ok", label: "Comfortable" };
      return {
        code, name: legend[code]?.name || code, missCount,
        pct: b.pct, projPct,
        skipsRemaining: b.skipsRemaining, projSkipsRemaining,
        totalAllowedSkips: b.totalAllowedSkips, breach, verdict,
      };
    }).sort((a, b) => (b.breach - a.breach) || (a.projSkipsRemaining - b.projSkipsRemaining));
  }, [missed, allClasses, enrolled, legend, attendance]);

  // First handful of classes waiting once you're back.
  const upcoming = useMemo(() => {
    if (!enrolled || !to) return [];
    return allClasses
      .filter(c =>
        c.type === "class" && !isExamSession(c) && enrolled[c.code] !== undefined &&
        (c.section === "Single" || c.section === "All" || c.section === enrolled[c.code]) &&
        c.date > to
      )
      .sort((a, b) => clsStart(a) - clsStart(b))
      .slice(0, 6);
  }, [allClasses, enrolled, to]);

  // Group the missed sessions by date for the timeline.
  const missedByDay = useMemo(() => {
    const m = new Map();
    missed.forEach(c => { if (!m.has(c.date)) m.set(c.date, []); m.get(c.date).push(c); });
    return [...m.entries()];
  }, [missed]);

  const days = applied ? dayDiff(from, to) : 0;
  const anyBreach = impact.some(i => i.breach);
  const breachCount = impact.filter(i => i.breach).length;
  const totalHours = missed.reduce((s, c) => s + durHours(c), 0);

  // Short label describing the applied range, à la "TODAY" / "THIS WEEK".
  const rangeLabel = useMemo(() => {
    if (!from) return "";
    if (from === to) return from === todayISO ? "Today" : "1 day";
    if (days === 7) return "This week";
    return `${days} days`;
  }, [from, to, days, todayISO]);

  const rangeStr = useMemo(() => {
    if (!from) return "";
    const opt = { day: "numeric", month: "short" };
    if (from === to) return parseISO(from).toLocaleDateString([], opt);
    return `${parseISO(from).toLocaleDateString([], opt)} – ${parseISO(to).toLocaleDateString([], opt)}`;
  }, [from, to]);

  // One column per day in the window (capped) — drives the bar chart, mirroring
  // the Week view's WeekGlance card.
  const summary = useMemo(() => {
    if (!from) return { cols: [], maxCount: 0, busiestIdx: -1, activeDays: 0, multiWeek: false };
    const cols = [];
    const end = parseISO(to);
    const MAX = 21;
    for (let d = parseISO(from), i = 0; d <= end && i < MAX; d.setDate(d.getDate() + 1), i++) {
      const iso = ymd(d);
      cols.push({
        iso,
        count: missed.filter(c => c.date === iso).length,
        dow: d.toLocaleDateString([], { weekday: "short" }),
        dom: d.getDate(),
        isToday: iso === todayISO,
      });
    }
    const maxCount = Math.max(0, ...cols.map(c => c.count));
    return {
      cols,
      maxCount,
      busiestIdx: maxCount > 0 ? cols.findIndex(c => c.count === maxCount) : -1,
      activeDays: cols.filter(c => c.count > 0).length,
      multiWeek: cols.length > 7,
    };
  }, [missed, from, to, todayISO]);

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("lp-summary-collapsed") === "1");
  const toggleSummary = () => setCollapsed(c => {
    try { localStorage.setItem("lp-summary-collapsed", c ? "0" : "1"); } catch { /* private mode */ }
    return !c;
  });

  const hoursTxt = totalHours > 0 ? ` · ~${totalHours % 1 ? totalHours.toFixed(1) : totalHours}h` : "";
  const missedCount = useCountUp(missed.length);

  // ── Copy a plain-text plan for pasting into a leave mail / WhatsApp ──
  const [copied, setCopied] = useState(false);
  const copySummary = async () => {
    const L = [`Leave plan · ${rangeStr}${from !== to ? ` (${days} days)` : ""}`];
    if (missed.length === 0) {
      L.push("No classes fall in this window.");
    } else {
      L.push(`Missing ${missed.length} class${missed.length !== 1 ? "es" : ""} across ${impact.length} course${impact.length !== 1 ? "s" : ""}.`);
      if (anyBreach) L.push(`⚠ Over skip limit in: ${impact.filter(i => i.breach).map(i => i.code).join(", ")}`);
      L.push("");
      missedByDay.forEach(([date, list]) => {
        L.push(fmtFull(date));
        list.forEach(c => L.push(`  • ${c.code} ${fmtTime(c.start)}–${fmtTime(c.end)}${c.room ? ` · ${c.room}` : ""}`));
      });
      L.push("");
      L.push(`Back on ${fmtFull(to)}.`);
    }
    try {
      await navigator.clipboard.writeText(L.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked */ }
  };

  // ── Sticky mini-summary once the real summary card scrolls off (mobile) ──
  const summaryRef = useRef(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = summaryRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => setStuck(!e.isIntersecting && e.boundingClientRect.top < 0),
      { threshold: 0, rootMargin: "-64px 0px 0px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [collapsed, missed.length]);
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });

  if (!codes.length) {
    return (
      <div className="lp-page">
        <div className="lp-head">
          {onBack && <button className="lp-back" onClick={onBack} aria-label="Back"><ArrowLeft size={16} /></button>}
          <div className="lp-head-txt"><h1>Leave Planner</h1></div>
        </div>
        <EmptyState icon={CalendarOff} title="No courses enrolled" sub="Complete setup first — then plan your leave here." />
      </div>
    );
  }

  return (
    <div className="lp-page">
      <div className="lp-head">
        {onBack && <button className="lp-back" onClick={onBack} aria-label="Back"><ArrowLeft size={16} /></button>}
        <div className="lp-head-txt">
          <h1>Leave Planner</h1>
          <span className="lp-sub">See what you&rsquo;ll miss before you go</span>
        </div>
        {applied && (
          <button className={`lp-copy${copied ? " is-done" : ""}`} onClick={copySummary}
            aria-label="Copy leave summary to clipboard">
            {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
          </button>
        )}
      </div>

      {/* ── Date range picker ── */}
      <section className="lp-picker">
        <div className="lp-dates">
          <div className="lp-field">
            <label htmlFor="lp-from">Leave from</label>
            <input id="lp-from" type="date" value={draftFrom} min={minDate} max={maxDate}
              onChange={e => e.target.value && editFrom(e.target.value)} />
          </div>
          <ArrowRight size={16} className="lp-dates-arrow" aria-hidden="true" />
          <div className="lp-field">
            <label htmlFor="lp-to">Back on</label>
            <input id="lp-to" type="date" value={draftTo} min={draftFrom} max={maxDate}
              onChange={e => e.target.value && setDraftTo(e.target.value)} />
          </div>
        </div>
        <div className="lp-picker-row">
          <div className="lp-quick" role="group" aria-label="Quick durations">
            <button className={draftDays === 1 ? "on" : ""} onClick={() => setSpan(1)}>1 day</button>
            <button className={draftDays === 3 ? "on" : ""} onClick={() => setSpan(3)}>3 days</button>
            <button className={draftDays === 7 ? "on" : ""} onClick={() => setSpan(7)}>1 week</button>
          </div>
          <div className="lp-picker-actions">
            <button className="lp-apply" onClick={apply} disabled={!dirty}>
              <Check size={15} /> {dirty ? "Apply" : "Applied"}
            </button>
            {awayEnabled && userId && (
              <button
                className={`lp-book${isBooked ? " is-done" : ""}`}
                onClick={isBooked ? stopSharingAway : bookLeave}
                disabled={shareBusy}
                title={isBooked ? "You're marked on leave for these dates — tap to cancel" : "Mark these dates as leave — visible to you and your friends"}
              >
                {shareBusy
                  ? "Booking…"
                  : isBooked
                    ? <><CalendarOff size={15} /> On leave</>
                    : <><CalendarOff size={15} /> Book leave</>}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Confirmation once a leave window is booked ── */}
      {awayEnabled && userId && sharedAway && (
        <div className="lp-share-row">
          <span className="lp-share-on">
            <Users size={13} /> You and your friends can see you&rsquo;re away till {fmtAwayEnd(sharedAway.to)}
          </span>
          <button className="lp-share-btn" onClick={stopSharingAway} disabled={shareBusy}>
            <X size={13} /> Cancel leave
          </button>
        </div>
      )}

      {!applied ? (
        <EmptyState icon={CalendarRange} title="Plan your leave"
          sub="Pick your dates above and tap Apply to see what you&rsquo;d miss." />
      ) : (
      <>
      {/* ── Summary card — same collapse/expand behaviour as the Week view ── */}
      {(() => {
        const interactive = {
          role: "button",
          tabIndex: 0,
          "aria-expanded": !collapsed,
          "aria-label": `Leave summary, tap to ${collapsed ? "expand" : "collapse"}`,
          onClick: toggleSummary,
          onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSummary(); } },
        };
        if (collapsed) {
          return (
            <section ref={summaryRef} className={`wglance is-collapsed${anyBreach ? " lp-glance-bad" : ""}`} {...interactive}>
              <div className="wglance-mini">
                <div className="wglance-tag"><CalendarRange size={13} /> {rangeLabel}</div>
                <span className="wglance-mini-sum">
                  <strong>{missed.length}</strong> {missed.length === 1 ? "class" : "classes"}{hoursTxt}
                </span>
                <div className="wglance-mini-bars" aria-hidden="true">
                  {summary.cols.map((c, i) => (
                    <span
                      key={i}
                      className={`wglance-mini-bar${c.isToday ? " is-today" : ""}${c.count === 0 ? " is-empty" : ""}`}
                      style={{ height: summary.maxCount > 0 && c.count > 0 ? `${Math.max(30, (c.count / summary.maxCount) * 100)}%` : "18%" }}
                    />
                  ))}
                </div>
                {anyBreach && <AlertTriangle size={14} className="lp-glance-warn" />}
                <ChevronDown size={15} className="wglance-chev" />
              </div>
            </section>
          );
        }
        return (
          <section ref={summaryRef} className={`wglance is-collapsible${anyBreach ? " lp-glance-bad" : ""}`} {...interactive}>
            <div className="wglance-top">
              <div className="wglance-tag"><CalendarRange size={13} /> {rangeLabel}</div>
              <span className="wglance-range">
                {rangeStr}
                <ChevronDown size={15} className="wglance-chev is-open" />
              </span>
            </div>

            <div className="wglance-head-row">
              <h1 className="wglance-head">
                {missedCount}<span className="wglance-head-unit">{missed.length === 1 ? "class" : "classes"}</span>
              </h1>
              <div className="wglance-facts">
                <span className="wglance-fact"><CalendarCheck size={13} />{summary.activeDays} day{summary.activeDays !== 1 ? "s" : ""}</span>
                {totalHours > 0 && <span className="wglance-fact"><Clock size={13} />~{totalHours % 1 ? totalHours.toFixed(1) : totalHours}h</span>}
              </div>
            </div>

            <div className="wglance-bars" role="img" aria-label={`Classes per day: ${summary.cols.map(c => `${c.dow} ${c.count}`).join(", ")}`}>
              {summary.cols.map((c, i) => {
                const h = summary.maxCount > 0 ? Math.round((c.count / summary.maxCount) * 100) : 0;
                const isBusiest = i === summary.busiestIdx && c.count > 0;
                return (
                  <div key={i} className={`wglance-col${c.isToday ? " is-today" : ""}`}>
                    <div className="wglance-bar-track">
                      <div
                        className={`wglance-bar${isBusiest ? " is-busiest" : ""}${c.count === 0 ? " is-empty" : ""}`}
                        style={{ height: c.count === 0 ? "3px" : `${Math.max(14, h)}%` }}
                      >
                        {c.count > 0 && <span className="wglance-bar-n">{c.count}</span>}
                      </div>
                    </div>
                    <span className="wglance-dow">{summary.multiWeek ? c.dom : c.dow}</span>
                  </div>
                );
              })}
            </div>

            <div className="wglance-foot">
              {summary.busiestIdx >= 0 && (
                <span className="wglance-foot-item">
                  <Flame size={13} /> Busiest <strong>{summary.multiWeek ? `${summary.cols[summary.busiestIdx].dow} ${summary.cols[summary.busiestIdx].dom}` : summary.cols[summary.busiestIdx].dow}</strong> · {summary.maxCount}
                </span>
              )}
              <span className="wglance-foot-item wglance-foot-remaining">
                <strong>{impact.length}</strong> course{impact.length !== 1 ? "s" : ""} affected
              </span>
            </div>
          </section>
        );
      })()}

      {/* Slim sticky recap that appears once the summary card scrolls away */}
      <div className={`lp-sticky${stuck ? " is-visible" : ""}${anyBreach ? " lp-glance-bad" : ""}`}
        role="button" tabIndex={stuck ? 0 : -1} aria-hidden={!stuck}
        aria-label="Leave summary — scroll to top"
        onClick={scrollToTop}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); scrollToTop(); } }}>
        <span className="lp-sticky-tag"><CalendarRange size={13} /> {rangeLabel}</span>
        <span className="lp-sticky-sum">
          <strong>{missed.length}</strong> {missed.length === 1 ? "class" : "classes"}{hoursTxt}
        </span>
        {anyBreach && <AlertTriangle size={14} className="lp-glance-warn" />}
        <ChevronUp size={15} className="lp-sticky-chev" />
      </div>

      {anyBreach && (
        <div className="lp-alert" role="alert">
          <AlertTriangle size={16} className="lp-alert-ico" />
          <span>This leave pushes you <strong>over the skip limit</strong> in {breachCount} course{breachCount !== 1 ? "s" : ""}.</span>
        </div>
      )}

      {missed.length === 0 ? (
        <EmptyState icon={PartyPopper} title="Nothing to miss" sub="No classes fall in this window — you&rsquo;re free to go." />
      ) : (
        <>
          {/* ── Attendance insights per course ── */}
          <section className="lp-section">
            <h2 className="lp-section-title"><TrendingDown size={14} /> Attendance impact</h2>
            <div className="lp-impact-grid">
              {impact.map(i => {
                const drop = i.pct != null && i.projPct != null && i.projPct < i.pct;
                const projTone = i.projPct == null ? "" : i.projPct >= THRESHOLD ? " good" : " bad";
                return (
                  <div key={i.code} className={`lp-impact${i.breach ? " lp-impact-bad" : ""} ${subjectClass(i.code)}`}>
                    <div className="lp-impact-top">
                      <span className="lp-dot" />
                      <span className="lp-impact-code">{i.code}</span>
                      <span className="lp-impact-miss">−{i.missCount} class{i.missCount !== 1 ? "es" : ""}</span>
                    </div>
                    <div className="lp-impact-name">{i.name}</div>
                    <span className={`lp-verdict lp-verdict-${i.verdict.tone}`}>
                      {i.verdict.tone === "ok"
                        ? <ShieldCheck size={12} />
                        : i.verdict.tone === "warn"
                          ? <AlertCircle size={12} />
                          : <AlertTriangle size={12} />}
                      {i.verdict.label}
                    </span>
                    <div className="lp-impact-pct">
                      <span className="lp-pct-block">
                        <span className="lp-pct-val">{i.pct != null ? `${i.pct}%` : "—"}</span>
                        <span className="lp-pct-cap">now</span>
                      </span>
                      {drop && (
                        <>
                          <ChevronRight size={15} className="lp-pct-arrow" />
                          <span className="lp-pct-block">
                            <span className={`lp-pct-val${projTone}`}>{i.projPct}%</span>
                            <span className="lp-pct-cap">after</span>
                          </span>
                        </>
                      )}
                    </div>
                    {i.projPct != null && (
                      <div className="lp-impact-bar" aria-hidden="true">
                        <span className="lp-impact-thresh" style={{ left: `${THRESHOLD}%` }} />
                        <span className={`lp-impact-fill${projTone}`} style={{ width: `${i.projPct}%` }} />
                        {drop && <span className="lp-impact-lost" style={{ left: `${i.projPct}%`, width: `${i.pct - i.projPct}%` }} />}
                      </div>
                    )}
                    <div className="lp-impact-skips">
                      {i.breach
                        ? <span className="lp-skip-bad"><AlertTriangle size={11} /> Over limit · {i.projSkipsRemaining} skips left</span>
                        : <span><b>{i.projSkipsRemaining}</b> of {i.totalAllowedSkips} skips left after</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            {onOpenAttendance && (
              <button className="lp-link" onClick={onOpenAttendance}>Open full attendance <ChevronRight size={13} /></button>
            )}
          </section>

          {/* ── Chronological list of missed classes ── */}
          <section className="lp-section">
            <h2 className="lp-section-title"><CalendarOff size={14} /> Classes you&rsquo;ll miss</h2>
            {missedByDay.map(([date, list]) => (
              <div key={date} className="lp-day">
                <div className="lp-day-label">
                  <span>{fmtFull(date)}</span>
                  <span className="lp-day-count">{list.length} class{list.length !== 1 ? "es" : ""}</span>
                </div>
                <ul className="lp-list">
                  {list.map(c => (
                    <li key={sessionKey(c)} className={`lp-row ${subjectClass(c.code)}`}>
                      <span className="lp-dot" />
                      <div className="lp-row-main">
                        <div className="lp-row-title">{c.code} · {legend[c.code]?.name || c.name}{c.session ? <span className="lp-row-sess"> · Session {c.session}</span> : null}</div>
                        <div className="lp-row-meta">
                          <span><Clock size={11} /> {fmtTime(c.start)}–{fmtTime(c.end)}</span>
                          {c.room && <span><MapPin size={11} /> {c.room}</span>}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </>
      )}

      {/* ── When you're back ── */}
      {upcoming.length > 0 && (
        <section className="lp-section">
          <h2 className="lp-section-title"><CalendarCheck2 size={14} /> When you&rsquo;re back</h2>
          <ul className="lp-list lp-list-back">
            {upcoming.map(c => (
              <li key={sessionKey(c)} className={`lp-row lp-row-back ${subjectClass(c.code)}`}>
                <span className="lp-dot" />
                <div className="lp-row-main">
                  <div className="lp-row-title">{c.code} · {legend[c.code]?.name || c.name}</div>
                  <div className="lp-row-meta">
                    <span>{fmtShort(c.date)}</span>
                    <span><Clock size={11} /> {fmtTime(c.start)}</span>
                    {c.room && <span><MapPin size={11} /> {c.room}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      </>
      )}
    </div>
  );
}

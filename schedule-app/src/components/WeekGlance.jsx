import { useMemo, useState } from "react";
import { CalendarRange, Clock, Flame, CalendarCheck, ChevronDown, PartyPopper } from "lucide-react";

function toMin(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

function clsEnd(c) {
  const [Y, Mo, D] = c.date.split("-").map(Number);
  const [h, m] = c.end.split(":").map(Number);
  return new Date(Y, Mo - 1, D, h, m);
}

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Compact "Week at a glance" card — shown on mobile Week view in place of the
// today-focused Hero, where a week-level overview is more relevant.
// `collapsible`: tapping the card toggles a slim one-row version (persisted).
export default function WeekGlance({ visible, now, offset = 0, todayISO, collapsible = false, variant = "card" }) {
  // "pulse" is the ScheduleModal's chart: counts sit above the bars on a shared
  // baseline instead of inside them. Scoped to a variant on purpose — the
  // sidebar, the mobile Week view and the Leave Planner summary all keep the
  // original card, which is the look those places were designed around.
  const pulse = variant === "pulse";
  const [collapsed, setCollapsed] = useState(
    () => collapsible && localStorage.getItem("wglance-collapsed") === "1"
  );
  const toggle = () => {
    if (!collapsible) return;
    setCollapsed((c) => {
      localStorage.setItem("wglance-collapsed", c ? "0" : "1");
      return !c;
    });
  };
  const stats = useMemo(() => {
    const monday = new Date(now);
    const dow = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - dow + offset * 7);
    monday.setHours(0, 0, 0, 0);

    const days = [...Array(7)].map((_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
    const isoSet = days.map(ymd);

    const perDay = isoSet.map((iso) =>
      visible.filter((c) => c.type === "class" && c.date === iso)
    );
    const counts = perDay.map((list) => list.length);

    const totalClasses = counts.reduce((a, b) => a + b, 0);
    const activeDays = counts.filter((n) => n > 0).length;

    const totalMin = perDay.flat().reduce(
      (acc, c) => acc + Math.max(0, toMin(c.end) - toMin(c.start)),
      0
    );
    const hours = Math.round((totalMin / 60) * 10) / 10;

    const maxCount = Math.max(0, ...counts);
    const busiestIdx = maxCount > 0 ? counts.indexOf(maxCount) : -1;

    const todayIdx = isoSet.indexOf(todayISO);
    // Sessions still to come this week (only meaningful for the current week)
    const remaining =
      todayIdx >= 0
        ? perDay.flat().filter((c) => clsEnd(c) > now).length
        : null;

    return {
      counts,
      totalClasses,
      activeDays,
      hours,
      maxCount,
      busiestIdx,
      todayIdx,
      remaining,
      range: `${monday.toLocaleDateString([], { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString([], { day: "numeric", month: "short" })}`,
    };
  }, [visible, now, offset, todayISO]);

  const relLabel =
    offset === 0 ? "This week" : offset === -1 ? "Last week" : offset === 1 ? "Next week" : "Week";

  if (stats.totalClasses === 0) {
    return (
      <section className="wglance wglance-empty">
        <div className="wglance-top">
          <div className="wglance-tag"><CalendarRange size={13} /> {relLabel}</div>
          <span className="wglance-range">{stats.range}</span>
        </div>
        <h1 className="wglance-head">No classes this week <PartyPopper size={16} aria-hidden="true" /></h1>
        <div className="wglance-sub">Nothing scheduled in your selected courses.</div>
      </section>
    );
  }

  const interactive = collapsible
    ? {
        role: "button",
        tabIndex: 0,
        "aria-expanded": !collapsed,
        "aria-label": `${relLabel} summary, tap to ${collapsed ? "expand" : "collapse"}`,
        onClick: toggle,
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
        },
      }
    : {};

  if (collapsed) {
    return (
      <section className="wglance is-collapsed" {...interactive}>
        <div className="wglance-mini">
          <div className="wglance-tag"><CalendarRange size={13} /> {relLabel}</div>
          <span className="wglance-mini-sum">
            <strong>{stats.totalClasses}</strong> {stats.totalClasses === 1 ? "class" : "classes"} · ~{stats.hours}h
          </span>
          <div className="wglance-mini-bars" aria-hidden="true">
            {stats.counts.map((n, i) => (
              <span
                key={i}
                className={`wglance-mini-bar${i === stats.todayIdx ? " is-today" : ""}${n === 0 ? " is-empty" : ""}`}
                style={{ height: stats.maxCount > 0 && n > 0 ? `${Math.max(30, (n / stats.maxCount) * 100)}%` : "18%" }}
              />
            ))}
          </div>
          <ChevronDown size={15} className="wglance-chev" />
        </div>
      </section>
    );
  }

  return (
    <section className={`wglance${collapsible ? " is-collapsible" : ""}${pulse ? " is-pulse" : ""}`} {...interactive}>
      <div className="wglance-top">
        <div className="wglance-tag"><CalendarRange size={13} /> {relLabel}</div>
        <span className="wglance-range">
          {stats.range}
          {collapsible && <ChevronDown size={15} className="wglance-chev is-open" />}
        </span>
      </div>

      <div className="wglance-head-row">
        <h1 className="wglance-head">
          {stats.totalClasses}<span className="wglance-head-unit">{stats.totalClasses === 1 ? "class" : "classes"}</span>
        </h1>
        <div className="wglance-facts">
          <span className="wglance-fact"><CalendarCheck size={13} />{stats.activeDays} day{stats.activeDays !== 1 ? "s" : ""}</span>
          <span className="wglance-fact"><Clock size={13} />~{stats.hours}h</span>
        </div>
      </div>

      <div className="wglance-bars" role="img" aria-label={`Classes per day this week: ${stats.counts.map((n, i) => `${DOW[i]} ${n}`).join(", ")}`}>
        {stats.counts.map((n, i) => {
          const h = stats.maxCount > 0 ? Math.round((n / stats.maxCount) * 100) : 0;
          const isToday = i === stats.todayIdx;
          const isBusiest = i === stats.busiestIdx && n > 0;
          // The pulse floor keeps a one-class day a readable column rather than
          // a chip hovering over an invisible baseline.
          const height = n === 0 ? (pulse ? "4px" : "3px")
            : pulse ? `${20 + Math.round((n / stats.maxCount) * 80)}%`
            : `${Math.max(14, h)}%`;
          return (
            <div
              key={i}
              className={`wglance-col${isToday ? " is-today" : ""}${pulse && n === 0 ? " is-off" : ""}${pulse && isBusiest ? " is-busiest-col" : ""}`}
            >
              {pulse && <span className="wglance-bar-n">{n > 0 ? n : ""}</span>}
              <div className="wglance-bar-track">
                <div
                  className={`wglance-bar${isBusiest ? " is-busiest" : ""}${n === 0 ? " is-empty" : ""}`}
                  style={{ height }}
                >
                  {!pulse && n > 0 && <span className="wglance-bar-n">{n}</span>}
                </div>
              </div>
              <span className="wglance-dow">{DOW[i]}</span>
            </div>
          );
        })}
      </div>

      <div className="wglance-foot">
        {stats.busiestIdx >= 0 && (
          <span className="wglance-foot-item">
            <Flame size={13} /> Busiest <strong>{DOW[stats.busiestIdx]}</strong> · {stats.maxCount}
          </span>
        )}
        {stats.remaining != null && (
          <span className="wglance-foot-item wglance-foot-remaining">
            {stats.remaining > 0 ? <><strong>{stats.remaining}</strong> left this week</> : <>All done for the week <PartyPopper size={12} aria-hidden="true" /></>}
          </span>
        )}
      </div>
    </section>
  );
}

import { Clock, MapPin, Zap, CalendarClock, GraduationCap, BookOpenCheck, UtensilsCrossed, ArrowRight, PartyPopper } from "lucide-react";
import { upcomingDeadlines } from "../lib/insights.js";
import { getMenuForDay, MEAL_TIMES } from "../data/messMenu.js";
import { MEAL_ICONS, toMin, fmt12, fmtIn, mealStatus } from "../lib/messView.js";
import { subjectClass } from "../lib/subjectColors.js";
import "./../styles/glance.css";

// Glance — the PWA-shortcut "3-second read": next class, rest of today,
// nearest deadlines and the upcoming mess meal, all computed from data that is
// already local (schedule snapshot, assignments store, bundled menu). No
// network waits, so it paints instantly even offline.

function fmtCountdown(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60), r = m % 60;
  if (h < 24) return r ? `in ${h}h ${r}m` : `in ${h}h`;
  return `in ${Math.round(m / 1440)}d`;
}

function prettyDeadlineDate(iso, todayISO, tomorrowISO) {
  if (iso === todayISO) return "Today";
  if (iso === tomorrowISO) return "Tomorrow";
  const [Y, M, D] = iso.split("-").map(Number);
  return new Date(Y, M - 1, D).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

export default function GlanceView({ current, next, todayList, now, todayISO, tomorrowISO, visible, legend, onNavigate }) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const hero = current || next;
  const heroIsToday = hero && hero.date === todayISO;

  // Rest of today: classes that haven't ended yet
  const remaining = todayList.filter(c => {
    const end = toMin(c.end || c.start || "23:59");
    return end > nowMin;
  });

  const deadlines = upcomingDeadlines(visible, legend, now, 7).slice(0, 3);

  // Featured mess meal — same pick logic as MessCard: serving now, else next
  // today, else tomorrow's breakfast.
  const menuDate = new Date(now);
  let meal = MEAL_TIMES.find(m => mealStatus(m, nowMin) !== "past");
  let mealTomorrow = false;
  if (!meal) { meal = MEAL_TIMES[0]; menuDate.setDate(menuDate.getDate() + 1); mealTomorrow = true; }
  const menu = getMenuForDay(menuDate.getDay(), menuDate);
  const mealItems = menu ? (menu[meal.id] || []).slice(0, 4) : [];
  const mealLive = !mealTomorrow && mealStatus(meal, nowMin) === "now";
  const MealIcon = MEAL_ICONS[meal.id];

  const heroPct = current
    ? Math.min(100, Math.max(0, ((now - current.s) / (current.e - current.s)) * 100))
    : 0;

  return (
    <div className="glance">
      <div className="glance-head">
        <span className="glance-title"><Zap size={15} /> Glance</span>
        <span className="glance-date">{now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" })}</span>
      </div>

      {/* ── Now / Next hero ── */}
      {hero ? (
        <button type="button" className={`glance-hero${current ? " is-live" : ""}`} onClick={() => onNavigate(heroIsToday || current ? "today" : "tomorrow")}>
          <div className="glance-hero-top">
            <span className="glance-hero-chip">{current ? <><span className="glance-dot" />Now</> : "Next"}</span>
            {!current && !heroIsToday && (
              <span className="glance-hero-day">{hero.date === tomorrowISO ? "Tomorrow" : hero.s.toLocaleDateString([], { weekday: "long" })}</span>
            )}
            <span className="glance-hero-eta">
              {current ? `${Math.max(0, Math.round((current.e - now) / 60000))}m left` : fmtCountdown(next.s - now)}
            </span>
          </div>
          <div className="glance-hero-name">
            {hero.name}
            {hero.code && <span className={`ses ${subjectClass(hero.code)}`}>{hero.code}</span>}
          </div>
          <div className="glance-hero-meta">
            <span><MapPin size={12} />{hero.room || "TBA"}</span>
            <span><Clock size={12} />{hero.start}–{hero.end}</span>
          </div>
          {current && (
            <div className="glance-progress"><div className="glance-progress-fill" style={{ width: `${heroPct}%` }} /></div>
          )}
        </button>
      ) : (
        <div className="glance-hero glance-hero-empty">
          <PartyPopper size={18} />
          <div>
            <strong>All clear!</strong>
            <span>No upcoming classes on your schedule.</span>
          </div>
        </div>
      )}

      {/* ── Rest of today ── */}
      <section className="glance-sec">
        <button type="button" className="glance-sec-head" onClick={() => onNavigate("today")}>
          <span><CalendarClock size={13} /> Today</span>
          <span className="glance-sec-more">{remaining.length === 0 ? "Done for today" : `${remaining.length} to go`} <ArrowRight size={12} /></span>
        </button>
        {remaining.length > 0 && (
          <ul className="glance-list">
            {remaining.slice(0, 4).map((c, i) => (
              <li key={`${c.code}-${c.start}-${i}`} className="glance-row">
                <span className="glance-row-time">{c.start}</span>
                {c.code
                  ? <span className={`ses ${subjectClass(c.code)}`}>{c.code}</span>
                  : <span className="glance-row-name">{c.name}</span>}
                <span className="glance-row-room">{c.room || ""}</span>
              </li>
            ))}
            {remaining.length > 4 && <li className="glance-row glance-row-more">+{remaining.length - 4} more</li>}
          </ul>
        )}
      </section>

      {/* ── Deadlines (exams + assignments, next 7 days) ── */}
      {deadlines.length > 0 && (
        <section className="glance-sec">
          <button type="button" className="glance-sec-head" onClick={() => onNavigate(deadlines[0].kind === "exam" ? "exams" : "assignments")}>
            <span><BookOpenCheck size={13} /> Deadlines</span>
            <span className="glance-sec-more">7 days <ArrowRight size={12} /></span>
          </button>
          <ul className="glance-list">
            {deadlines.map(d => (
              <li key={d.key} className="glance-row">
                <span className={`glance-kind ${d.kind === "exam" ? "is-exam" : ""}`}>
                  {d.kind === "exam" ? <GraduationCap size={12} /> : <BookOpenCheck size={12} />}
                </span>
                <span className={`ses ${subjectClass(d.code)}`}>{d.code}</span>
                <span className="glance-row-name">{d.title}</span>
                <span className="glance-row-room">{prettyDeadlineDate(d.date, todayISO, tomorrowISO)}{d.time ? ` · ${fmt12(d.time)}` : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Mess meal ── */}
      {menu && (
        <section className="glance-sec">
          <button type="button" className="glance-sec-head" onClick={() => onNavigate("today")}>
            <span><UtensilsCrossed size={13} /> Mess</span>
            <span className="glance-sec-more">Full menu <ArrowRight size={12} /></span>
          </button>
          <div className={`glance-meal glance-acc-${meal.id}`}>
            <span className="glance-meal-icon"><MealIcon size={15} /></span>
            <div className="glance-meal-body">
              <div className="glance-meal-name">
                {meal.label}
                <span className="glance-meal-time">{fmt12(meal.start)} – {fmt12(meal.end)}</span>
                {mealTomorrow && <span className="glance-meal-tag">Tomorrow</span>}
              </div>
              <div className="glance-meal-items">{mealItems.join(" · ")}{(menu[meal.id] || []).length > 4 ? " …" : ""}</div>
            </div>
            {mealLive
              ? <span className="glance-meal-live"><span className="glance-dot" />Serving</span>
              : <span className="glance-meal-when">{mealTomorrow ? "Tmrw" : fmtIn(toMin(meal.start) - nowMin)}</span>}
          </div>
        </section>
      )}

      <button type="button" className="glance-open" onClick={() => onNavigate("today")}>
        Open TermFlow <ArrowRight size={14} />
      </button>
    </div>
  );
}

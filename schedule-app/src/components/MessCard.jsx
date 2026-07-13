import { useEffect, useState } from "react";
import { Coffee, Utensils, Cookie, Moon, UtensilsCrossed, ChevronDown, CalendarDays, X } from "lucide-react";
import { getMenuForDay, MEAL_TIMES } from "../data/messMenu.js";
import "./../styles/mess.css";

const MEAL_ICONS = { breakfast: Coffee, lunch: Utensils, snacks: Cookie, dinner: Moon };
const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Monday of the week containing `d` (local time, doesn't mutate `d`)
function mondayOf(d) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(d.getDate() + diff);
  return m;
}

// Desktop (mouse) expands on hover; touch devices keep the tap toggle
const CAN_HOVER = typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

function toMin(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function fmt12(t) {
  let [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}
function fmt12min(min) {
  return fmt12(`${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`);
}
function fmtIn(mins) {
  if (mins < 60) return `in ${mins}m`;
  const h = Math.floor(mins / 60), r = mins % 60;
  return r ? `in ${h}h ${r}m` : `in ${h}h`;
}

// "past" | "now" | "upcoming" relative to minutes-since-midnight
function mealStatus(meal, nowMin) {
  if (nowMin >= toMin(meal.end)) return "past";
  if (nowMin >= toMin(meal.start)) return "now";
  return "upcoming";
}

function ItemChips({ items, small }) {
  return (
    <div className={`mess-chips${small ? " small" : ""}`}>
      {items.map((it) => <span key={it} className="mess-chip">{it}</span>)}
    </div>
  );
}

function FullMenuModal({ now, onClose }) {
  const todayIdx = (now.getDay() + 6) % 7; // Mon=0 ... Sun=6
  const [dayIdx, setDayIdx] = useState(todayIdx);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const monday = mondayOf(now);
  const weekDays = WEEK_LABELS.map((label, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return { label, date, menu: getMenuForDay(date.getDay(), date) };
  });
  const isToday = dayIdx === todayIdx;
  const dayMenu = weekDays[dayIdx].menu;

  return (
    <div className="fs-modal-overlay" onClick={onClose}>
      <div className="fs-modal-content mess-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fs-modal-header">
          <h3><UtensilsCrossed size={18} color="var(--violet)" /> Full Mess Menu</h3>
          <button type="button" className="fs-modal-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <div className="mess-daytabs" role="tablist" aria-label="Choose a day">
          {weekDays.map((d, i) => (
            <button
              key={d.label}
              type="button"
              role="tab"
              aria-selected={i === dayIdx}
              className={`mess-daytab${i === dayIdx ? " on" : ""}${i === todayIdx ? " is-today" : ""}`}
              onClick={() => setDayIdx(i)}
            >
              {d.label}
              {i === todayIdx && <span className="mess-daytab-dot" />}
            </button>
          ))}
        </div>

        <div className="fs-modal-body mess-modal-body">
          {MEAL_TIMES.map((m) => {
            const Icon = MEAL_ICONS[m.id];
            const st = isToday ? mealStatus(m, nowMin) : "upcoming";
            return (
              <div key={m.id} className={`mess-modal-meal mess-acc-${m.id}${st === "past" ? " is-past" : ""}`}>
                <div className="mess-modal-meal-head">
                  <span className="mess-meal-icon"><Icon size={16} /></span>
                  <span className="mess-meal-name">
                    {m.label}
                    <span className="mess-meal-time">{fmt12(m.start)} – {fmt12(m.end)}</span>
                  </span>
                  {st === "now" && <span className="mess-bar-serving"><span className="mess-chip-dot" />Serving</span>}
                </div>
                <ItemChips items={dayMenu[m.id] || []} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function MessCard({ now }) {
  const [expanded, setExpanded] = useState(false);
  const [fullMenuOpen, setFullMenuOpen] = useState(false);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // Featured meal: the one serving now, else the next one today,
  // else tomorrow's breakfast (late night).
  const menuDate = new Date(now);
  let dayLabel = "Today";
  let featured = MEAL_TIMES.find(m => mealStatus(m, nowMin) !== "past");
  if (!featured) {
    featured = MEAL_TIMES[0];
    menuDate.setDate(menuDate.getDate() + 1);
    dayLabel = "Tomorrow";
  }
  const menu = getMenuForDay(menuDate.getDay(), menuDate);
  if (!menu) return null;
  const isTomorrow = dayLabel === "Tomorrow";
  const status = isTomorrow ? "upcoming" : mealStatus(featured, nowMin);
  const FeatIcon = MEAL_ICONS[featured.id];
  const items = menu[featured.id] || [];

  const startMin = toMin(featured.start), endMin = toMin(featured.end);
  const dayWord = isTomorrow ? "Tomorrow" : featured.id === "dinner" ? "Tonight" : "Today";
  const pct = Math.min(100, Math.max(0, ((nowMin - startMin) / (endMin - startMin)) * 100));

  const hoverProps = CAN_HOVER
    ? { onMouseEnter: () => setExpanded(true), onMouseLeave: () => setExpanded(false) }
    : {};

  return (
    <section
      className={`mess-card${expanded ? " is-open" : ""}${status === "now" ? " is-live" : ""}`}
      aria-label="Mess menu"
      {...hoverProps}
    >
      {/* ── Compact bar (collapsed) ── */}
      <div className="mess-collapse mess-collapse-bar" aria-hidden={expanded}>
        <div className="mess-clip">
          <span className="mess-title mess-bar-title"><UtensilsCrossed size={14} strokeWidth={2.25} /> Mess Menu</span>
          {/* A plain div (not a <button>) wraps the row: the chip strip inside
              scrolls horizontally on mobile, and nesting a native scrollable
              region inside a real <button> is unreliable for taps on touch
              browsers (the scroll gesture can eat the tap). role="button" +
              onKeyDown keeps it keyboard/AT-accessible without that risk. */}
          <div
            role="button"
            tabIndex={expanded ? -1 : 0}
            className={`mess-bar mess-acc-${featured.id}`}
            onClick={() => setExpanded(true)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(true); } }}
            aria-expanded={expanded}
          >
            <span className="mess-bar-head">
              <span className="mess-meal-icon"><FeatIcon size={17} /></span>
              <span className="mess-bar-name">{featured.label}</span>
              <span className="mess-bar-time">{fmt12(featured.start)}–{fmt12(featured.end)}</span>
            </span>
            <span className="mess-bar-rail">
              <span className="mess-bar-chips">
                {items.map((it) => (
                  <span key={it} className="mess-chip mess-bar-chip"><span className="mess-chip-dot" />{it}</span>
                ))}
              </span>
            </span>
            <span className="mess-bar-status">
              {status === "now"
                ? <span className="mess-bar-serving"><span className="mess-chip-dot" />Serving</span>
                : <span className="mess-bar-when">{isTomorrow ? "Tmrw" : fmtIn(startMin - nowMin)}</span>}
              <span className="mess-bar-arrow"><ChevronDown size={16} /></span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Expanded dropdown ── */}
      <div className="mess-collapse mess-collapse-exp" aria-hidden={!expanded}>
        <div className="mess-clip">
          <div className="mess-exp-inner">
            <div className="mess-head">
              <span className="mess-title"><UtensilsCrossed size={14} /> Mess Menu</span>
              <span className="mess-head-right">
                <span className="mess-count-pill">{dayWord} · {items.length} items</span>
                <button
                  type="button"
                  className="mess-bar-arrow is-open"
                  onClick={() => setExpanded(false)}
                  aria-expanded={expanded}
                  aria-label="Collapse mess menu"
                  tabIndex={expanded ? 0 : -1}
                >
                  <ChevronDown size={16} />
                </button>
              </span>
            </div>

            <div className={`mess-featured mess-acc-${featured.id}`}>
              <div className="mess-featured-top">
                <span className="mess-meal-icon"><FeatIcon size={18} /></span>
                <div className="mess-meal-name">
                  {featured.label}
                  <span className="mess-meal-time">{fmt12(featured.start)} – {fmt12(featured.end)}</span>
                  {isTomorrow && <span className="mess-tomorrow-tag">Tomorrow</span>}
                </div>
                {status === "now"
                  ? (
                    <span className="mess-left">
                      <strong>{endMin - nowMin}m left</strong>
                      <span>ends {fmt12(featured.end)}</span>
                    </span>
                  )
                  : <span className="mess-left"><strong>{isTomorrow ? `Tomorrow · ${fmt12(featured.start)}` : fmtIn(startMin - nowMin)}</strong></span>}
              </div>

              {status === "now" && (
                <div className="mess-progress">
                  <div className="mess-progress-track">
                    <div className="mess-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mess-progress-labels">
                    <span>{fmt12(featured.start)}</span>
                    <span>{fmt12min(Math.round((startMin + endMin) / 2))}</span>
                    <span>{fmt12(featured.end)}</span>
                  </div>
                </div>
              )}

              <ItemChips items={items} />
            </div>

            <ul className="mess-all">
              {MEAL_TIMES.filter(m => m.id !== featured.id).map(m => {
                const st = isTomorrow ? "upcoming" : mealStatus(m, nowMin);
                const Icon = MEAL_ICONS[m.id];
                return (
                  <li key={m.id} className={`mess-row mess-acc-${m.id}${st === "past" ? " is-past" : ""}`}>
                    <span className="mess-meal-icon"><Icon size={15} /></span>
                    <div className="mess-row-body">
                      <div className="mess-meal-name">
                        {m.label}
                        <span className="mess-meal-time">{fmt12(m.start)} – {fmt12(m.end)}</span>
                      </div>
                      <ItemChips items={menu[m.id] || []} small />
                    </div>
                  </li>
                );
              })}
            </ul>

            <button type="button" className="mess-viewfull" onClick={() => setFullMenuOpen(true)}>
              <CalendarDays size={14} /> View full menu
            </button>
          </div>
        </div>
      </div>

      {fullMenuOpen && <FullMenuModal now={now} onClose={() => setFullMenuOpen(false)} />}
    </section>
  );
}

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { UtensilsCrossed, X, Star, ThumbsUp, ThumbsDown } from "lucide-react";
import { getMenuForDay, MEAL_TIMES } from "../data/messMenu.js";
import { MEAL_ICONS, WEEK_LABELS, mondayOf, toMin, fmt12, fmtIn, mealStatus, useMessData } from "../lib/messView.js";
import "../styles/mess.css";

export function ItemChips({ items, small, favourites, onToggleFav }) {
  return (
    <div className={`mess-chips${small ? " small" : ""}`}>
      {items.map((it) => {
        const fav = favourites?.has(it);
        if (onToggleFav) {
          return (
            <button
              key={it}
              type="button"
              className={`mess-chip mess-chip-btn${fav ? " is-fav" : ""}`}
              onClick={() => onToggleFav(it)}
              aria-pressed={fav}
              title={fav ? "Remove from favourites" : "Add to favourites"}
            >
              <Star size={11} className="mess-chip-star" fill={fav ? "currentColor" : "none"} />
              {it}
            </button>
          );
        }
        return (
          <span key={it} className={`mess-chip${fav ? " is-fav" : ""}`}>
            {fav && <Star size={10} className="mess-chip-star" fill="currentColor" />}
            {it}
          </span>
        );
      })}
    </div>
  );
}

// Compact cohort rating control for one meal. Hidden entirely when ratings
// aren't available (migration not applied / signed out) via the parent guard.
export function MealRating({ mealId, stats, mine, onRate }) {
  const s = stats?.[mealId] || { up: 0, down: 0 };
  const total = s.up + s.down;
  const pct = total ? Math.round((s.up / total) * 100) : null;
  const my = mine?.[mealId];
  return (
    <div className="mess-rate" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`mess-rate-btn${my === 1 ? " on" : ""}`}
        onClick={() => onRate(mealId, my === 1 ? null : 1)}
        aria-pressed={my === 1}
        aria-label="Thumbs up"
      >
        <ThumbsUp size={13} />
      </button>
      <button
        type="button"
        className={`mess-rate-btn down${my === -1 ? " on" : ""}`}
        onClick={() => onRate(mealId, my === -1 ? null : -1)}
        aria-pressed={my === -1}
        aria-label="Thumbs down"
      >
        <ThumbsDown size={13} />
      </button>
      {total > 0 && (
        <span className="mess-rate-stat" title={`${s.up} up · ${s.down} down`}>
          {pct}% liked · {total}
        </span>
      )}
    </div>
  );
}

// Full-week mess menu — day tabs across the top, one card per meal. Purely
// presentational: favourites + ratings are passed in.
export default function MessMenuModal({ now, onClose, favourites, onToggleFav, ratings }) {
  const todayIdx = (now.getDay() + 6) % 7; // Mon=0 ... Sun=6
  const [dayIdx, setDayIdx] = useState(todayIdx);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    // Lock background scroll while the modal is open. The page scrolls on the
    // document element (html), so we lock both html and body — locking body
    // alone leaves the background scrollable (and its hover states live).
    const html = document.documentElement;
    const prevHtml = html.style.overflow;
    const prevBody = document.body.style.overflow;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      html.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [onClose]);

  const monday = mondayOf(now);
  const weekDays = WEEK_LABELS.map((label, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return { label, date, menu: getMenuForDay(date.getDay(), date) };
  });
  const isToday = dayIdx === todayIdx;
  const selected = weekDays[dayIdx];
  const dayMenu = selected.menu;
  const totalItems = MEAL_TIMES.reduce((n, m) => n + (dayMenu[m.id]?.length || 0), 0);
  const dateSub = isToday
    ? `Today · ${selected.date.toLocaleDateString([], { day: "numeric", month: "short" })}`
    : selected.date.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });

  return createPortal(
    <div className="fs-modal-overlay" onClick={onClose}>
      <div className="fs-modal-content mess-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Full mess menu">
        <div className="fs-modal-header mess-modal-header">
          <div className="mess-modal-title">
            <span className="mess-modal-title-ico"><UtensilsCrossed size={17} /></span>
            <span className="mess-modal-title-text">
              <h3>Mess Menu</h3>
              <span className="mess-modal-sub">{dateSub} · {totalItems} items</span>
            </span>
          </div>
          <button type="button" className="fs-modal-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <div className="mess-weekstrip" role="tablist" aria-label="Choose a day">
          {weekDays.map((d, i) => (
            <button
              key={d.label}
              type="button"
              role="tab"
              aria-selected={i === dayIdx}
              aria-label={`${d.label} ${d.date.getDate()}${i === todayIdx ? " (today)" : ""}`}
              className={`mess-day${i === dayIdx ? " on" : ""}${i === todayIdx ? " is-today" : ""}`}
              onClick={() => setDayIdx(i)}
            >
              <span className="mess-day-dow">{d.label}</span>
              <span className="mess-day-num">{d.date.getDate()}</span>
              {i === todayIdx && <span className="mess-day-dot" aria-hidden="true" />}
            </button>
          ))}
        </div>

        <div className="fs-modal-body mess-modal-body">
          <p className="mess-fav-hint"><Star size={11} /> Tap a dish to save it as a favourite</p>
          {MEAL_TIMES.map((m) => {
            const Icon = MEAL_ICONS[m.id];
            const items = dayMenu[m.id] || [];
            const st = isToday ? mealStatus(m, nowMin) : "upcoming";
            const startMin = toMin(m.start);
            return (
              <section key={m.id} className={`mess-meal-card mess-acc-${m.id} is-${st}${st === "past" ? " is-past" : ""}`}>
                <span className="mess-meal-spine" aria-hidden="true" />
                <div className="mess-meal-card-head">
                  <span className="mess-meal-icon"><Icon size={16} /></span>
                  <span className="mess-meal-heading">
                    <span className="mess-meal-name">{m.label}</span>
                    <span className="mess-meal-time">{fmt12(m.start)} – {fmt12(m.end)} · {items.length} item{items.length === 1 ? "" : "s"}</span>
                  </span>
                  <span className="mess-meal-status">
                    {isToday && st === "now"
                      ? <span className="mess-status-pill is-live"><span className="mess-chip-dot" />Serving now</span>
                      : isToday && st === "upcoming"
                        ? <span className="mess-status-pill">{fmtIn(startMin - nowMin)}</span>
                        : isToday && st === "past"
                          ? <span className="mess-status-pill is-done">Served</span>
                          : null}
                  </span>
                </div>
                {ratings && isToday && (
                  <div className="mess-meal-rate-row">
                    <MealRating mealId={m.id} stats={ratings.stats} mine={ratings.mine} onRate={ratings.onRate} />
                  </div>
                )}
                {items.length > 0
                  ? <ItemChips items={items} favourites={favourites} onToggleFav={onToggleFav} />
                  : <div className="mess-meal-empty">Not served</div>}
              </section>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

// Self-contained entry point for the ⋯ Tools menu: owns its own favourites +
// ratings so it works from any view, independent of the Today card.
export function MessMenuStandalone({ now, userId, onClose }) {
  const { favourites, toggleFav, ratings } = useMessData(now, userId);
  return <MessMenuModal now={now} onClose={onClose} favourites={favourites} onToggleFav={toggleFav} ratings={ratings} />;
}

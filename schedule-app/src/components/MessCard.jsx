import { useState, useEffect } from "react";
import { UtensilsCrossed, ChevronDown, CalendarDays, Heart, Users } from "lucide-react";
import { fetchFriendStatuses } from "../lib/status.js";
import { getMenuForDay, MEAL_TIMES, favouritesInMenu } from "../data/messMenu.js";
import FullMenuModal, { ItemChips, MealRating } from "./MessMenuModal.jsx";
import { useMessData, MEAL_ICONS, toMin, fmt12, fmtIn, mealStatus } from "../lib/messView.js";
import "./../styles/mess.css";
import "../styles/mess-refresh.css";

// Desktop (mouse) expands on hover; touch devices keep the tap toggle
const CAN_HOVER = typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

function fmt12min(min) {
  return fmt12(`${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`);
}

export default function MessCard({ now, userId, friends = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [fullMenuOpen, setFullMenuOpen] = useState(false);
  const { favourites, toggleFav, ratings } = useMessData(now, userId);

  // Friends who set the "Heading to mess" quick status (fresh fetch — the
  // local friends cache is too stale for a 30-min status). The effect only
  // stores the raw status map; names derive at render so the list empties
  // naturally when friends change.
  const [statusMap, setStatusMap] = useState({});
  const friendCloudKey = friends.map(f => f.cloudId).filter(Boolean).sort().join(",");
  useEffect(() => {
    if (!friendCloudKey) return;
    let alive = true;
    fetchFriendStatuses(friendCloudKey.split(",")).then(map => { if (alive) setStatusMap(map); });
    return () => { alive = false; };
  }, [friendCloudKey]);
  const messMates = friends
    .filter(f => f.cloudId && statusMap[f.cloudId]?.id === "mess")
    .map(f => f.name.split(" ")[0]);

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
  const favToday = favouritesInMenu(menu, favourites);
  const isTomorrow = dayLabel === "Tomorrow";
  const status = isTomorrow ? "upcoming" : mealStatus(featured, nowMin);
  const FeatIcon = MEAL_ICONS[featured.id];
  const items = menu[featured.id] || [];

  const startMin = toMin(featured.start), endMin = toMin(featured.end);
  const dayWord = isTomorrow ? "Tomorrow" : featured.id === "dinner" ? "Tonight" : "Today";
  const pct = Math.min(100, Math.max(0, ((nowMin - startMin) / (endMin - startMin)) * 100));

  // Disable hover-to-expand while the full-menu modal is open, so the card
  // behind the overlay doesn't react to the pointer.
  const hoverProps = CAN_HOVER && !fullMenuOpen
    ? { onMouseEnter: () => setExpanded(true), onMouseLeave: () => setExpanded(false) }
    : {};

  return (
    <section
      className={`mess-card mess-card-refresh${expanded ? " is-open" : ""}${status === "now" ? " is-live" : ""}`}
      aria-label="Mess menu"
      {...hoverProps}
    >
      <header className="mess-card-header">
        <div>
          <span className="mess-card-heading"><UtensilsCrossed size={17} aria-hidden="true" />Mess Menu</span>
          <span className="mess-card-date">{dayLabel} · {menuDate.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</span>
        </div>
        <button type="button" className="mess-week-link" aria-label="Full mess menu" onClick={() => setFullMenuOpen(true)}><CalendarDays size={14} aria-hidden="true" />Weekly menu</button>
      </header>
      {/* ── Compact bar (collapsed) ── */}
      <div className="mess-collapse mess-collapse-bar" aria-hidden={expanded} inert={expanded}>
        <div className="mess-clip">
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
              <span className="mess-bar-copy">
                <span className="mess-bar-name">{featured.label}</span>
                <span className="mess-bar-time">{fmt12(featured.start)} – {fmt12(featured.end)}</span>
              </span>
            </span>
            <span className="mess-bar-rail">
              <span className="mess-bar-chips">
                {items.slice(0, 3).map((it) => (
                  <span key={it} className="mess-chip mess-bar-chip"><span className="mess-chip-dot" />{it}</span>
                ))}
                {items.length > 3 && <span className="mess-more-dishes">+{items.length - 3} more</span>}
              </span>
            </span>
            <span className="mess-bar-status">
              {status === "now"
                ? <span className="mess-bar-serving"><span className="mess-chip-dot" />Serving now</span>
                : <span className="mess-bar-when">{isTomorrow ? "Tomorrow" : fmtIn(startMin - nowMin)}</span>}
              <span className="mess-bar-arrow"><ChevronDown size={16} /></span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Expanded dropdown ── */}
      <div className="mess-collapse mess-collapse-exp" aria-hidden={!expanded} inert={!expanded}>
        <div className="mess-clip">
          <div className="mess-exp-inner">
            <div className="mess-head">
              <span className="mess-title">{dayWord}&rsquo;s menu</span>
              <span className="mess-head-right">
                {messMates.length > 0 && (
                  <span className="mess-friends-pill" title={`Heading to mess: ${messMates.join(", ")}`}>
                    <Users size={11} /> {messMates[0]}{messMates.length > 1 ? ` +${messMates.length - 1}` : ""} heading over
                  </span>
                )}
                {favToday.length > 0 && (
                  <span className="mess-fav-pill" title={favToday.join(", ")}>
                    <Heart size={11} fill="currentColor" /> {favToday.length} fav{favToday.length === 1 ? "" : "s"}
                  </span>
                )}
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

              <ItemChips items={items} favourites={favourites} onToggleFav={toggleFav} menu />
              {ratings && !isTomorrow && (
                <div className="mess-featured-rate">
                  <span className="mess-rate-label">Rate today&rsquo;s {featured.label.toLowerCase()}</span>
                  <MealRating mealId={featured.id} stats={ratings.stats} mine={ratings.mine} onRate={ratings.onRate} />
                </div>
              )}
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
                      <ItemChips items={menu[m.id] || []} small favourites={favourites} />
                    </div>
                  </li>
                );
              })}
            </ul>

            <button type="button" className="mess-viewfull" onClick={() => setFullMenuOpen(true)}>
              <CalendarDays size={14} /> View full menu
            </button>
            <p className="mess-card-disclaimer"><em>Please note that the menu is subject to minor changes or substitutions depending on the availability and procurement of certain food items. In such cases, suitable alternatives may be provided. -IMC</em></p>
          </div>
        </div>
      </div>

      {fullMenuOpen && <FullMenuModal now={now} onClose={() => setFullMenuOpen(false)} favourites={favourites} onToggleFav={toggleFav} ratings={ratings} />}
    </section>
  );
}

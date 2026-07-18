import { useEffect, useState } from "react";
import { Coffee, Utensils, Cookie, Moon } from "lucide-react";
import { loadMessFavourites, saveMessFavourites } from "../data/messMenu.js";
import { fetchMealStats, fetchMyRatings, setMealRating } from "./messRatings.js";

// Shared, non-component helpers for the mess-menu UI. Kept out of the component
// files so Fast Refresh stays happy (component files may only export components).

export const MEAL_ICONS = { breakfast: Coffee, lunch: Utensils, snacks: Cookie, dinner: Moon };
export const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Monday of the week containing `d` (local time, doesn't mutate `d`)
export function mondayOf(d) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(d.getDate() + diff);
  return m;
}

export function toMin(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
export function fmt12(t) {
  let [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}
export function fmtIn(mins) {
  if (mins < 60) return `in ${mins}m`;
  const h = Math.floor(mins / 60), r = mins % 60;
  return r ? `in ${h}h ${r}m` : `in ${h}h`;
}
// "past" | "now" | "upcoming" relative to minutes-since-midnight
export function mealStatus(meal, nowMin) {
  if (nowMin >= toMin(meal.end)) return "past";
  if (nowMin >= toMin(meal.start)) return "now";
  return "upcoming";
}

// Favourites (local) + today's cohort ratings, shared by the Today card and the
// standalone Tools modal so there's a single source of truth for both.
export function useMessData(now, userId) {
  const [favourites, setFavourites] = useState(loadMessFavourites);
  const toggleFav = (dish) => {
    setFavourites((prev) => {
      const next = new Set(prev);
      if (next.has(dish)) next.delete(dish); else next.add(dish);
      saveMessFavourites(next);
      return next;
    });
  };

  // Cohort meal ratings for today. `ratingsAvailable` stays false until the
  // stats RPC succeeds, so the controls are hidden if the migration isn't
  // applied yet or the user is signed out.
  const [mealStats, setMealStats] = useState({});
  const [myRatings, setMyRatings] = useState({});
  const [ratingsAvailable, setRatingsAvailable] = useState(false);
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    (async () => {
      const [stats, mine] = await Promise.all([fetchMealStats(day), fetchMyRatings(userId, day)]);
      if (cancelled) return;
      setRatingsAvailable(stats !== null);
      if (stats === null) return;
      setMealStats(stats);
      setMyRatings(mine);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, todayKey]);

  const handleRate = (mealId, rating) => {
    const prevMine = myRatings[mealId] ?? null;
    if (prevMine === rating) return;
    // Optimistic: adjust my vote + the aggregate, roll back if the write fails.
    setMyRatings((m) => { const n = { ...m }; if (rating === null) delete n[mealId]; else n[mealId] = rating; return n; });
    setMealStats((s) => {
      const cur = { up: 0, down: 0, ...(s[mealId] || {}) };
      if (prevMine === 1) cur.up--; else if (prevMine === -1) cur.down--;
      if (rating === 1) cur.up++; else if (rating === -1) cur.down++;
      return { ...s, [mealId]: cur };
    });
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    setMealRating(userId, day, mealId, rating).then((ok) => {
      if (!ok) { // revert both on failure
        setMyRatings((m) => { const n = { ...m }; if (prevMine === null) delete n[mealId]; else n[mealId] = prevMine; return n; });
        setMealStats((s) => {
          const cur = { up: 0, down: 0, ...(s[mealId] || {}) };
          if (rating === 1) cur.up--; else if (rating === -1) cur.down--;
          if (prevMine === 1) cur.up++; else if (prevMine === -1) cur.down++;
          return { ...s, [mealId]: cur };
        });
      }
    });
  };
  const ratings = (userId && ratingsAvailable) ? { stats: mealStats, mine: myRatings, onRate: handleRate } : null;

  return { favourites, toggleFav, ratings };
}

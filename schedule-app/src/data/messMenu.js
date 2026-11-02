import { getControls } from '../lib/appControls.js';
import { resolveMenu, resolveMealTimes, activeNotices } from '../lib/messControls.js';
import { DEFAULT_TIMES } from '../lib/controlsSchema.js';
// Mess menu — updated 2026-10-26 from the institute's live mess sheet
// (Google Sheet id 1ZqJCFYScuZwK15SFVelng8VVlABeffhbHi69jQ4MOo4), the same
// sheet the live feed (lib/messFeed.js) reads. This is the OFFLINE FALLBACK:
// online, the app overlays the live feed on top of this. Keep it in sync when
// the institute publishes a new cycle so first-paint / offline shows the
// right menu. Day keys follow Date#getDay(): 0 = Sunday … 6 = Saturday.

export const MEAL_TIMES = DEFAULT_TIMES;

// The default rotation anchor lives in controlsSchema; admins can publish a new one.

// Served every day alongside the day's breakfast mains
export const DAILY_BREAKFAST = [
  "Bread + Butter + Jam", "Cornflakes + Milk", "Sprouts", "Boiled Egg", "Fruits",
];

export const BASE_MENU = {
  0: { // Sunday
    breakfast: ["Masala Dosa", "Sambhar", "Coconut Chutney"],
    lunch: ["Onion Rice", "Soyabean Aloo Curry", "Dahi Tirkari", "Arhar Dal", "Cucumber Raita", "Green Salad"],
    snacksW13: ["Aloo Bonda", "Tea"],
    snacksW24: ["Pani Puri", "Tea"],
    dinner: ["Plain Rice", "Mughlai Chicken", "Paneer Amritsari", "Dal Tadka", "Roti", "Onion Laccha Salad", "Appalam", "Ice Cream"],
  },
  1: { // Monday
    breakfast: ["Uttapam", "Tomato Chutney"],
    lunch: ["Jeera Rice", "Mix Vegetable", "Green Pumpkin Chatpata", "Arhar Dal Tadka", "Chaach", "Green Salad + Onion"],
    snacksW13: ["Papdi Chat + Imly Chutny + Dahi", "Tea"],
    snacksW24: ["Hakka Noodles", "Tea"],
    dinner: ["Jeera Rice", "Cabbage Matar", "Chole Curry", "Navratan Dal", "Roti", "Chickpea Salad", "Thecha + Appalam", "Jalebi Rabdi"],
  },
  2: { // Tuesday
    breakfast: ["Paneer Paratha", "Curd", "Green Chutney"],
    lunch: ["Plain Rice", "Rajma Masala", "Beans Aloo Fry", "Navratan Dal + Sambhar", "Plain Curd", "Green Salad + Onion"],
    snacksW13: ["Pav Bhaji", "Coffee"],
    snacksW24: ["Chole Kulche", "Coffee"],
    dinner: ["Plain Rice", "Aloo Tomato Sabji", "Black Chana Masala", "Akha Masoor Dal", "Roti", "Onion Laccha Salad", "Tomato Chutney"],
  },
  3: { // Wednesday
    breakfast: ["Idli + Vada + Omelette", "Sambhar", "Coconut Chutney"],
    lunch: ["Plain Rice", "Kadi Pakore", "Aloo Bhujiya", "Arhar Dal", "Boondi Raita", "Green Salad"],
    snacksW13: ["Mayo Veg Sandwich", "Tea"],
    snacksW24: ["Aloo Tikki", "Tea"],
    dinner: ["Veg Biryani", "Chicken Biryani", "Paneer Lababdar", "Chana Dal", "Roti", "Vinegar Onion & Raita", "Gulab Jamun"],
  },
  4: { // Thursday
    breakfast: ["Besan Chila", "Red Chutney", "Green Chutney"],
    lunch: ["Onion Rice", "Chole", "Cabbage Matar", "Dal Tadka", "Chaach", "Green Salad + Onion"],
    snacksW13: ["Aloo Sandwich", "Coffee"],
    snacksW24: ["Misal Pav", "Coffee"],
    dinner: ["Plain Rice", "Dry Aloo Capsicum", "Lobiya Curry", "Dalma", "Roti", "Green Salad", "Garlic Chutney + Appalam"],
  },
  5: { // Friday
    breakfast: ["Indori Poha + Omelette", "Sev / Bhujia", "Onion"],
    lunch: ["Plain Rice", "Rajma Masala", "Lauki Chana", "Dal Makhni", "Plain Curd", "Green Salad"],
    snacksW13: ["Samosa Chat", "Tea"],
    snacksW24: ["Sweet Potato Chat", "Tea"],
    dinner: ["Onion Rice", "Hyderabadi Chicken", "Kadhai Paneer (Red Gravy)", "Akha Masoor Dal", "Roti", "Kachumber Salad", "Fruit Custard"],
  },
  6: { // Saturday
    breakfast: ["Aloo Paratha", "Curd", "Green Chutney"],
    lunch: ["Plain Rice", "Aloo Chokha Fry", "Sev Tamatar", "Chana Dal + Sambhar", "Lassi", "Green Salad + Onion"],
    snacksW13: ["Red Pasta", "Coffee"],
    snacksW24: ["White Sauce Pasta", "Coffee"],
    dinner: ["Veg Fried Rice", "Kadhai Mushroom", "Soya Chilli", "Moong Dal", "Roti", "Chickpea Salad", "Schezwan Chutney"],
  },
};

// Live/cached sheet values, layered above the bundled fallback.
// Published admin weekly/date patches are resolved separately by resolveMenu.
let MENU_OVERRIDES = {};

export function setMessMenuOverrides(overrides) {
  MENU_OVERRIDES = overrides && typeof overrides === "object" ? overrides : {};
}

// ── Personal favourites + likes (local-first) ─────────────────────────────
// Dishes the user stars are highlighted everywhere they appear in the menu,
// and surfaced as a "favourites today" nudge on the mess card. Stored per
// device in localStorage; keyed by the dish label so it survives menu updates
// as long as the dish name is unchanged.
const FAV_KEY = "pgp2.mess-favourites";
const LIKE_KEY = "pgp2.mess-likes"; // dish -> 1 (liked) | -1 (disliked)

export function loadMessFavourites() {
  try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY)) || []); } catch { return new Set(); }
}
export function saveMessFavourites(set) {
  try { localStorage.setItem(FAV_KEY, JSON.stringify([...set])); } catch {}
}
export function loadMessLikes() {
  try { return JSON.parse(localStorage.getItem(LIKE_KEY)) || {}; } catch { return {}; }
}
export function saveMessLikes(map) {
  try { localStorage.setItem(LIKE_KEY, JSON.stringify(map)); } catch {}
}

// Count how many of `favourites` appear in a resolved day menu (any meal).
export function favouritesInMenu(menu, favourites) {
  if (!menu || !favourites || favourites.size === 0) return [];
  const hits = new Set();
  const favLower = new Set([...favourites].map(f => String(f).toLowerCase().trim()));
  for (const meal of ["breakfast", "lunch", "snacks", "dinner"]) {
    for (const item of menu[meal] || []) {
      if (favourites.has(item) || favLower.has(String(item).toLowerCase().trim())) {
        hits.add(item);
      }
    }
  }
  return [...hits];
}

// Resolves the menu for a given weekday + calendar date (date picks the
// Week 1&3 vs Week 2&4 snack rotation using the published Monday anchor).
export function getMenuForDay(dayOfWeek, date) {
  return resolveMenu(BASE_MENU, MENU_OVERRIDES, date, getControls().payload.mess, [...DAILY_BREAKFAST, "Milk + Tea + Coffee"]);
}
export function getMealTimes(date) { return resolveMealTimes(date, getControls().payload.mess); }
export function getMessNotices(date) { return activeNotices(date, getControls().payload.mess); }

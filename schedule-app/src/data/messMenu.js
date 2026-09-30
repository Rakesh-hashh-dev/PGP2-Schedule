// Mess menu — updated 2026-10-01 from the institute's live mess sheet
// (Google Sheet id 1kNxgbR0SmtWNMHWP3aWaew7QpCeoQTZTwO9yX2Ajf-U), the same
// sheet the live feed (lib/messFeed.js) reads. This is the OFFLINE FALLBACK:
// online, the app overlays the live feed on top of this. Keep it in sync when
// the institute publishes a new cycle so first-paint / offline shows the
// right menu. Day keys follow Date#getDay(): 0 = Sunday … 6 = Saturday.

export const MEAL_TIMES = [
  { id: "breakfast", label: "Breakfast", start: "08:30", end: "10:30" },
  { id: "lunch", label: "Lunch", start: "13:00", end: "15:00" },
  { id: "snacks", label: "Snacks", start: "17:30", end: "18:30" },
  { id: "dinner", label: "Dinner", start: "20:00", end: "22:30" },
];

// Week-rotation anchor: a Monday that falls in a Week 1&3 week of the CURRENT
// menu cycle. Used to resolve Week 1&3 vs Week 2&4 snacks by parity. Re-anchor
// this whenever the institute publishes a new cycle (only the parity matters,
// not the exact date).
// 2026-09-11: Shifted anchor to Mon 2026-09-14 so that the week of Sep 07-13
// evaluates to Week 2&4 (resolving Thursday's snack as Vegetable Macaroni
// instead of Aloo Sandwich, matching what was actually served in the mess).
const MENU_START = new Date(2026, 8, 14);

// Served every day alongside the day's breakfast mains
export const DAILY_BREAKFAST = [
  "Bread + Butter + Jam", "Cornflakes + Milk", "Sprouts", "Boiled Egg", "Fruits",
];

export const BASE_MENU = {
  0: { // Sunday
    breakfast: ["Dosa", "Sambhar", "Coconut Chutney"],
    lunch: ["Plain Rice", "Aloo Chokha", "Baigan Bhaja", "Arhar Dal", "Boondi Raita", "Green Salad"],
    snacksW13: ["Pani Puri", "Tea"],
    snacksW24: ["Dhokla", "Tea"],
    dinner: ["Plain Rice", "Paneer Butter Masala", "Butter Chicken", "Chana Dal", "Roti", "Onion Laccha Salad", "Ice Cream"],
  },
  1: { // Monday
    breakfast: ["Uttapam", "Red Chutney", "Coconut Chutney"],
    lunch: ["Plain Rice", "Lobhiya Masala", "Navratan Korma", "Dal Makhni", "Buttermilk", "Green Salad"],
    snacksW13: ["Papdi Chat + Imly Chutney + Dahi", "Tea"],
    snacksW24: ["Dahi Bhalla + Imli + Green Chutney", "Tea"],
    dinner: ["Plain Rice", "Black Chana Masala Dry", "Aloo Tomato Sabzi", "Navratan Dal", "Poori", "Green Salad", "Kheer"],
  },
  2: { // Tuesday
    breakfast: ["Paneer Paratha", "Curd", "Green Chutney"],
    lunch: ["Jeera Rice", "Rajma Masala", "Beans Peas Masala", "Drumstick Sambhar + Masoor Dal", "Plain Curd", "Green Salad"],
    snacksW13: ["Bhel Puri", "Coffee"],
    snacksW24: ["Pyaz Pakoda", "Coffee"],
    dinner: ["Plain Rice", "Lauki Chana Masala", "Chole Curry", "Dal Tadka", "Roti", "Green Salad", "Tomato Onion Chutney"],
  },
  3: { // Wednesday
    breakfast: ["Idli + Vada + Omelette", "Sambhar", "Coconut Chutney"],
    lunch: ["Lemon Rice", "Kashmiri Aloo Dum", "Raw Banana Curry", "Arhar Dal", "Cucumber Raita", "Green Salad"],
    snacksW13: ["Misal Pav", "Tea"],
    snacksW24: ["Chole Kulche", "Tea"],
    dinner: ["Veg Biryani", "Paneer Tikka Masala", "Chicken Biryani", "Dal Tadka", "Roti", "Vinegar Onion & Raita", "Gulab Jamun"],
  },
  4: { // Thursday
    breakfast: ["Aloo Paratha", "Curd", "Green Chutney"],
    lunch: ["Plain Rice", "Kadhi Pakore", "Aloo Bhujiya", "Dal Lehsuni", "Boondi Raita", "Green Salad"],
    snacksW13: ["Samosa Chat", "Tea"],
    snacksW24: ["Masala Kachori", "Tea"],
    dinner: ["Veg Pulao", "Dahi Bhindi", "Soyabean Curry", "Arhar Dal", "Roti", "Green Salad", "Thecha"],
  },
  5: { // Friday
    breakfast: ["Tarri Poha + Omelette", "Matar Sabji", "Sev"],
    lunch: ["Onion Rice", "Aloo Matar Curry", "Veg Kofta", "Lauki Dal", "Boondi Raita", "Green Salad"],
    snacksW13: ["White Sauce Pasta", "Coffee"],
    snacksW24: ["Red Sauce Pasta", "Coffee"],
    dinner: ["Plain Rice", "Kadhai Paneer (Red Gravy)", "Kadhai Chicken", "Rasam", "Roti", "Green Salad", "Besan Laddu"],
  },
  6: { // Saturday
    breakfast: ["Moong Dal Chila", "Red Chutney", "Green Chutney"],
    lunch: ["Plain Rice", "Chole", "Bhature", "Dal Tadka", "Plain Curd", "Green Salad"],
    snacksW13: ["Aloo Sandwich", "Coffee"],
    snacksW24: ["Moong Pakode", "Coffee"],
    dinner: ["Onion Rice", "Aloo Bhujiya", "Mushroom Masala", "Dal Makhni", "Roti", "Green Salad", "Manchow Soup"],
  },
};

// ── Admin overrides (from system_config.flags.messMenuOverrides) ──────────
// Shape mirrors BASE_MENU but sparse: { [dayOfWeek]: { [meal]: [items] } }.
// Only the meals present override; everything else falls through to the
// bundled menu. App.jsx applies these once the cloud config loads.
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
  for (const meal of ["breakfast", "lunch", "snacks", "dinner"]) {
    for (const item of menu[meal] || []) if (favourites.has(item)) hits.add(item);
  }
  return [...hits];
}

// Resolves the menu for a given weekday + calendar date (date picks the
// Week 1&3 vs Week 2&4 snack rotation, counted from MENU_START).
export function getMenuForDay(dayOfWeek, date) {
  const base = BASE_MENU[dayOfWeek];
  if (!base) return null;
  const d = { ...base, ...(MENU_OVERRIDES[dayOfWeek] || {}) };
  const weeks = Math.floor((date - MENU_START) / (7 * 86400000));
  const isWeek24 = ((weeks % 2) + 2) % 2 === 1;
  const snacks = isWeek24 && (d.snacksW24 || []).length ? d.snacksW24 : (d.snacksW13 || []);
  return {
    breakfast: [...d.breakfast, ...DAILY_BREAKFAST, "Milk + Tea + Coffee"],
    lunch: d.lunch,
    snacks,
    dinner: d.dinner,
  };
}

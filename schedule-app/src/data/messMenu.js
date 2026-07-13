// Mess menu — transcribed from "public/NEW MENU JUNE' 26 - JULY' 26.xlsx"
// (MESS MENU IIM SAMBALPUR, 22 JUNE – 22 JULY 2026). When the institute
// publishes a new sheet, update the items here and redeploy.
// Day keys follow Date#getDay(): 0 = Sunday … 6 = Saturday.

export const MEAL_TIMES = [
  { id: "breakfast", label: "Breakfast", start: "08:30", end: "10:30" },
  { id: "lunch", label: "Lunch", start: "13:00", end: "15:00" },
  { id: "snacks", label: "Snacks", start: "17:30", end: "18:30" },
  { id: "dinner", label: "Dinner", start: "20:00", end: "22:30" },
];

// Menu cycle start (a Monday) — used to resolve Week 1&3 vs Week 2&4 snacks
const MENU_START = new Date(2026, 5, 22);

// Served every day alongside the day's breakfast mains
const DAILY_BREAKFAST = [
  "Bread + Butter + Jam", "Cornflakes + Milk", "Sprouts", "Boiled Egg", "Fruits",
];

const MENU = {
  0: { // Sunday
    breakfast: ["Dosa", "Sambhar", "Coconut Chutney"],
    lunch: ["Plain Rice", "Jeera Aloo with Amchur", "Dal Makhani", "Dahi Tidkari", "Plain Curd", "Green Salad"],
    snacksW13: ["Pani Puri", "Coffee"],
    snacksW24: [], // sheet leaves Week 2&4 Sunday blank → falls back to Week 1&3
    dinner: ["Plain Rice", "Paneer Butter Masala", "Chicken Kolhapuri", "Black Masoor Daal", "Roti", "Onion Laccha Salad", "Ice Cream"],
  },
  1: { // Monday
    breakfast: ["Uttapam", "Coconut Chutney", "Red Chutney"],
    lunch: ["Plain Rice", "Rajma Masala", "Daal Bukhara", "Kaddu Chatpata", "Boondi Raita", "Green Salad"],
    snacksW13: ["Kachori + Tamarind & Green Chutney", "Tea"],
    snacksW24: ["Papdi Chaat with Dahi & Chutney", "Tea"],
    dinner: ["Plain Rice", "Mix Veg", "Red Masoor Daal", "Besan Ke Gatte", "Roti", "Green Salad"],
  },
  2: { // Tuesday
    breakfast: ["Paneer Paratha", "Curd"],
    lunch: ["Jeera Rice", "Aloo Bhujia", "Daal Tadka", "Soya Curry", "Buttermilk", "Green Salad"],
    snacksW13: ["Corn Sandwich", "Coffee"],
    snacksW24: ["Veg Chowmein", "Coffee"],
    dinner: ["Plain Rice", "Chole Curry", "Navratan Dal", "Cabbage Matar", "Roti", "Green Salad", "Kheer"],
  },
  3: { // Wednesday
    breakfast: ["Tarri Poha", "Matar Sabji + Sev"],
    lunch: ["Plain Rice", "Kadhi Pakore", "Red Masoor Daal", "Kundru / Parwal Masala", "Boondi Raita", "Green Salad"],
    snacksW13: ["Chole Kulche + Onion & Lemon", "Coffee"],
    snacksW24: ["Fried Idli", "Coffee"],
    dinner: ["Veg Biryani", "Chicken Biryani", "Matar Paneer", "Roti", "Vinegar Onion & Raita", "Gulab Jamun"],
  },
  4: { // Thursday
    breakfast: ["Poori", "Aloo Tomato Sabzi"],
    lunch: ["Onion Rice", "Mix Veg Masala", "Chana Dal Fry", "Sambhar", "Plain Curd", "Green Salad"],
    snacksW13: ["Samosa + Tamarind Chutney", "Tea"],
    snacksW24: ["Onion Bhajji", "Tea"],
    dinner: ["Jeera Rice", "Mushroom Do Pyaza", "Dal Makhani", "Veg Manchurian", "Roti", "Onion Salad", "Hot n Sour Soup"],
  },
  5: { // Friday
    breakfast: ["Idly + Vada", "Sambhar", "Coconut Chutney"],
    lunch: ["Plain Rice", "Kurkuri Bhindi", "Dal Lehsuni", "Aloo Soyabean", "Lemon Water", "Green Salad"],
    snacksW13: ["Pav Bhaji", "Coffee"],
    snacksW24: ["Vada Pav", "Coffee"],
    dinner: ["Plain Rice", "Kadhai Paneer (Red Gravy)", "Butter Chicken", "Green Moong Daal", "Roti", "Green Salad", "Fruit Custard"],
  },
  6: { // Saturday
    breakfast: ["Aloo Paratha", "Green Chutney"],
    lunch: ["Chole Bhature", "Jeera Rice", "Black Masoor Daal", "Lassi", "Green Salad"],
    snacksW13: ["Red Sauce Pasta", "Tea"],
    snacksW24: ["Vegetable Macaroni", "Tea"],
    dinner: ["Veg Fried Rice", "Chilly Potato", "Mix Daal", "Mix Veg Kofta", "Roti", "Green Salad", "Sweet Corn Soup"],
  },
};

// Resolves the menu for a given weekday + calendar date (date picks the
// Week 1&3 vs Week 2&4 snack rotation, counted from MENU_START).
export function getMenuForDay(dayOfWeek, date) {
  const d = MENU[dayOfWeek];
  if (!d) return null;
  const weeks = Math.floor((date - MENU_START) / (7 * 86400000));
  const isWeek24 = ((weeks % 2) + 2) % 2 === 1;
  const snacks = isWeek24 && d.snacksW24.length ? d.snacksW24 : d.snacksW13;
  return {
    breakfast: [...d.breakfast, ...DAILY_BREAKFAST, "Milk + Tea + Coffee"],
    lunch: d.lunch,
    snacks,
    dinner: d.dinner,
  };
}

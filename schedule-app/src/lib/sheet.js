import Papa from "papaparse";
import { TERM, LEGEND, CLASSES } from "../data/schedule.js";

// After publishing the sheet to web as CSV (File → Share → Publish to web → CSV),
// paste the URL here. Leave empty to always use the snapshot fallback.
const SHEET_CSV_URL = "";

const SLOT_TIMES = [
  { start: "08:00", end: "09:30" },
  { start: "10:00", end: "11:30" },
  { start: "12:00", end: "13:30" },
  { start: "13:30", end: "14:30" },
  { start: "14:30", end: "16:00" },
  { start: "16:30", end: "18:00" },
  { start: "18:30", end: "20:00" },
  { start: "20:30", end: "22:00" },
];

function classifyType(cell) {
  const u = cell.toUpperCase();
  if (u.includes("LUNCH")) return "break";
  if (u.includes("YOGA") || u.includes("INDEPENDENCE") || u.includes("MILAD") || u.includes("HOLIDAY")) return "holiday";
  if (u.includes("EXAM") || u.includes("END TERM") || u.includes("REGISTRATION")) return "exam";
  return "class";
}

function parseCSV(csvText, legendMap) {
  const { data: rows } = Papa.parse(csvText, { skipEmptyLines: false });

  const classes = [];
  let currentDate = "";
  let currentDay = "";
  const sectionLabels = ["A", "B", "Single"];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 4) continue;

    const dateCell = (row[0] || "").trim();
    const dayCell = (row[1] || "").trim();
    if (dateCell) currentDate = dateCell;
    if (dayCell) currentDay = dayCell;

    const sectionCell = (row[2] || "").trim();
    const section = sectionLabels.find((s) => sectionCell.toUpperCase().includes(s.toUpperCase())) || sectionCell;
    if (!section || !currentDate) continue;

    for (let slot = 0; slot < 8; slot++) {
      const cell = (row[3 + slot] || "").trim();
      if (!cell) continue;

      const type = classifyType(cell);
      let code = "";
      let session = "";
      let name = cell;
      let faculty = "";
      let room = "";

      if (type === "class") {
        const match = cell.match(/^([A-Z]+)-(\d+)$/i);
        if (match) {
          code = match[1].toUpperCase();
          session = match[2];
          const entry = legendMap[code];
          if (entry) {
            name = entry.name;
            faculty = entry.faculty?.[section] || entry.faculty?.["A"] || entry.faculty?.["Single"] || "";
            room = entry.room?.[section] || entry.room?.["A"] || entry.room?.["Single"] || "";
          }
        }
      }

      const times = SLOT_TIMES[slot];
      if (!times) continue;

      classes.push({
        date: currentDate,
        day: currentDay,
        section,
        slot,
        start: times.start,
        end: times.end,
        type,
        code,
        session,
        name,
        faculty,
        room,
      });
    }
  }

  return classes;
}

export async function fetchSchedule() {
  if (!SHEET_CSV_URL) return { TERM, LEGEND, CLASSES };

  try {
    const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const freshClasses = parseCSV(text, LEGEND);
    if (freshClasses.length === 0) throw new Error("Empty parse result");
    return { TERM, LEGEND, CLASSES: freshClasses };
  } catch {
    return { TERM, LEGEND, CLASSES };
  }
}

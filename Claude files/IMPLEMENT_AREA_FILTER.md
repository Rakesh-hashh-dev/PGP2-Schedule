# Task: make the area quick-filter pills actually work

Right now every subject falls into "Other" because no `area` field exists in the data.
Fix that by adding an area map **in code** and tagging each course with it. All paths are
inside the `schedule-app/` project.

**Do NOT add area columns to the Google Sheet.** It's the college's view-only sheet, and
area is static course metadata — it belongs in our own code, not in the live timetable.

---

## 1. Create `src/data/areas.js`

```js
// Academic area for each course code. The "?" lines are judgment calls — adjust freely.
export const AREA = {
  // Finance & Accounting
  SAPM: "F&A", FPWM: "F&A", IB: "F&A", OFD: "F&A",
  // Marketing
  BM: "MKTG", AMR: "MKTG", BBM: "MKTG",
  PP:  "MKTG",   // Pricing and Policy — could be Economics
  PMA: "MKTG",   // Product Management and Analytics — could be ISM
  // Information Systems / Digital
  AIB: "ISM", ADE: "ISM", BAMD: "ISM", DVB: "ISM",
  DPM:  "ISM",   // Digital Product Management — could be MKTG/STM
  TCBA: "ISM",   // Tech Consulting & Business Analysis — could be STM
  // Strategy
  CS: "STM", IBS: "STM",
  MPB: "STM",    // Managing Platform Business — could be ISM
  // Operations
  PM: "OPS", SCM: "OPS",
  // OB & HR
  GPP: "OB&HR",  // Games People Play — could be Strategy (game theory)
};
```

These six area codes match the existing `AREA_LABELS` map in `SubjectFilter`: `F&A`,
`MKTG`, `ISM`, `STM`, `OPS`, `OB&HR`.

---

## 2. Tag the data with `area` in `src/lib/sheet.js`

Import the map and add this helper:

```js
import { AREA } from "../data/areas.js";

function withAreas(data) {
  const legend = {};
  for (const code in data.LEGEND) {
    legend[code] = { ...data.LEGEND[code], area: AREA[code] || "Other" };
  }
  const classes = (data.CLASSES || []).map((c) => ({
    ...c,
    area: c.code ? (AREA[c.code] || "Other") : "",
  }));
  return { ...data, LEGEND: legend, CLASSES: classes };
}
```

Then wrap **every** value `fetchSchedule()` returns in `withAreas(...)` — both the live/feed
path and the snapshot/fallback path — so `area` is always present. (Example: `return
withAreas(SNAPSHOT);` and `return withAreas({ CHANGES: [], ...data });`.)

This populates **both** `LEGEND[code].area` and each class record's `c.area`, so the filter
works no matter which one it reads.

---

## 3. Wire it into the existing `SubjectFilter` (you have this file; I don't)

Open `src/components/SubjectFilter.jsx` and check where the area pills get a subject's area:

- If it reads `legend[code].area` → it now works; no change needed.
- If it reads a per-class `c.area` → also populated now; no change needed.
- If `AREA_LABELS`/grouping reads the area from somewhere else, point it at
  `legend[code].area` (which step 2 now fills in).

Also confirm the behaviour the pills are supposed to have:
- Clicking an area pill (e.g. "Finance") filters the **timeline/week view** to only that
  area's subjects.
- Clicking **"All"** resets to everything.
If selecting a pill doesn't actually filter the schedule yet, wire the selected area into
the same `mine`/visible filter that the per-subject chips already use (intersect on
`AREA[c.code] === selectedArea`).

Keep the existing design tokens and styling untouched.

---

## Verify

- The pills now read "Finance", "ISM", "Marketing", "OB&HR", "Operations", "Strategy" with
  real counts; "Other" is empty (or only holds a code you haven't mapped yet).
- Clicking "Finance" shows only SAPM / FPWM / IB / OFD in the timeline; "All" resets.
- `npm run dev` builds cleanly with no unused-import warnings.
- Nothing in the Google Sheet was changed.

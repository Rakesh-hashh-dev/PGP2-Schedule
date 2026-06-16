# Task: apply all remaining app changes (go live + changes panel + area filter)

Bring the files below to the described state. Reconcile with what's already there —
**don't duplicate** code that already exists; just ensure the end state matches. All paths
are inside `schedule-app/`.

**Do NOT touch:**
- The Google Sheet (area/room data lives in code, not the sheet).
- `src/data/schedule.js` and the Apps Script `Code.gs` — already updated separately. If
  `src/data/schedule.js` exports a `WAI` course, you have the current version; don't
  regenerate it.

---

## 1. Create `src/data/areas.js`

```js
// Academic area per course code. "?" lines are judgment calls — adjust freely.
export const AREA = {
  // Finance & Accounting
  SAPM: "F&A", FPWM: "F&A", IB: "F&A", OFD: "F&A",
  // Marketing
  BM: "MKTG", AMR: "MKTG", BBM: "MKTG",
  PP:  "MKTG",   // Pricing and Policy — could be Economics
  PMA: "MKTG",   // Product Management and Analytics — could be ISM
  // Information Systems / Digital
  AIB: "ISM", ADE: "ISM", BAMD: "ISM", DVB: "ISM",
  WAI: "ISM",    // Working with AI
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

---

## 2. `src/lib/sheet.js` — make it match this exactly

This reads the live Apps Script JSON feed (with the bundled snapshot as fallback) **and**
tags every course with its `area`. Replace any older CSV/papaparse version with this.

```js
// src/lib/sheet.js
import { TERM, LEGEND, CLASSES } from "../data/schedule.js";
import { AREA } from "../data/areas.js";

// Paste the Apps Script Web App URL (ends in /exec). Until then, the snapshot is used.
const FEED_URL = "PASTE_YOUR_WEB_APP_EXEC_URL_HERE";

const SNAPSHOT = { TERM, LEGEND, CLASSES, CHANGES: [] };

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

export async function fetchSchedule() {
  if (!FEED_URL || FEED_URL.startsWith("PASTE_")) return withAreas(SNAPSHOT);
  try {
    const res = await fetch(FEED_URL, { redirect: "follow" }); // plain GET → no CORS preflight
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (data && data.error) throw new Error(data.error);
    if (!data || !Array.isArray(data.CLASSES) || data.CLASSES.length === 0) throw new Error("empty feed");
    return withAreas({ CHANGES: [], ...data });
  } catch (err) {
    console.warn("[sheet] live feed failed, using snapshot:", err.message);
    return withAreas(SNAPSHOT);
  }
}

export { SNAPSHOT };
```

`papaparse` is now unused — remove it from `package.json` and re-run `npm install`.

---

## 3. Create `src/components/RecentChanges.jsx` (if it doesn't exist)

```jsx
import { Bell } from "lucide-react";

function relTime(iso) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.round(hrs / 24) + "d ago";
}

export default function RecentChanges({ changes }) {
  if (!changes || changes.length === 0) return null;
  return (
    <section className="rc">
      <div className="rc-head">
        <span className="rc-title"><Bell size={14} /> Recent changes</span>
        <span className="rc-count">{changes.length}</span>
      </div>
      <ul className="rc-list">
        {changes.slice(0, 8).map((c) => (
          <li key={c.id} className="rc-item">
            <span className={`rc-dot rc-${c.kind}`} />
            <span className="rc-text">{c.text}</span>
            <span className="rc-time">{relTime(c.ts)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

---

## 4. `src/App.jsx` — ensure these behaviours (reconcile with current code)

The app must:
1. Load schedule data via `fetchSchedule()` on mount.
2. Re-fetch every 10 minutes **without resetting the user's course/area selection** — only
   initialise the default selection on the first load.
3. Destructure `CHANGES` from the loaded data and render `<RecentChanges changes={CHANGES} />`
   below the Today/Week view.

Reference for the load effect (adapt to the existing state setters):

```jsx
import RecentChanges from "./components/RecentChanges.jsx";
// ...
useEffect(() => {
  let alive = true;
  const load = (first) =>
    fetchSchedule().then((data) => {
      if (!alive) return;
      setScheduleData(data);
      setSyncedAt(new Date());
      if (first) setMine(new Set(Object.keys(data.LEGEND))); // first load only
    });
  load(true);
  const id = setInterval(() => load(false), 10 * 60 * 1000);
  return () => { alive = false; clearInterval(id); };
}, []);
```

If `App.jsx` already polls and renders `RecentChanges` (from an earlier change), leave that
intact — just make sure (a) it uses `fetchSchedule()` from `sheet.js`, (b) the 10-minute
poll does NOT reset the filter selection, and (c) `CHANGES` is passed to `RecentChanges`.

---

## 5. `src/styles.css` — append if not already present

```css
/* Recent changes */
.rc { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 14px 16px; margin-top: 12px; }
.rc-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.rc-title { display: inline-flex; align-items: center; gap: 7px; font-family: var(--display); font-weight: 700; font-size: 15px; }
.rc-count { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
.rc-list { list-style: none; margin: 0; padding: 0; }
.rc-item { display: flex; align-items: center; gap: 9px; padding: 8px 0; border-top: 1px solid var(--line); font-size: 13.5px; }
.rc-item:first-child { border-top: none; }
.rc-dot { width: 7px; height: 7px; border-radius: 50%; flex: none; background: var(--muted); }
.rc-added { background: var(--live); }
.rc-removed { background: #C0392B; }
.rc-moved { background: var(--amber); }
.rc-course { background: var(--violet); }
.rc-update { background: var(--muted); }
.rc-text { flex: 1; min-width: 0; }
.rc-time { font-family: var(--mono); font-size: 11px; color: var(--muted); white-space: nowrap; flex: none; }
```

---

## 6. `src/components/SubjectFilter.jsx` — verify the area pills work

`withAreas` now fills both `LEGEND[code].area` and each class's `c.area`. Confirm the area
pills read the area from one of those, that "Other" is no longer catching everything, and
that clicking an area pill filters the Today/Week view (and "All" resets). Fix the wiring if
needed; keep the existing styling.

---

## Notes (do separately, not code)

- Paste the real Apps Script `/exec` URL into `FEED_URL` in `src/lib/sheet.js`.
- In Vercel → Settings → Build & Deployment, set **Root Directory** to `schedule-app`.

## Verify

- `npm run dev` builds cleanly, no unused-import warnings (papaparse gone).
- On the snapshot (placeholder `FEED_URL`): schedule renders, SAPM shows room A01, TCBA shows
  A02, and the area pills show real areas with "Other" empty.
- After pasting a real `FEED_URL`: editing a sheet cell appears within ~10 min (or on Sync)
  and shows in the Recent changes panel; the filter selection survives the 10-min poll.

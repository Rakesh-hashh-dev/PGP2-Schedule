# Task: make the schedule app go live + show changes

Implement the changes below in the existing Vite project. All paths are inside the
`schedule-app/` folder. **Edit only the files named here; do not rebuild or restyle the
other components, and keep the existing design tokens and look untouched.**

## Why

Two problems to fix:
1. The app currently runs on the bundled snapshot only — `SHEET_CSV_URL` is empty, so it
   never fetches live data.
2. The CSV path in `src/lib/sheet.js` is buggy and won't be used: it reads
   `legend[code].faculty[section]`/`.room[section]` but `LEGEND` only holds
   `{name, credits}` (faculty/room live on each `CLASSES` record), and it stores dates as
   `"15-Jun"` while the rest of the app expects ISO `"2026-06-15"`.

The fix is to stop parsing CSV in the browser and instead read the **Apps Script JSON
feed**, which already returns the exact shape the app uses (ISO dates, `faculty`, `room`)
plus a `CHANGES` array — and keeps the sheet private.

---

## 1. Replace `src/lib/sheet.js` entirely

Delete the CSV/papaparse logic. Replace the whole file with:

```js
// src/lib/sheet.js
import { TERM, LEGEND, CLASSES } from "../data/schedule.js";

// Paste the Apps Script Web App URL (ends in /exec). Until then, the app uses
// the bundled snapshot below.
const FEED_URL = "PASTE_YOUR_WEB_APP_EXEC_URL_HERE";

const SNAPSHOT = { TERM, LEGEND, CLASSES, CHANGES: [] };

export async function fetchSchedule() {
  if (!FEED_URL || FEED_URL.startsWith("PASTE_")) return SNAPSHOT;
  try {
    const res = await fetch(FEED_URL, { redirect: "follow" }); // plain GET → no CORS preflight
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (data && data.error) throw new Error(data.error);
    if (!data || !Array.isArray(data.CLASSES) || data.CLASSES.length === 0) throw new Error("empty feed");
    return { CHANGES: [], ...data };
  } catch (err) {
    console.warn("[sheet] live feed failed, using snapshot:", err.message);
    return SNAPSHOT;
  }
}

export { SNAPSHOT };
```

`papaparse` is now unused — remove it from `package.json` dependencies and re-run
`npm install` (optional cleanup).

---

## 2. Edit `src/App.jsx`

**2a. Add the import** (next to the other component imports):

```js
import RecentChanges from "./components/RecentChanges.jsx";
```

**2b. Replace the initial-fetch effect** so it polls every 10 minutes and only sets the
default course selection on the first load (so polling never resets the user's filter).

Find:

```js
  useEffect(() => {
    fetchSchedule().then((data) => {
      setScheduleData(data);
      setMine(new Set(Object.keys(data.LEGEND)));
    });
  }, []);
```

Replace with:

```js
  useEffect(() => {
    let alive = true;
    const load = (first) =>
      fetchSchedule().then((data) => {
        if (!alive) return;
        setScheduleData(data);
        setSyncedAt(new Date());
        if (first) setMine(new Set(Object.keys(data.LEGEND)));
      });
    load(true);
    const id = setInterval(() => load(false), 10 * 60 * 1000); // re-check every 10 min
    return () => { alive = false; clearInterval(id); };
  }, []);
```

**2c. Pull `CHANGES` out of state.** Find:

```js
  const { TERM, LEGEND, CLASSES } = scheduleData || { TERM: null, LEGEND: {}, CLASSES: [] };
```

Replace with:

```js
  const { TERM, LEGEND, CLASSES, CHANGES } = scheduleData || { TERM: null, LEGEND: {}, CLASSES: [], CHANGES: [] };
```

**2d. Render the changes panel and update the footer.** Find:

```jsx
      {view === "today"
        ? <Timeline list={todayList} current={current} now={now} />
        : <WeekAgenda visible={visible} now={now} offset={weekOffset} setOffset={setWeekOffset} todayISO={todayISO} />}

      <footer className="foot">Snapshot · connect live to enable change alerts</footer>
```

Replace with:

```jsx
      {view === "today"
        ? <Timeline list={todayList} current={current} now={now} />
        : <WeekAgenda visible={visible} now={now} offset={weekOffset} setOffset={setWeekOffset} todayISO={todayISO} />}

      <RecentChanges changes={CHANGES} />

      <footer className="foot">Auto-syncs from the live timetable sheet every few minutes</footer>
```

---

## 3. Create `src/components/RecentChanges.jsx`

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

## 4. Append to `src/styles.css`

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

## 5. Notes (not code — for me to action separately)

- After editing, paste the real Apps Script `/exec` URL into `FEED_URL` in
  `src/lib/sheet.js`.
- In Vercel → project Settings → Build & Deployment, set **Root Directory** to
  `schedule-app` (the repo root contains `schedule-app/` plus a `Claude files/` folder, so
  the build needs to know where `package.json` is).

## Verify when done

- `npm run dev` builds with no errors and no unused-import warnings for papaparse.
- With `FEED_URL` still on the placeholder, the app loads on the snapshot as before.
- After pasting a real `FEED_URL`, the schedule matches the sheet, and editing a sheet
  cell (e.g. a room) shows up within ~10 min — or on Sync — and appears in the new
  "Recent changes" panel.
- The Subject Filter selection is NOT reset when the 10-minute poll runs.

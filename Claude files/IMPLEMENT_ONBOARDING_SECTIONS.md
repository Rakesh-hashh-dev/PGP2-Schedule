# Task: per-course-section onboarding + filtering

> ⚠️ **This design REPLACES the onboarding page currently in the app.** The existing
> onboarding asks for one global Section A/B for the whole student. That is wrong — a
> student's section differs by course (Section A for some electives, B for others; some
> courses are single-section with no choice). Remove the current onboarding entirely and
> replace it with the per-course version below, then rewire the app to filter by it.

The redesigned `Login.jsx` (welcome screen) and its `.wl-*` CSS are unchanged — keep them.
Only the onboarding and the section-filtering logic change.

Data model for a student's setup (the new shape):
```
{ courses: { SAPM: "A", CS: "B", TCBA: "Single", ... } }   // code -> their section
```

---

## 0. Remove the existing (global-section) onboarding

Before adding the new version, strip out the old one so nothing conflicts:
- The old `src/components/Onboarding.jsx` (single A/B section card + course chips) — overwrite
  it in step 1.
- In `src/App.jsx`: the old global `section` state, the old `setup` shape `{ section, courses: [...] }`,
  and any `<Onboarding … onDone={({section, courses}) => …}>` wiring — replaced in step 2.
- The old `.ob-*` CSS rules — replaced by the block in step 3.
- Any saved setup in the old format is ignored automatically (the new `readSetup` rejects it),
  so existing users simply re-onboard once.

---

## 1. Replace `src/components/Onboarding.jsx`

Receives `legend` (code → {name, area}) and `sectionsByCode` (code → array of sections that
exist for it, e.g. `["A","B"]` or `["Single"]`). Calls `onDone(courses)` with the
`{code: section}` map.

```jsx
import { useState, useMemo } from "react";
import { GraduationCap, ArrowRight, Info } from "lucide-react";

const AREA_LABEL = { "F&A": "Finance & Accounting", MKTG: "Marketing", ISM: "Information Systems", STM: "Strategy", OPS: "Operations", "OB&HR": "OB & HR", Other: "Other" };
const AREA_ORDER = ["F&A", "MKTG", "ISM", "STM", "OPS", "OB&HR", "Other"];

export default function Onboarding({ legend, sectionsByCode, onDone }) {
  const [picked, setPicked] = useState({}); // code -> section

  const offered = (code) => {
    const s = (sectionsByCode && sectionsByCode[code]) || ["Single"];
    return s.length ? s : ["Single"];
  };

  const groups = useMemo(() => {
    const byArea = {};
    Object.entries(legend || {}).forEach(([code, info]) => {
      const a = info.area || "Other";
      (byArea[a] = byArea[a] || []).push([code, info.name]);
    });
    Object.values(byArea).forEach((l) => l.sort((x, y) => x[1].localeCompare(y[1])));
    return AREA_ORDER.map((a) => [a, byArea[a] || []]).filter(([, l]) => l.length);
  }, [legend]);

  const allCodes = useMemo(() => Object.keys(legend || {}), [legend]);
  const count = Object.keys(picked).length;
  const allOn = count === allCodes.length && allCodes.length > 0;

  const toggle = (code) => setPicked((p) => {
    const n = { ...p };
    if (n[code]) delete n[code]; else n[code] = offered(code)[0];
    return n;
  });
  const setSec = (code, s) => setPicked((p) => ({ ...p, [code]: s }));
  const selectAll = () => setPicked(allOn ? {} : Object.fromEntries(allCodes.map((c) => [c, offered(c)[0]])));

  return (
    <div className="ob">
      <div className="ob-bg" aria-hidden="true" />
      <header className="ob-top">
        <div className="ob-brand"><span className="ob-logo"><GraduationCap size={18} /></span><span className="ob-word">Term Timetable</span></div>
        <span className="ob-step">Setup</span>
      </header>

      <div className="ob-body">
        <h1 className="ob-title">Set up your timetable.</h1>
        <p className="ob-sub">Pick your courses — and your section for each. We'll show only your classes, with no clashes.</p>
        <div className="ob-hint"><Info size={14} /> Your section can differ per course — choose A or B on each.</div>

        <div className="ob-block">
          <div className="ob-label-row">
            <span className="ob-label">Your courses &amp; sections</span>
            <button className="ob-all" onClick={selectAll}>{allOn ? "Clear all" : "Select all"}</button>
          </div>

          {groups.map(([area, list]) => (
            <div key={area} className="ob-grp">
              <div className="ob-grp-h">{AREA_LABEL[area] || area}</div>
              <div className="oc-list">
                {list.map(([code, name]) => {
                  const on = !!picked[code];
                  const opts = offered(code);
                  const split = opts.length > 1;
                  return (
                    <div key={code} className={`oc ${on ? "on" : ""}`}>
                      <button className="oc-main" onClick={() => toggle(code)} aria-pressed={on}>
                        <span className="oc-k">{code}</span>
                        <span className="oc-n">{name}</span>
                      </button>
                      <div className="oc-right">
                        {on && split && (
                          <div className="oc-seg" role="group" aria-label={`${code} section`}>
                            {opts.map((s) => (
                              <button key={s} className={picked[code] === s ? "on" : ""} onClick={() => setSec(code, s)}>
                                {s === "Single" ? "All" : s}
                              </button>
                            ))}
                          </div>
                        )}
                        {on && !split && <span className="oc-single">All</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="ob-foot">
        <span className="ob-count">{count} {count === 1 ? "course" : "courses"} selected</span>
        <button className="ob-cta" disabled={count === 0} onClick={() => onDone({ ...picked })}>
          Show my schedule <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
```

---

## 2. Rewire `src/App.jsx`

**2a. Import Onboarding** and add setup persistence helpers (module scope):
```jsx
import Onboarding from "./components/Onboarding.jsx";

const SETUP_KEY = "pgp2.setup";
function readSetup() {
  try {
    const s = JSON.parse(localStorage.getItem(SETUP_KEY));
    // accept only the new shape {courses:{code:section}}; ignore the old {section, courses:[...]}
    if (s && s.courses && !Array.isArray(s.courses) && typeof s.courses === "object") return s;
    return null;
  } catch { return null; }
}
function saveSetup(s) { try { localStorage.setItem(SETUP_KEY, JSON.stringify(s)); } catch (e) {} }
```

**2b. State.** Remove the global section state:
```jsx
const [section, setSection] = useState("A");   // DELETE this line
```
Add, alongside the other `useState` calls:
```jsx
const [enrolled, setEnrolled] = useState(null); // { code: section }
const [setup, setSetup] = useState(null);
```
(Keep `const [mine, setMine] = useState(null);` — it stays as the in-app "shown courses" filter.)

**2c. Apply saved setup on first load.** In the data-loading effect, replace:
```jsx
        if (first) setMine(new Set(Object.keys(data.LEGEND)));
```
with:
```jsx
        if (first) {
          const saved = readSetup();
          if (saved && saved.courses) {
            setEnrolled(saved.courses);
            setMine(new Set(Object.keys(saved.courses)));
            setSetup(saved);
          }
        }
```

**2d. Derive which sections exist per course** (for onboarding) — add near the other `useMemo`s:
```jsx
const sectionsByCode = useMemo(() => {
  const m = {};
  CLASSES.forEach((c) => {
    if (c.type === "class" && c.code) (m[c.code] = m[c.code] || new Set()).add(c.section);
  });
  const out = {};
  Object.keys(m).forEach((k) => { out[k] = [...m[k]].sort(); });
  return out;
}, [CLASSES]);
```

**2e. Filter by per-course section.** Replace the `visible` memo with:
```jsx
const visible = useMemo(() => {
  if (!enrolled || !mine) return [];
  const seen = new Set();
  return CLASSES.filter((c) => {
    if (c.type === "class") {
      const sec = enrolled[c.code];
      return sec !== undefined && c.section === sec && mine.has(c.code);
    }
    const key = c.date + c.slot + c.name;
    if (seen.has(key)) return false; seen.add(key); return true;
  });
}, [CLASSES, enrolled, mine]);
```

**2f. Limit the in-app filter to enrolled courses.** Add:
```jsx
const enrolledLegend = useMemo(() => {
  const out = {};
  if (enrolled) Object.keys(enrolled).forEach((c) => { if (LEGEND[c]) out[c] = LEGEND[c]; });
  return out;
}, [enrolled, LEGEND]);
```
and change the SubjectFilter usage to `legend={enrolledLegend}`:
```jsx
<SubjectFilter legend={enrolledLegend} mine={mine} setMine={setMine} />
```

**2g. Onboarding handler** (inside `AppCore`, near `handleSync`):
```jsx
function handleOnboardingDone(courses) {     // courses = { code: section }
  const s = { courses };
  saveSetup(s);
  setEnrolled(courses);
  setMine(new Set(Object.keys(courses)));
  setSetup(s);
}
```

**2h. Render gate.** Replace:
```jsx
  if (!isLoaded) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!isSignedIn) return <Login />;
  if (!scheduleData || !mine) return <div className="loading-screen"><div className="spinner" /></div>;
```
with:
```jsx
  if (!isLoaded) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!isSignedIn) return <Login />;
  if (!scheduleData) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!setup) return <Onboarding legend={LEGEND} sectionsByCode={sectionsByCode} onDone={handleOnboardingDone} />;
```

**2i. Remove the global section toggle from the header.** Delete the `.seg` segmented control
block (the `<div className="seg">…Sec {s}…</div>`) — section is per-course now, so a global
A/B switch no longer applies. (Optional: add a small "Edit setup" button that does
`localStorage.removeItem(SETUP_KEY); setSetup(null); setEnrolled(null);` to re-run onboarding.)

---

## 3. CSS — use this `.ob-*/.oc-*` block (replaces the earlier onboarding CSS)

Append to `src/styles.css` (tokens + font `@import` already exist at the top):

```css
/* ---------- Onboarding (per-course sections) ---------- */
.ob{font-family:var(--body);background:var(--bone);color:var(--text);min-height:100vh;min-height:100dvh;display:flex;flex-direction:column;position:relative;overflow:hidden;}
.ob-bg{position:absolute;inset:0;background:radial-gradient(55% 40% at 85% 2%,rgba(31,169,113,.09),transparent 60%);pointer-events:none;}
.ob-top{display:flex;align-items:center;justify-content:space-between;padding:20px clamp(18px,5vw,40px);z-index:1;}
.ob-brand{display:flex;align-items:center;gap:10px;}
.ob-logo{width:34px;height:34px;border-radius:10px;background:var(--ink);color:#fff;display:grid;place-items:center;}
.ob-word{font-family:var(--display);font-weight:700;font-size:15.5px;}
.ob-step{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);border:1px solid var(--line);border-radius:99px;padding:5px 11px;}
.ob-body{flex:1;overflow-y:auto;width:100%;max-width:600px;margin:0 auto;padding:8px clamp(18px,5vw,40px) 120px;z-index:1;animation:ob-rise .5s ease both;}
.ob-title{font-family:var(--display);font-weight:800;font-size:clamp(30px,6vw,40px);letter-spacing:-1px;margin:6px 0 10px;}
.ob-sub{font-size:15px;line-height:1.5;color:var(--muted);max-width:460px;margin:0 0 16px;}
.ob-hint{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--muted);background:var(--card);border:1px solid var(--line);border-radius:10px;padding:9px 12px;margin-bottom:26px;}
.ob-hint svg{color:var(--live);flex:none;}
.ob-label-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;}
.ob-label{font-family:var(--mono);font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);}
.ob-all{background:none;border:none;color:var(--violet,#6D5BD0);font-family:var(--body);font-weight:600;font-size:13px;cursor:pointer;}
.ob-grp{margin-top:18px;}
.ob-grp-h{font-size:12px;font-weight:700;color:var(--muted);margin-bottom:9px;}
.oc-list{display:flex;flex-direction:column;gap:8px;}
.oc{display:flex;align-items:center;gap:8px;background:var(--card);border:1.5px solid var(--line);border-radius:12px;padding:7px 10px 7px 7px;transition:border-color .12s,background .12s;}
.oc.on{border-color:var(--ink);background:var(--card-hi,#F7F5EF);}
.oc-main{flex:1;display:flex;align-items:center;gap:10px;background:none;border:none;cursor:pointer;text-align:left;padding:5px 4px;min-width:0;}
.oc-k{font-family:var(--mono);font-weight:700;font-size:11px;background:var(--ink);color:#fff;border-radius:6px;padding:3px 6px;flex:none;}
.oc.on .oc-k{background:var(--live);}
.oc-n{font-size:13.5px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.oc-right{flex:none;display:flex;align-items:center;min-height:30px;}
.oc-seg{display:inline-flex;background:#E9E5DA;border-radius:8px;padding:2px;}
.oc-seg button{border:none;background:transparent;font-family:var(--mono);font-weight:700;font-size:12px;color:var(--muted);padding:5px 12px;border-radius:6px;cursor:pointer;}
.oc-seg button.on{background:var(--card);color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.12);}
.oc-single{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);background:#EFEDE5;border-radius:6px;padding:5px 9px;}
.ob-foot{position:fixed;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px clamp(18px,5vw,40px);background:rgba(243,241,234,.86);backdrop-filter:blur(10px);border-top:1px solid var(--line);z-index:2;}
.ob-count{font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums;}
.ob-cta{display:inline-flex;align-items:center;gap:9px;background:var(--ink);color:#fff;border:none;border-radius:12px;font-family:var(--body);font-weight:600;font-size:15.5px;padding:14px 22px;cursor:pointer;transition:transform .15s ease,opacity .15s ease;box-shadow:0 12px 26px -14px rgba(21,24,43,.8);}
.ob-cta:hover:not(:disabled){transform:translateY(-2px);}
.ob-cta:disabled{opacity:.4;cursor:not-allowed;box-shadow:none;}
.ob-cta svg{transition:transform .2s ease;}
.ob-cta:hover:not(:disabled) svg{transform:translateX(3px);}
@keyframes ob-rise{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:none;}}
@media (max-width:420px){.ob-foot{flex-direction:column;align-items:stretch;gap:8px;}.ob-cta{justify-content:center;}.ob-count{text-align:center;}.oc-n{font-size:13px;}}
@media (prefers-reduced-motion:reduce){.ob-body{animation:none!important;}.oc,.ob-cta{transition:none!important;}}
```

---

## Verify

- `npm run dev`: first run after sign-in shows onboarding. Selecting a split course (e.g. CS)
  reveals an A/B toggle; a single-section course (e.g. TCBA) shows "All" with no choice.
- After Continue, the timetable shows each course at *its chosen section's* time — e.g. CS at
  the B times and SAPM at the A times if that's what you picked.
- The header no longer has a global Sec A/B switch.
- Reload skips onboarding; clearing `localStorage` (`pgp2.setup`) re-runs it.

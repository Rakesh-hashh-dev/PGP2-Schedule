# Task: Phase 3 — sync setup + attendance to Supabase per user

Layer cloud sync on top of the working localStorage cache. Onboarding setup goes to a
`profiles` row; attendance marks go to the `attendance` table. localStorage stays as the
instant/offline cache; Supabase becomes the source of truth that reconciles on sign-in. All
paths are inside `schedule-app/`.

## Prerequisites (already done)
- Part C complete: real Clerk login on, `src/lib/supabase.js` exists, the console check returned `{ data: [], error: null }`.
- Supabase has the `profiles` and `attendance` tables with RLS (Phase 1).

## Current state to reconcile (don't duplicate)
- `src/lib/attendance.js` exports `sessionKey(c)` (= `` `${date}_${start}_${code}_${section}` ``), `loadAttendance()` (sync local read), `saveAttendance(data)` (sync local write).
- `src/App.jsx` has inline `SETUP_KEY = "pgp2.setup"`, `readSetup()`, `saveSetup(s)` (shape `{ courses: {code: section} }`), and `AppCore({ isSignedIn, isLoaded, signOut })`. Keep all of that — we add to it.

---

## 1. Extend `src/lib/attendance.js`

Add the Supabase import at the top, and two new exports at the bottom. Leave the existing
`sessionKey` / `loadAttendance` / `saveAttendance` exactly as they are.

```js
// add at the top, with the other imports
import { supabase } from "./supabase.js";
```

```js
// add at the bottom

// Pull cloud rows, merge with the local cache, push any local-only marks up once.
export async function syncAttendanceFromCloud(userId) {
  const local = loadAttendance();
  if (!userId) return local;
  const { data, error } = await supabase.from("attendance").select("session_key,status");
  if (error || !data) return local;                       // offline -> cache
  const remote = {};
  data.forEach((r) => { remote[r.session_key] = r.status; });

  const localOnly = Object.entries(local).filter(([k]) => !(k in remote));
  if (localOnly.length) {
    await supabase.from("attendance").upsert(
      localOnly.map(([session_key, status]) => ({ user_id: userId, session_key, status })),
      { onConflict: "user_id,session_key" }
    );
    localOnly.forEach(([k, v]) => { remote[k] = v; });
  }
  saveAttendance(remote);
  return remote;
}

// Persist one mark to the cloud (fire-and-forget). status === null clears it.
export async function pushMark(userId, key, status) {
  if (!userId) return;                                    // dev / no session: stays local-only
  try {
    if (status === null) await supabase.from("attendance").delete().eq("session_key", key);
    else await supabase.from("attendance").upsert(
      { user_id: userId, session_key: key, status },
      { onConflict: "user_id,session_key" }
    );
  } catch (e) { /* stays cached; re-syncs on next sync */ }
}
```

## 2. Create `src/lib/profile.js`

Uses the same `pgp2.setup` key and `{ courses }` shape as `App.jsx`, so the cache stays
consistent.

```js
import { supabase } from "./supabase.js";

const SETUP_KEY = "pgp2.setup";
function readLocal() {
  try {
    const s = JSON.parse(localStorage.getItem(SETUP_KEY));
    if (s && s.courses && !Array.isArray(s.courses) && typeof s.courses === "object") return s;
    return null;
  } catch { return null; }
}
function writeLocal(s) { try { localStorage.setItem(SETUP_KEY, JSON.stringify(s)); } catch (e) {} }

// On sign-in: load the cloud profile; if none in cloud but one cached locally, migrate it up.
export async function syncProfileFromCloud(userId) {
  const local = readLocal();
  if (!userId) return local;
  const { data, error } = await supabase.from("profiles").select("courses").maybeSingle();
  if (error) return local;
  if (data && data.courses && Object.keys(data.courses).length) {
    const s = { courses: data.courses };
    writeLocal(s);
    return s;
  }
  if (local) {                                            // first cloud save = migrate local up
    await supabase.from("profiles").upsert(
      { user_id: userId, courses: local.courses, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    return local;
  }
  return null;                                            // -> show onboarding
}

// Save the per-course section map (cache + cloud).
export async function pushProfile(userId, courses) {
  const s = { courses };
  writeLocal(s);
  if (!userId) return s;
  try {
    await supabase.from("profiles").upsert(
      { user_id: userId, courses, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  } catch (e) { /* cached; re-syncs next load */ }
  return s;
}
```

## 3. Edits to `src/App.jsx`

**3a. Imports.** Replace:
```jsx
import { loadAttendance, saveAttendance, sessionKey } from "./lib/attendance.js";
```
with:
```jsx
import { loadAttendance, saveAttendance, sessionKey, syncAttendanceFromCloud, pushMark } from "./lib/attendance.js";
import { syncProfileFromCloud, pushProfile } from "./lib/profile.js";
```

**3b. Pass `userId` into AppCore.** Replace:
```jsx
function AppCore({ isSignedIn, isLoaded, signOut }) {
```
with:
```jsx
function AppCore({ isSignedIn, isLoaded, signOut, userId }) {
```

**3c. Add a `cloudChecked` flag + the sync effect.** Replace:
```jsx
  const [weather, setWeather] = useState(null);
```
with:
```jsx
  const [weather, setWeather] = useState(null);
  const [cloudChecked, setCloudChecked] = useState(false);

  // Reconcile setup + attendance from Supabase once we have a real signed-in user.
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const p = await syncProfileFromCloud(userId);
      if (alive && p?.courses) { setEnrolled(p.courses); setMine(new Set(Object.keys(p.courses))); setSetup(p); }
      const a = await syncAttendanceFromCloud(userId);
      if (alive) setAttendance(a);
      if (alive) setCloudChecked(true);
    })();
    return () => { alive = false; };
  }, [userId]);
```

**3d. Save the profile on onboarding.** Replace:
```jsx
  function handleOnboardingDone(courses) {
    const s = { courses };
    saveSetup(s);
    setEnrolled(courses);
    setMine(new Set(Object.keys(courses)));
    setSetup(s);
    setShowSetupEdit(false);
  }
```
with:
```jsx
  function handleOnboardingDone(courses) {
    const s = { courses };
    saveSetup(s);
    pushProfile(userId, courses);
    setEnrolled(courses);
    setMine(new Set(Object.keys(courses)));
    setSetup(s);
    setShowSetupEdit(false);
  }
```

**3e. Push each mark to the cloud.** Replace:
```jsx
  function markAttendance(c, status) {
    const key = sessionKey(c);
    setAttendance(prev => {
      const next = { ...prev };
      if (status === null) delete next[key]; else next[key] = status;
      saveAttendance(next);
      return next;
    });
  }
```
with:
```jsx
  function markAttendance(c, status) {
    const key = sessionKey(c);
    setAttendance(prev => {
      const next = { ...prev };
      if (status === null) delete next[key]; else next[key] = status;
      saveAttendance(next);
      return next;
    });
    pushMark(userId, key, status);
  }
```

**3f. Avoid an onboarding flash on a fresh device.** Replace:
```jsx
  if (!scheduleData) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!setup) return <Onboarding legend={LEGEND} sectionsByCode={sectionsByCode} onDone={handleOnboardingDone} />;
```
with:
```jsx
  if (!scheduleData) return <div className="loading-screen"><div className="spinner" /></div>;
  if (userId && !setup && !cloudChecked) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!setup) return <Onboarding legend={LEGEND} sectionsByCode={sectionsByCode} onDone={handleOnboardingDone} />;
```

**3g. Provide `userId` from Clerk.** Replace:
```jsx
export default function App() {
  const { isSignedIn, isLoaded } = useUser();
  const { signOut } = useClerk();
  return <AppCore isSignedIn={isSignedIn} isLoaded={isLoaded} signOut={signOut} />;
}

export function DevApp() {
  return <AppCore isSignedIn={true} isLoaded={true} signOut={() => {}} />;
}
```
with:
```jsx
export default function App() {
  const { isSignedIn, isLoaded, user } = useUser();
  const { signOut } = useClerk();
  return <AppCore isSignedIn={isSignedIn} isLoaded={isLoaded} signOut={signOut} userId={user?.id} />;
}

export function DevApp() {
  return <AppCore isSignedIn={true} isLoaded={true} signOut={() => {}} userId={null} />;
}
```

---

## Verify

1. `npm run dev`, sign in, complete onboarding on one device → land on the timetable.
2. Open the app on a second device / browser, sign in with the same account → **no onboarding**, your sections are already there (proves `profiles` synced).
3. Mark a couple of past sessions → sign in elsewhere → the marks are present (proves `attendance` synced).
4. In the Supabase Table Editor, your `profiles` and `attendance` rows carry your Clerk user id, and you can only see your own (RLS).
5. `DevApp` still runs with `userId={null}` for offline/dev — marks just stay local in that mode.

Nothing else changes: `AttendancePanel`, `Onboarding`, and the timeline keep their current
props; only the data behind `setup`/`enrolled`/`attendance` now lives in Supabase, cached
locally for instant render.

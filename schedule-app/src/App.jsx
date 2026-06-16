import { useState, useEffect, useMemo } from "react";
import { RefreshCw, Calendar, Clock, Sunrise, GraduationCap, LogOut, Settings2, Bell } from "lucide-react";
import { useUser, useClerk } from "@clerk/clerk-react";
import Hero from "./components/Hero.jsx";
import Timeline from "./components/Timeline.jsx";
import WeekAgenda from "./components/WeekAgenda.jsx";
import SubjectFilter from "./components/SubjectFilter.jsx";
import Login from "./components/Login.jsx";
import Onboarding from "./components/Onboarding.jsx";
import { fetchSchedule } from "./lib/sheet.js";
import RecentChanges from "./components/RecentChanges.jsx";

function toMin(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function clsDate(c, which) { const [Y, Mo, D] = c.date.split("-").map(Number); const [h, m] = c[which].split(":").map(Number); return new Date(Y, Mo - 1, D, h, m); }
function prettyDate(iso) { const [Y, M, D] = iso.split("-").map(Number); return new Date(Y, M - 1, D).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" }); }

const SETUP_KEY = "pgp2.setup";
function readSetup() {
  try {
    const s = JSON.parse(localStorage.getItem(SETUP_KEY));
    if (s && s.courses && !Array.isArray(s.courses) && typeof s.courses === "object") return s;
    return null;
  } catch { return null; }
}
function saveSetup(s) { try { localStorage.setItem(SETUP_KEY, JSON.stringify(s)); } catch (e) {} }

const NOTIF_KEY = "pgp2-notif-seen";
function loadLastSeen() { try { return parseInt(localStorage.getItem(NOTIF_KEY) || "0", 10); } catch { return 0; } }

function AppCore({ isSignedIn, isLoaded, signOut }) {
  const [scheduleData, setScheduleData] = useState(null);
  const [now, setNow] = useState(new Date());
  const [view, setView] = useState("today");
  const [weekOffset, setWeekOffset] = useState(0);
  const [mine, setMine] = useState(null);
  const [enrolled, setEnrolled] = useState(null); // { code: section }
  const [setup, setSetup] = useState(null);
  const [showSetupEdit, setShowSetupEdit] = useState(false);
  const [syncedAt, setSyncedAt] = useState(new Date());
  const [notifOpen, setNotifOpen] = useState(false);
  const [lastSeenTs, setLastSeenTs] = useState(() => loadLastSeen());

  useEffect(() => {
    if (!isSignedIn) return;
    let alive = true;
    const load = (first) =>
      fetchSchedule().then((data) => {
        if (!alive) return;
        setScheduleData(data);
        setSyncedAt(new Date());
        if (first) {
          const saved = readSetup();
          if (saved && saved.courses) {
            setEnrolled(saved.courses);
            setMine(new Set(Object.keys(saved.courses)));
            setSetup(saved);
          }
        }
      });
    load(true);
    const id = setInterval(() => load(false), 10 * 60 * 1000);
    return () => { alive = false; clearInterval(id); };
  }, [isSignedIn]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(t);
  }, []);

  const { TERM, LEGEND, CLASSES, CHANGES } = scheduleData || { TERM: null, LEGEND: {}, CLASSES: [], CHANGES: [] };

  const sectionsByCode = useMemo(() => {
    const m = {};
    CLASSES.forEach((c) => {
      if (c.type === "class" && c.code) (m[c.code] = m[c.code] || new Set()).add(c.section);
    });
    const out = {};
    Object.keys(m).forEach((k) => { out[k] = [...m[k]].sort(); });
    return out;
  }, [CLASSES]);

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

  const enrolledLegend = useMemo(() => {
    const out = {};
    if (enrolled) Object.keys(enrolled).forEach((c) => { if (LEGEND[c]) out[c] = LEGEND[c]; });
    return out;
  }, [enrolled, LEGEND]);

  const todayISO = ymd(now);
  const tomorrowISO = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

  const weekRangeLabel = useMemo(() => {
    const monday = new Date(now);
    const dow = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - dow + weekOffset * 7);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return `${monday.toLocaleDateString([], { day: "numeric", month: "short" })} – ${sunday.toLocaleDateString([], { day: "numeric", month: "short" })}`;
  }, [now, weekOffset]);

  const todayList = useMemo(
    () => visible.filter((c) => c.date === todayISO).sort((a, b) => toMin(a.start) - toMin(b.start)),
    [visible, todayISO]
  );

  const tomorrowList = useMemo(
    () => visible.filter((c) => c.date === tomorrowISO).sort((a, b) => toMin(a.start) - toMin(b.start)),
    [visible, tomorrowISO]
  );

  const { current, next } = useMemo(() => {
    const teach = visible
      .filter((c) => c.type === "class" || c.type === "exam")
      .map((c) => ({ ...c, s: clsDate(c, "start"), e: clsDate(c, "end") }))
      .sort((a, b) => a.s - b.s);
    return {
      current: teach.find((c) => c.s <= now && now < c.e) || null,
      next: teach.find((c) => c.s > now) || null,
    };
  }, [visible, now]);

  const syncedAgo = Math.max(0, Math.round((now - syncedAt) / 60000));

  function handleOnboardingDone(courses) {
    const s = { courses };
    saveSetup(s);
    setEnrolled(courses);
    setMine(new Set(Object.keys(courses)));
    setSetup(s);
    setShowSetupEdit(false);
  }

  const hasUnread = CHANGES.length > 0 && CHANGES.some(c => new Date(c.ts).getTime() > lastSeenTs);

  function handleOpenNotif() {
    if (!notifOpen && CHANGES.length > 0) {
      const latest = Math.max(...CHANGES.map(c => new Date(c.ts).getTime()));
      setLastSeenTs(latest);
      try { localStorage.setItem(NOTIF_KEY, String(latest)); } catch {}
    }
    setNotifOpen(o => !o);
  }

  function handleSync() {
    fetchSchedule().then((data) => {
      setScheduleData(data);
      setSyncedAt(new Date());
      setNow(new Date());
    });
  }

  if (!isLoaded) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!isSignedIn) return <Login />;
  if (!scheduleData) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!setup) return <Onboarding legend={LEGEND} sectionsByCode={sectionsByCode} onDone={handleOnboardingDone} />;
  if (showSetupEdit) return <Onboarding legend={LEGEND} sectionsByCode={sectionsByCode} onDone={handleOnboardingDone} initialPicked={enrolled} onCancel={() => setShowSetupEdit(false)} />;

  const termLabel = TERM ? `${new Date(TERM.start + "T00:00").toLocaleDateString([], { day: "numeric", month: "short" })} – ${new Date(TERM.end + "T00:00").toLocaleDateString([], { day: "numeric", month: "short" })}` : "";

  return (
    <div className="app">
      <header className="bar">
        <div className="brand">
          <div className="logo"><GraduationCap size={20} /></div>
          <div>
            <div className="brand-name">Term Timetable</div>
            <div className="brand-sub">IIM Sambalpur · {termLabel}</div>
          </div>
        </div>
        <div className="bar-right">
          <button className="sync" onClick={() => setShowSetupEdit(true)} aria-label="Edit setup"><Settings2 size={15} /></button>
          <button className="sync" onClick={handleSync} aria-label="Sync now"><RefreshCw size={15} /></button>
          <div className="notif-wrap">
            <button className="sync" onClick={handleOpenNotif} aria-label="Notifications">
              <Bell size={15} />
              {hasUnread && <span className="notif-dot" />}
            </button>
            {notifOpen && (
              <>
                <div className="notif-backdrop" onClick={() => setNotifOpen(false)} />
                <div className="notif-panel">
                  {CHANGES.length === 0
                    ? <p className="notif-empty">No recent changes</p>
                    : <RecentChanges changes={CHANGES} />}
                </div>
              </>
            )}
          </div>
          <button className="sync" onClick={() => signOut()} aria-label="Sign out"><LogOut size={15} /></button>
        </div>
      </header>

      <div className="livebar">
        <span className="live">
          <span className="pulse" /> Live · synced {syncedAgo === 0 ? "just now" : `${syncedAgo}m ago`}
        </span>
      </div>

      <SubjectFilter legend={enrolledLegend} mine={mine} setMine={setMine} />

      <div className="desk-layout">
        <div className="main-col">
          <nav className="tabs">
            <button className={`tab ${view === "today" ? "on" : ""}`} onClick={() => setView("today")}>
              <Clock size={15} /> Today
            </button>
            <button className={`tab ${view === "tomorrow" ? "on" : ""}`} onClick={() => setView("tomorrow")}>
              <Sunrise size={15} /> Tomorrow
            </button>
            <button className={`tab tab-week ${view === "week" ? "on" : ""}`} onClick={() => setView("week")}>
              <Calendar size={15} /> Week
            </button>
            <div className="today-date">{view === "week" ? weekRangeLabel : prettyDate(view === "tomorrow" ? tomorrowISO : todayISO)}</div>
          </nav>
          <Hero current={current} next={next} now={now} todayISO={todayISO} tomorrowISO={tomorrowISO} />
          <div className={view === "week" ? "pane-today hide-mobile" : "pane-today"}>
            {view === "tomorrow"
              ? <Timeline list={tomorrowList} current={null} now={now} showNowLine={false} label="Tomorrow" />
              : <Timeline list={todayList} current={current} now={now} />}
          </div>
        </div>
        <aside className={view !== "week" ? "side-col hide-mobile" : "side-col"}>
          <WeekAgenda visible={visible} now={now} offset={weekOffset} setOffset={setWeekOffset} todayISO={todayISO} />
        </aside>
      </div>

      <footer className="foot">Auto-syncs from the live timetable sheet every few minutes</footer>
    </div>
  );
}

export default function App() {
  const { isSignedIn, isLoaded } = useUser();
  const { signOut } = useClerk();
  return <AppCore isSignedIn={isSignedIn} isLoaded={isLoaded} signOut={signOut} />;
}

export function DevApp() {
  return <AppCore isSignedIn={true} isLoaded={true} signOut={() => {}} />;
}

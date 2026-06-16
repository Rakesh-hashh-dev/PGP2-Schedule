import { useState, useEffect, useMemo } from "react";
import { RefreshCw, Calendar, Clock, Sunrise, GraduationCap, LogOut } from "lucide-react";
import { useUser, useClerk } from "@clerk/clerk-react";
import Hero from "./components/Hero.jsx";
import Timeline from "./components/Timeline.jsx";
import WeekAgenda from "./components/WeekAgenda.jsx";
import SubjectFilter from "./components/SubjectFilter.jsx";
import Login from "./components/Login.jsx";
import { fetchSchedule } from "./lib/sheet.js";
import RecentChanges from "./components/RecentChanges.jsx";

function toMin(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function clsDate(c, which) { const [Y, Mo, D] = c.date.split("-").map(Number); const [h, m] = c[which].split(":").map(Number); return new Date(Y, Mo - 1, D, h, m); }
function prettyDate(iso) { const [Y, M, D] = iso.split("-").map(Number); return new Date(Y, M - 1, D).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" }); }

function AppCore({ isSignedIn, isLoaded, signOut }) {
  const [scheduleData, setScheduleData] = useState(null);
  const [now, setNow] = useState(new Date());
  const [section, setSection] = useState("A");
  const [view, setView] = useState("today");
  const [weekOffset, setWeekOffset] = useState(0);
  const [mine, setMine] = useState(null);
  const [syncedAt, setSyncedAt] = useState(new Date());

  useEffect(() => {
    if (!isSignedIn) return;
    let alive = true;
    const load = (first) =>
      fetchSchedule().then((data) => {
        if (!alive) return;
        setScheduleData(data);
        setSyncedAt(new Date());
        if (first) setMine(new Set(Object.keys(data.LEGEND)));
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

  const visible = useMemo(() => {
    if (!mine) return [];
    const seen = new Set();
    return CLASSES.filter((c) => {
      if (c.type === "class") return mine.has(c.code) && (c.section === section || c.section === "Single");
      const key = c.date + c.slot + c.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [CLASSES, section, mine]);

  const todayISO = ymd(now);
  const tomorrowISO = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

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

  function handleSync() {
    fetchSchedule().then((data) => {
      setScheduleData(data);
      setSyncedAt(new Date());
      setNow(new Date());
    });
  }

  if (!isLoaded) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!isSignedIn) return <Login />;
  if (!scheduleData || !mine) return <div className="loading-screen"><div className="spinner" /></div>;

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
          <div className="seg" role="group" aria-label="Section">
            {["A", "B"].map((s) => (
              <button key={s} className={`seg-b ${section === s ? "on" : ""}`} onClick={() => setSection(s)}>
                Sec {s}
              </button>
            ))}
          </div>
          <button className="sync" onClick={handleSync} aria-label="Sync now"><RefreshCw size={15} /></button>
          <button className="sync" onClick={() => signOut()} aria-label="Sign out"><LogOut size={15} /></button>
        </div>
      </header>

      <div className="livebar">
        <span className="live">
          <span className="pulse" /> Live · synced {syncedAgo === 0 ? "just now" : `${syncedAgo}m ago`}
        </span>
      </div>

      <SubjectFilter legend={LEGEND} mine={mine} setMine={setMine} />

      <nav className="tabs">
        <button className={`tab ${view === "today" ? "on" : ""}`} onClick={() => setView("today")}>
          <Clock size={15} /> Today
        </button>
        <button className={`tab ${view === "tomorrow" ? "on" : ""}`} onClick={() => setView("tomorrow")}>
          <Sunrise size={15} /> Tomorrow
        </button>
        <button className={`tab ${view === "week" ? "on" : ""}`} onClick={() => setView("week")}>
          <Calendar size={15} /> Week
        </button>
        <div className="today-date">{prettyDate(todayISO)}</div>
      </nav>

      <Hero current={current} next={next} now={now} todayISO={todayISO} />

      {view === "today"
        ? <Timeline list={todayList} current={current} now={now} />
        : view === "tomorrow"
        ? <Timeline list={tomorrowList} current={null} now={now} showNowLine={false} label="Tomorrow" />
        : <WeekAgenda visible={visible} now={now} offset={weekOffset} setOffset={setWeekOffset} todayISO={todayISO} />}

      <RecentChanges changes={CHANGES} />

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

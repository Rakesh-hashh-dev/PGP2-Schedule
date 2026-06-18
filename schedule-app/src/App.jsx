import { useState, useEffect, useMemo } from "react";
import { RefreshCw, Calendar, Clock, Sunrise, LogOut, Settings2, Bell, ClipboardList, MoreHorizontal, Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, CloudFog } from "lucide-react";
import { useUser, useClerk } from "@clerk/clerk-react";
import Hero from "./components/Hero.jsx";
import Timeline from "./components/Timeline.jsx";
import WeekAgenda from "./components/WeekAgenda.jsx";
import SubjectFilter from "./components/SubjectFilter.jsx";
import Login from "./components/Login.jsx";
import Onboarding from "./components/Onboarding.jsx";
import AttendancePanel from "./components/AttendancePanel.jsx";
import { getSnapshot, fetchSchedule } from "./lib/sheet.js";
import RecentChanges from "./components/RecentChanges.jsx";
import NotificationsPage from "./components/NotificationsPage.jsx";
import TermFlowLoader from "./components/TermFlowLoader.jsx";
import { loadAttendance, saveAttendance, sessionKey, syncAttendanceFromCloud, pushMark } from "./lib/attendance.js";
import { syncProfileFromCloud, pushProfile } from "./lib/profile.js";

function toMin(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function clsDate(c, which) { const [Y, Mo, D] = c.date.split("-").map(Number); const [h, m] = c[which].split(":").map(Number); return new Date(Y, Mo - 1, D, h, m); }
function prettyDate(iso) { const [Y, M, D] = iso.split("-").map(Number); return new Date(Y, M - 1, D).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" }); }

function UserAvatar({ user, size = 30 }) {
  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}` || "?";
  if (user?.imageUrl) return <img src={user.imageUrl} alt="" className="user-avatar" style={{ width: size, height: size }} />;
  return <span className="user-avatar user-avatar-initials" style={{ width: size, height: size }}>{initials}</span>;
}

function weatherIcon(code) {
  if (code === 0) return Sun;
  if (code <= 3) return Cloud;
  if (code <= 48) return CloudFog;
  if (code <= 55) return CloudDrizzle;
  if (code <= 67) return CloudRain;
  if (code <= 77) return CloudSnow;
  if (code <= 82) return CloudRain;
  return CloudLightning;
}

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

function AppCore({ isSignedIn, isLoaded, signOut, userId, user }) {
  const [scheduleData, setScheduleData] = useState(() => isSignedIn ? getSnapshot() : null);
  const [now, setNow] = useState(new Date());
  const [view, setView] = useState("today");
  const [weekOffset, setWeekOffset] = useState(0);
  const [mine, setMine] = useState(() => { const s = readSetup(); return s?.courses ? new Set(Object.keys(s.courses)) : null; });
  const [enrolled, setEnrolled] = useState(() => { const s = readSetup(); return s?.courses ?? null; });
  const [setup, setSetup] = useState(() => readSetup());
  const [showSetupEdit, setShowSetupEdit] = useState(false);
  const [syncedAt, setSyncedAt] = useState(new Date());
  const [notifOpen, setNotifOpen] = useState(false);
  const [lastSeenTs, setLastSeenTs] = useState(() => loadLastSeen());
  const [attendance, setAttendance] = useState(() => loadAttendance());
  const [syncing, setSyncing] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [weather, setWeather] = useState(null);
  const [cloudChecked, setCloudChecked] = useState(false);

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

  useEffect(() => {
    fetch("https://api.open-meteo.com/v1/forecast?latitude=21.4669&longitude=83.9812&current=temperature_2m,weather_code&temperature_unit=celsius&timezone=Asia%2FKolkata")
      .then(r => r.json())
      .then(d => setWeather({ temp: Math.round(d.current.temperature_2m), code: d.current.weather_code }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    let alive = true;
    // State is already pre-populated synchronously; just background-fetch live data
    const load = () =>
      fetchSchedule().then((data) => {
        if (!alive) return;
        setScheduleData(data);
        setSyncedAt(new Date());
      });
    load();
    const id = setInterval(load, 10 * 60 * 1000);
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
    pushProfile(userId, courses);
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

  function handleViewAllNotifs() {
    setNotifOpen(false);
    setView("notifications");
  }

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

  function handleSync() {
    setSyncing(true);
    fetchSchedule().then((data) => {
      setScheduleData(data);
      setSyncedAt(new Date());
      setNow(new Date());
    }).finally(() => setSyncing(false));
  }

  if (!isLoaded) return <div className="loading-screen"><TermFlowLoader variant="splash" size={96} /></div>;
  if (!isSignedIn) return <Login />;
  if (!scheduleData) return <div className="loading-screen"><TermFlowLoader size={72} /></div>;
  if (userId && !setup && !cloudChecked) return <div className="loading-screen"><TermFlowLoader size={72} /></div>;
  if (!setup) return <Onboarding legend={LEGEND} sectionsByCode={sectionsByCode} onDone={handleOnboardingDone} />;
  if (showSetupEdit) return <Onboarding legend={LEGEND} sectionsByCode={sectionsByCode} onDone={handleOnboardingDone} initialPicked={enrolled} onCancel={() => setShowSetupEdit(false)} />;

  const termDateRange = TERM ? `${new Date(TERM.start + "T00:00").toLocaleDateString([], { day: "numeric", month: "short" })} – ${new Date(TERM.end + "T00:00").toLocaleDateString([], { day: "numeric", month: "short" })}` : "";
  const termLabel = TERM?.number ? `Term ${TERM.number} · ${termDateRange}` : termDateRange;

  return (
    <div className="app">
      <header className="bar">
        <div className="brand">
          <div className="logo"><img src="/termflow-icon.svg" alt="TermFlow" width={22} height={22} /></div>
          <div>
            <div className="brand-name">TermFlow</div>
            <div className="brand-sub">IIM Sambalpur · {termLabel}</div>
          </div>
        </div>
        <div className="bar-right" role="toolbar" aria-label="App actions">
          {/* Desktop-only: full button set */}
          <div className="tb-wrap desktop-only">
            <button className="sync" onClick={() => setShowSetupEdit(true)} aria-label="Edit setup"><Settings2 size={15} /></button>
            <span className="tooltip" role="tooltip">Edit setup</span>
          </div>
          <div className="tb-wrap desktop-only">
            <button className="sync" onClick={handleSync} aria-label={syncing ? "Syncing…" : "Refresh"}>
              <RefreshCw size={15} className={syncing ? "spin-icon" : ""} />
            </button>
            <span className="tooltip" role="tooltip">{syncing ? "Syncing…" : "Refresh"}</span>
          </div>
          <div className="tb-wrap desktop-only">
            <button className={`sync${view === "attendance" ? " sync-on" : ""}`} onClick={() => setView("attendance")} aria-label="Attendance" aria-pressed={view === "attendance"}>
              <ClipboardList size={15} />
            </button>
            <span className="tooltip" role="tooltip">Attendance</span>
          </div>
          {/* Bell — always visible */}
          <div className="tb-wrap notif-wrap">
            <button className="sync" onClick={handleOpenNotif} aria-label="Notifications" aria-expanded={notifOpen}>
              <Bell size={15} />
              {hasUnread && <span className="notif-dot" />}
            </button>
            <span className="tooltip" role="tooltip">Notifications</span>
            {notifOpen && (
              <>
                <div className="notif-backdrop" onClick={() => setNotifOpen(false)} />
                <div className="notif-panel">
                  {CHANGES.length === 0
                    ? <p className="notif-empty">No recent changes</p>
                    : <RecentChanges changes={CHANGES} onViewAll={handleViewAllNotifs} />}
                </div>
              </>
            )}
          </div>
          {/* Desktop-only: profile avatar */}
          <div className="tb-wrap over-wrap desktop-only">
            <button className="sync profile-avatar-btn" onClick={() => setProfileOpen(o => !o)} aria-label="Profile" aria-expanded={profileOpen}>
              <UserAvatar user={user} size={30} />
            </button>
            {profileOpen && (
              <>
                <div className="notif-backdrop" onClick={() => setProfileOpen(false)} />
                <div className="over-menu">
                  <div className="over-profile">
                    <UserAvatar user={user} size={36} />
                    <div className="over-profile-info">
                      <span className="over-profile-name">{user?.fullName || "—"}</span>
                      <span className="over-profile-email">{user?.primaryEmailAddress?.emailAddress || "—"}</span>
                      <span className="over-profile-batch">PGP2 · 2025–27</span>
                    </div>
                  </div>
                  <div className="over-sep" />
                  <button className="over-danger" onClick={() => { signOut(); setProfileOpen(false); }}>
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
          {/* Mobile-only: overflow ⋯ */}
          <div className="tb-wrap over-wrap mobile-only">
            <button className="sync" onClick={() => setOverflowOpen(o => !o)} aria-label="More options" aria-expanded={overflowOpen}>
              <MoreHorizontal size={15} />
            </button>
            {overflowOpen && (
              <>
                <div className="notif-backdrop" onClick={() => setOverflowOpen(false)} />
                <div className="over-menu">
                  <div className="over-profile">
                    <UserAvatar user={user} size={36} />
                    <div className="over-profile-info">
                      <span className="over-profile-name">{user?.fullName || "—"}</span>
                      <span className="over-profile-email">{user?.primaryEmailAddress?.emailAddress || "—"}</span>
                      <span className="over-profile-batch">PGP2 · 2025–27</span>
                    </div>
                  </div>
                  <div className="over-sep" />
                  <button onClick={() => { setShowSetupEdit(true); setOverflowOpen(false); }}>
                    <Settings2 size={14} /> Edit setup
                  </button>
                  <button onClick={() => { handleSync(); setOverflowOpen(false); }}>
                    <RefreshCw size={14} className={syncing ? "spin-icon" : ""} />
                    {syncing ? "Syncing…" : "Refresh"}
                  </button>
                  <div className="over-sep" />
                  <button className="over-danger" onClick={() => { signOut(); setOverflowOpen(false); }}>
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
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
            <button className={`tab ${view === "attendance" ? "on" : ""}`} onClick={() => setView("attendance")}>
              <ClipboardList size={15} /> Attendance
            </button>
            <div className="today-date">
              {view === "attendance" && weather
                ? (() => { const Icon = weatherIcon(weather.code); return <span className="weather-chip"><Icon size={13} />{weather.temp}°C</span>; })()
                : view === "notifications" ? `${CHANGES.length} update${CHANGES.length !== 1 ? "s" : ""}`
                : view === "week" ? weekRangeLabel : prettyDate(view === "tomorrow" ? tomorrowISO : todayISO)}
            </div>
          </nav>
          {view !== "attendance" && view !== "notifications" && <Hero current={current} next={next} now={now} todayISO={todayISO} tomorrowISO={tomorrowISO} />}
          <div className={view === "week" ? "pane-today hide-mobile" : "pane-today"}>
            {view === "attendance"
              ? <AttendancePanel
                  allClasses={CLASSES}
                  now={now}
                  attendance={attendance}
                  enrolled={enrolled}
                  legend={enrolledLegend}
                  markAttendance={markAttendance}
                  weather={weather}
                  termNumber={TERM?.number}
                />
              : view === "notifications"
                ? <NotificationsPage changes={CHANGES} />
                : view === "tomorrow"
                  ? <Timeline list={tomorrowList} current={null} now={now} showNowLine={false} label="Tomorrow" dateLabel={prettyDate(tomorrowISO)} attendance={attendance} markAttendance={markAttendance} />
                  : <Timeline list={todayList} current={current} now={now} dateLabel={prettyDate(todayISO)} attendance={attendance} markAttendance={markAttendance} />}
          </div>
        </div>
        <aside className={view !== "week" ? "side-col hide-mobile" : "side-col"}>
          <WeekAgenda visible={visible} now={now} offset={weekOffset} setOffset={setWeekOffset} todayISO={todayISO} />
        </aside>
      </div>

      <footer className="foot">
        <span className="foot-credit">Auto-syncs from the live timetable sheet every few minutes</span>
        <span className="foot-credit">Built with <span className="foot-heart">♥</span> by <a href="https://www.linkedin.com/" target="_blank" rel="noopener noreferrer" className="foot-credit-name">Rakesh</a></span>
      </footer>

      {/* Bottom nav — commented out, restore when needed
      <nav className="bnav" aria-label="Main navigation">
        <button className={`bnav-btn${view === "today" ? " on" : ""}`} onClick={() => setView("today")}>
          <Clock size={20} /><span>Today</span>
        </button>
        <button className={`bnav-btn${view === "tomorrow" ? " on" : ""}`} onClick={() => setView("tomorrow")}>
          <Sunrise size={20} /><span>Tomorrow</span>
        </button>
        <button className={`bnav-btn${view === "week" ? " on" : ""}`} onClick={() => setView("week")}>
          <Calendar size={20} /><span>Week</span>
        </button>
        <button className={`bnav-btn${view === "attendance" ? " on" : ""}`} onClick={() => setView("attendance")}>
          <ClipboardList size={20} /><span>Attendance</span>
        </button>
      </nav>
      */}
    </div>
  );
}

export default function App() {
  const { isSignedIn, isLoaded, user } = useUser();
  const { signOut } = useClerk();
  return <AppCore isSignedIn={isSignedIn} isLoaded={isLoaded} signOut={signOut} userId={user?.id} user={user} />;
}

export function DevApp() {
  return <AppCore isSignedIn={true} isLoaded={true} signOut={() => {}} userId={null} />;
}

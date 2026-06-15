import { useState, useEffect, useMemo } from "react";
import { RefreshCw, Calendar, Clock, GraduationCap } from "lucide-react";
import Hero from "./components/Hero.jsx";
import Timeline from "./components/Timeline.jsx";
import WeekAgenda from "./components/WeekAgenda.jsx";
import SubjectFilter from "./components/SubjectFilter.jsx";
import { fetchSchedule } from "./lib/sheet.js";

function toMin(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function clsDate(c, which) { const [Y, Mo, D] = c.date.split("-").map(Number); const [h, m] = c[which].split(":").map(Number); return new Date(Y, Mo - 1, D, h, m); }
function prettyDate(iso) { const [Y, M, D] = iso.split("-").map(Number); return new Date(Y, M - 1, D).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" }); }

export default function App() {
  const [scheduleData, setScheduleData] = useState(null);
  const [now, setNow] = useState(new Date());
  const [section, setSection] = useState("A");
  const [view, setView] = useState("today");
  const [weekOffset, setWeekOffset] = useState(0);
  const [mine, setMine] = useState(null);
  const [syncedAt, setSyncedAt] = useState(new Date());

  useEffect(() => {
    fetchSchedule().then((data) => {
      setScheduleData(data);
      setMine(new Set(Object.keys(data.LEGEND)));
    });
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(t);
  }, []);

  const { TERM, LEGEND, CLASSES } = scheduleData || { TERM: null, LEGEND: {}, CLASSES: [] };

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

  const todayList = useMemo(
    () => visible.filter((c) => c.date === todayISO).sort((a, b) => toMin(a.start) - toMin(b.start)),
    [visible, todayISO]
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

  if (!scheduleData || !mine) {
    return <div className="app" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}><span style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 13 }}>Loading…</span></div>;
  }

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
        <button className={`tab ${view === "week" ? "on" : ""}`} onClick={() => setView("week")}>
          <Calendar size={15} /> Week
        </button>
        <div className="today-date">{prettyDate(todayISO)}</div>
      </nav>

      <Hero current={current} next={next} now={now} todayISO={todayISO} />

      {view === "today"
        ? <Timeline list={todayList} current={current} now={now} />
        : <WeekAgenda visible={visible} now={now} offset={weekOffset} setOffset={setWeekOffset} todayISO={todayISO} />}

      <footer className="foot">Snapshot · connect live to enable change alerts</footer>
    </div>
  );
}

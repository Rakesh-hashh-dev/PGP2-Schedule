import { useState, useEffect, useRef } from "react";
import { MapPin, CheckCircle2, Timer } from "lucide-react";

function clsDate(c, which) {
  const [Y, Mo, D] = c.date.split("-").map(Number);
  const [h, m] = c[which].split(":").map(Number);
  return new Date(Y, Mo - 1, D, h, m);
}

function prettyDate(iso) {
  const [Y, M, D] = iso.split("-").map(Number);
  return new Date(Y, M - 1, D).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
}

function pad2(n) { return String(n).padStart(2, "0"); }

// Live ticking countdown to the next class start.
function HeroCountdown({ target }) {
  const [ms, setMs] = useState(() => target.getTime() - Date.now());

  useEffect(() => {
    setMs(target.getTime() - Date.now());
    const id = setInterval(() => setMs(target.getTime() - Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const urgent = totalSec <= 300; // ≤ 5 min

  return (
    <div className={`hero-countdown${urgent ? " urgent" : ""}`} role="timer" aria-live="off">
      <Timer size={15} className="hero-cd-icon" />
      <span className="hero-cd-clock">
        {h > 0 && (
          <>
            <span className="hero-cd-seg">{pad2(h)}</span>
            <span className="hero-cd-colon">:</span>
          </>
        )}
        <span className="hero-cd-seg">{pad2(m)}</span>
        <span className="hero-cd-colon">:</span>
        <span className="hero-cd-seg">{pad2(s)}</span>
      </span>
      <span className="hero-cd-label">until start</span>
    </div>
  );
}

function UpNext({ c }) {
  return (
    <div className="upnext">
      <span className="up-label">Then</span>
      <span className="up-t">{c.start}</span>
      <span className="up-c">{c.name}</span>
      <span className="up-r">{c.room || "TBA"}</span>
    </div>
  );
}

export default function Hero({ current, next, now, todayISO, tomorrowISO, premiumMode }) {
  const prevRef = useRef(current);
  const [justDone, setJustDone] = useState(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = current;
    if (prev && !current) {
      setJustDone(prev.name);
    }
  }, [current]);

  useEffect(() => {
    if (!justDone) return;
    const t = setTimeout(() => setJustDone(null), 2800);
    return () => clearTimeout(t);
  }, [justDone]);

  if (justDone) {
    return (
      <section className="hero hero-complete">
        <div className="done-ring" />
        <div className="done-icon"><CheckCircle2 size={40} strokeWidth={1.8} /></div>
        <h1 className="hero-course done-course">{justDone}</h1>
        <div className="done-label">Class wrapped ✓</div>
      </section>
    );
  }

  if (current) {
    const s = clsDate(current, "start"), e = clsDate(current, "end");
    const done = Math.min(1, Math.max(0, (now - s) / (e - s)));
    const left = Math.max(0, Math.round((e - now) / 60000));
    
    return (
      <section className="hero">
        <div className="hero-tag in">
          <span className="dot" /> In session
          {current.session && (
            <span className={`ses ses-${(Array.from(current.code).reduce((h, char) => h + char.charCodeAt(0), 0)) % 6}`}>
              {current.code} {current.session}
            </span>
          )}
        </div>
        <h1 className="hero-course">{current.name}</h1>
        <div className="hero-meta">
          <span className="t">{current.start}<span className="dash">–</span>{current.end}</span>
          <><span className="sep">·</span><span className="r"><MapPin size={14} /> {current.room || "TBA"}</span></>
          {current.faculty && <><span className="sep">·</span><span className="f">{current.faculty}</span></>}
        </div>
        <div className="prog"><div className="prog-fill" style={{ width: `${done * 100}%` }} /></div>
        <div className="prog-label">{left} min left</div>
        {next && <UpNext c={next} />}
      </section>
    );
  }

  if (next) {
    const s = clsDate(next, "start");
    const sameDay = next.date === todayISO;
    const mins = Math.round((s - now) / 60000);

    if (!sameDay) {
      // Today's classes are done — show relaxed "done for today" with subtle hint
      const nextLabel = next.date === tomorrowISO ? "Tomorrow" : prettyDate(next.date);
      return (
        <section className="hero hero-done-today">
          <div className="hero-tag done"><span className="dot" /> Done for today</div>
          <h1 className="hero-course">All clear 🎉</h1>
          <div className="hero-when">No more classes left today. Enjoy your evening!</div>
          <div className="hero-next-hint">
            <span className="hero-hint-label">Next up</span>
            <span className="hero-hint-name">{next.name}</span>
            <span className="hero-hint-when">{nextLabel} · {next.start}</span>
          </div>
        </section>
      );
    }

    return (
      <section className="hero">
        <div className="hero-tag next">
          <span className="dot amber" /> Up next
          {next.session && (
            <span className={`ses ses-${(Array.from(next.code).reduce((h, char) => h + char.charCodeAt(0), 0)) % 6}`}>
              {next.code} {next.session}
            </span>
          )}
        </div>
        <h1 className="hero-course">{next.name}</h1>
        <div className="hero-meta">
          <span className="t">{next.start}</span>
          <><span className="sep">·</span><span className="r"><MapPin size={14} /> {next.room || "TBA"}</span></>
          {next.faculty && <><span className="sep">·</span><span className="f">{next.faculty}</span></>}
        </div>
        {mins > 17
          ? <div className="hero-when">Later today</div>
          : <HeroCountdown target={s} />}
      </section>
    );
  }

  return (
    <section className="hero">
      <div className="hero-tag done"><span className="dot" /> All clear</div>
      <h1 className="hero-course">Nothing scheduled</h1>
      <div className="hero-when">No upcoming sessions in your selected courses.</div>
    </section>
  );
}

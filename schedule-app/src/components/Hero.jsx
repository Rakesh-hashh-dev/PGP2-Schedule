import { useState, useEffect, useRef } from "react";
import { MapPin, CheckCircle2, Timer, ThumbsUp, ThumbsDown } from "lucide-react";
import { sessionKey } from "../lib/attendance.js";

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

function sesHue(code) { return Array.from(code).reduce((h, c) => h + c.charCodeAt(0), 0) % 6; }

function sesLabel(code, session) {
  if (!session) return code;
  const s = session.trim();
  return /^\d+$/.test(s) ? `${code} session ${s}` : `${code} ${s}`;
}

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

function progFillStyle(done) {
  // violet(109,91,208) → teal(14,165,233) → green(31,169,113)
  let r, g, b;
  if (done <= 0.5) {
    const t = done / 0.5;
    [r, g, b] = [lerp(109, 14, t), lerp(91, 165, t), lerp(208, 233, t)];
  } else {
    const t = (done - 0.5) / 0.5;
    [r, g, b] = [lerp(14, 31, t), lerp(165, 169, t), lerp(233, 113, t)];
  }
  const glowSize = done >= 0.85 ? Math.round(10 + ((done - 0.85) / 0.15) * 16) : 10;
  const glowAlpha = done >= 0.65 ? 0.65 : 0.5;
  return {
    background: `rgb(${r},${g},${b})`,
    boxShadow: `0 0 ${glowSize}px rgba(${r},${g},${b},${glowAlpha})`,
  };
}

function timeOfDaySign(now) {
  const h = now.getHours();
  if (h < 12) return "Enjoy your morning!";
  if (h < 16) return "Enjoy your afternoon!";
  if (h < 21) return "Enjoy your evening!";
  return "Enjoy your night!";
}

function HeroCountdown({ target }) {
  const targetMs = target.getTime();
  const [ms, setMs] = useState(() => targetMs - Date.now());

  // Re-sync immediately when the countdown target changes (render adjustment)
  const [prevTargetMs, setPrevTargetMs] = useState(targetMs);
  if (prevTargetMs !== targetMs) {
    setPrevTargetMs(targetMs);
    // ms ≈ prevTarget − now, so the new remaining time is a pure delta (no clock
    // call during render; the 1s interval corrects any drift immediately anyway)
    setMs(ms - prevTargetMs + targetMs);
  }

  useEffect(() => {
    const id = setInterval(() => setMs(targetMs - Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const urgent = totalSec < 300;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  return (
    <div className={`hero-countdown${urgent ? " urgent" : ""}`} role="timer" aria-live="off">
      <Timer size={14} className="hero-cd-icon" />
      <span className="hero-cd-label">Starts in</span>
      <span className="hero-cd-text">
        {h > 0 && <>{pad2(h)}<span className="hero-cd-colon">:</span></>}
        {pad2(m)}<span className="hero-cd-colon">:</span>{pad2(s)}
      </span>
    </div>
  );
}

function HeroBackdrop({ sysConfig }) {
  const adminSetting = sysConfig?.flags?.heroBackdrop || "swap";
  
  if (adminSetting === "none") return null;
  
  let bgImage;
  if (adminSetting === "v2") {
    bgImage = "/premium_hero_backdrop_v2.png";
  } else if (adminSetting === "v3") {
    bgImage = "/premium_hero_backdrop_v3.png";
  } else {
    // swap logic (default)
    const isEvenDay = new Date().getDate() % 2 === 0;
    bgImage = isEvenDay ? "/premium_hero_backdrop_v2.png" : "/premium_hero_backdrop_v3.png";
  }
  
  return <div className="hero-img-bg" style={{ backgroundImage: `url(${bgImage})` }} />;
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

export default function Hero({ current, next, now, todayISO, tomorrowISO, onMarkAttendance, attendance, sysConfig }) {
  const prevRef = useRef(current);
  const [justDone, setJustDone] = useState(null); // full class object

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = current;
    if (prev && !current) setJustDone(prev);
  }, [current]);

  useEffect(() => {
    if (!justDone) return;
    const t = setTimeout(() => setJustDone(null), 5000);
    return () => clearTimeout(t);
  }, [justDone]);

  if (justDone) {
    const key = sessionKey(justDone);
    const marked = attendance?.[key];
    return (
      <section className="hero hero-complete">
        <HeroBackdrop sysConfig={sysConfig} />
        <div className="done-ring" />
        <div className="done-icon"><CheckCircle2 size={38} strokeWidth={1.6} /></div>
        <h1 className="hero-course done-course">{justDone.name}</h1>
        <div className="done-label">Class wrapped ✓</div>
        {marked ? (
          <div className={`done-marked-badge ${marked}`}>
            {marked === "present" ? <ThumbsUp size={12} /> : <ThumbsDown size={12} />}
            Marked {marked}
          </div>
        ) : onMarkAttendance ? (
          <div className="done-mark-row">
            <button className="done-mark-btn present" onClick={() => { onMarkAttendance(justDone, "present"); setJustDone(null); }}>
              <ThumbsUp size={13} /> Present
            </button>
            <button className="done-mark-btn absent" onClick={() => { onMarkAttendance(justDone, "absent"); setJustDone(null); }}>
              <ThumbsDown size={13} /> Absent
            </button>
          </div>
        ) : null}
      </section>
    );
  }

  if (current) {
    const s = clsDate(current, "start"), e = clsDate(current, "end");
    const done = Math.min(1, Math.max(0, (now - s) / (e - s)));
    const left = Math.max(0, Math.round((e - now) / 60000));

    return (
      <section className="hero hero-live">
        <HeroBackdrop sysConfig={sysConfig} />
        <div className="hero-state-row">
          <div className="hero-tag in"><span className="dot" />In session</div>
          {current.code && (
            <span className={`ses ses-${sesHue(current.code)}`}>
              {sesLabel(current.code, current.session)}
            </span>
          )}
        </div>
        <h1 className="hero-course">{current.name}</h1>
        <div className="hero-meta">
          <span className="t">{current.start}<span className="dash">–</span>{current.end}</span>
          <span className="sep">·</span>
          <span className="r"><MapPin size={13} />{current.room || "TBA"}</span>
          {current.faculty && <><span className="sep">·</span><span className="f">{current.faculty}</span></>}
        </div>
        <div className="hero-prog-wrap">
          <div className={`prog${done > 0.85 ? " prog-wide" : ""}`}>
            <div
              className={`prog-fill${done > 0.85 ? " nearing-end" : ""}`}
              style={{ width: `${done * 100}%`, ...progFillStyle(done) }}
            />
          </div>
          <span className="prog-label">{left} min left</span>
        </div>
        {next && <UpNext c={next} />}
      </section>
    );
  }

  if (next) {
    const s = clsDate(next, "start");
    const sameDay = next.date === todayISO;
    const mins = Math.round((s - now) / 60000);

    if (!sameDay) {
      const nextLabel = next.date === tomorrowISO ? "Tomorrow" : prettyDate(next.date);
      return (
        <section className="hero hero-done-today">
          <HeroBackdrop sysConfig={sysConfig} />
          <div className="hero-state-row">
            <div className="hero-tag done"><span className="dot" />Done for today</div>
          </div>
          <h1 className="hero-course">All clear 🎉</h1>
          <div className="hero-when">No more classes left today. {timeOfDaySign(now)}</div>
          <div className="hero-next-hint">
            <span className="hero-hint-label">Next up</span>
            <span className="hero-hint-name">{next.name}</span>
            <span className="hero-hint-when">{nextLabel} · {next.start}</span>
          </div>
        </section>
      );
    }

    return (
      <section className="hero hero-upnext">
        <HeroBackdrop sysConfig={sysConfig} />
        <div className="hero-state-row">
          <div className="hero-tag next"><span className="dot amber" />Up next</div>
          {next.code && (
            <span className={`ses ses-${sesHue(next.code)}`}>
              {sesLabel(next.code, next.session)}
            </span>
          )}
        </div>
        <h1 className="hero-course">{next.name}</h1>
        <div className="hero-meta">
          <span className="t">{next.start}</span>
          <span className="sep">·</span>
          <span className="r"><MapPin size={13} />{next.room || "TBA"}</span>
          {next.faculty && <><span className="sep">·</span><span className="f">{next.faculty}</span></>}
        </div>
        {mins > 17
          ? <div className="hero-when">Later today</div>
          : <HeroCountdown target={s} />}
      </section>
    );
  }

  return (
    <section className="hero hero-clear">
      <HeroBackdrop sysConfig={sysConfig} />
      <div className="hero-state-row">
        <div className="hero-tag done"><span className="dot" />All clear</div>
      </div>
      <h1 className="hero-course">Nothing scheduled</h1>
      <div className="hero-when">No upcoming sessions in your selected courses.</div>
    </section>
  );
}

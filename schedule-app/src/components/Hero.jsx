import { useState, useEffect, useRef } from "react";
import { MapPin, CheckCircle2, Timer, ThumbsUp, ThumbsDown, PartyPopper } from "lucide-react";
import { sessionKey } from "../lib/attendance.js";
import { subjectClass } from "../lib/subjectColors.js";

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

// Subtle time-of-day accent (r,g,b) used as an extra ambient tint layer.
// `now` may be a Date or a numeric timestamp (the admin preview passes a number).
function timeTint(now) {
  const h = (now instanceof Date ? now : new Date(now)).getHours();
  if (h < 7) return "60, 80, 170";      // pre-dawn indigo
  if (h < 11) return "245, 180, 90";    // warm morning
  if (h < 16) return "90, 190, 220";    // bright afternoon
  if (h < 19) return "240, 140, 90";    // golden evening
  return "70, 70, 150";                 // night violet
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

function LaterCountdown({ target }) {
  const targetMs = target.getTime();
  const [ms, setMs] = useState(() => targetMs - Date.now());

  const [prevTargetMs, setPrevTargetMs] = useState(targetMs);
  if (prevTargetMs !== targetMs) {
    setPrevTargetMs(targetMs);
    setMs(ms - prevTargetMs + targetMs);
  }

  useEffect(() => {
    const id = setInterval(() => setMs(targetMs - Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  const label = h > 0 ? `${h}h ${m}m` : `${m}m`;

  return (
    <div className="hero-when">
      Later today <span className="hero-when-in">in {label}</span>
    </div>
  );
}

export function HeroBackdrop({ sysConfig }) {
  const adminSetting = sysConfig?.flags?.heroBackdrop || "swap";
  
  if (adminSetting === "none") return null;
  
  let bgImage;
  if (adminSetting === "v2") {
    bgImage = "/premium_hero_backdrop_v2.webp";
  } else if (adminSetting === "v3") {
    bgImage = "/premium_hero_backdrop_v3.webp";
  } else {
    // swap logic (default)
    const isEvenDay = new Date().getDate() % 2 === 0;
    bgImage = isEvenDay ? "/premium_hero_backdrop_v2.webp" : "/premium_hero_backdrop_v3.webp";
  }
  
  return <div className="hero-img-bg" style={{ backgroundImage: `url(${bgImage})` }} />;
}

function UpNext({ c, gapLabel }) {
  return (
    <div className="upnext">
      <span className="up-label">Then</span>
      <span className="up-t">{c.start}</span>
      <span className="up-c">{c.name}</span>
      {gapLabel && <span className="up-gap">{gapLabel}</span>}
      <span className="up-r">{c.room || "TBA"}</span>
    </div>
  );
}

export default function Hero({ current, next, now, todayISO, tomorrowISO, onMarkAttendance, attendance, sysConfig }) {
  const prevRef = useRef(current);
  const [justDone, setJustDone] = useState(null); // full class object
  const tintStyle = { "--hero-time-tint": timeTint(now) };

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
        <div className="hero-sparkles" aria-hidden="true">
          {Array.from({ length: 10 }).map((_, i) => <span key={i} className="hero-sparkle" />)}
        </div>
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

    const popEnding = left <= 5 && left >= 3;
    const sameDayNext = next && next.date === current.date;

    let gapLabel = null;
    if (next) {
      if (sameDayNext) {
        const gapMin = Math.round((clsDate(next, "start") - e) / 60000);
        if (gapMin > 0) {
          const gh = Math.floor(gapMin / 60), gm = gapMin % 60;
          gapLabel = gh > 0 ? `in ${gh}h ${gm}m` : `in ${gm}m`;
        } else {
          gapLabel = "back-to-back";
        }
      } else {
        gapLabel = next.date === tomorrowISO ? "Tomorrow" : prettyDate(next.date);
      }
    }

    return (
      <section className="hero hero-live" style={tintStyle}>
        <HeroBackdrop sysConfig={sysConfig} />
        <div className="hero-time-tint" />
        <div className="hero-state-row">
          <div className="hero-tag in hero-tag-glow"><span className="dot" />In session</div>
          {current.code && (
            <span className={`ses ${subjectClass(current.code)}`}>
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
          <div className={`prog${done > 0.85 ? " prog-wide" : ""}${popEnding ? " prog-pop" : ""}`}>
            <div
              className={`prog-fill${done > 0.85 ? " nearing-end" : ""}`}
              style={{ width: `${done * 100}%`, ...progFillStyle(done) }}
            />
          </div>
          <span className={`prog-label${popEnding ? " prog-label-urgent" : ""}`}>{left} min left</span>
        </div>
        {/* Then-row only if next is same day, else a "last class" sign-off */}
        {sameDayNext && <UpNext c={next} gapLabel={gapLabel} />}
        {!sameDayNext && (
          <div className="hero-lastclass">
            <span className="hero-lastclass-badge">Last class today</span>
            <span className="hero-lastclass-text">
              {next
                ? <>Free after {current.end} · next is {next.date === tomorrowISO ? "tomorrow" : prettyDate(next.date)} at {next.start}</>
                : <>Free after {current.end} <PartyPopper size={12} aria-hidden="true" /></>}
            </span>
          </div>
        )}
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
        <section className="hero hero-done-today" style={tintStyle}>
          <HeroBackdrop sysConfig={sysConfig} />
          <div className="hero-time-tint" />
          <div className="hero-state-row">
            <div className="hero-tag done"><span className="dot" />Done for today</div>
          </div>
          <h1 className="hero-course">All clear <PartyPopper size={22} aria-hidden="true" className="hero-course-ico" /></h1>
          <div className="hero-when">No more classes left today. {timeOfDaySign(now)}</div>
          <div className="hero-next-hint">
            <span className="hero-hint-label">Next up</span>
            <span className="hero-hint-name">{next.name}</span>
            <span className="hero-hint-when">{nextLabel} · {next.start}</span>
          </div>
        </section>
      );
    }

    const imminent = mins <= 2;

    return (
      <section className={`hero hero-upnext${imminent ? " hero-imminent" : ""}`} style={tintStyle}>
        <HeroBackdrop sysConfig={sysConfig} />
        <div className="hero-time-tint" />
        <div className="hero-state-row">
          <div className="hero-tag next"><span className="dot amber" />Up next</div>
          {next.code && (
            <span className={`ses ${subjectClass(next.code)}`}>
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
          ? <LaterCountdown target={s} />
          : <HeroCountdown target={s} />}
      </section>
    );
  }

  return (
    <section className="hero hero-clear" style={tintStyle}>
      <HeroBackdrop sysConfig={sysConfig} />
      <div className="hero-time-tint" />
      <div className="hero-state-row">
        <div className="hero-tag done"><span className="dot" />All clear</div>
      </div>
      <h1 className="hero-course">Nothing scheduled</h1>
      <div className="hero-when">No upcoming sessions in your selected courses.</div>
    </section>
  );
}

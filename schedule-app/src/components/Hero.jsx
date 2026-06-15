import { MapPin } from "lucide-react";

function clsDate(c, which) {
  const [Y, Mo, D] = c.date.split("-").map(Number);
  const [h, m] = c[which].split(":").map(Number);
  return new Date(Y, Mo - 1, D, h, m);
}

function prettyDate(iso) {
  const [Y, M, D] = iso.split("-").map(Number);
  return new Date(Y, M - 1, D).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
}

function UpNext({ c }) {
  return (
    <div className="upnext">
      <span className="up-label">Then</span>
      <span className="up-t">{c.start}</span>
      <span className="up-c">{c.name}</span>
      {c.room && <span className="up-r">{c.room}</span>}
    </div>
  );
}

export default function Hero({ current, next, now, todayISO }) {
  if (current) {
    const s = clsDate(current, "start"), e = clsDate(current, "end");
    const done = Math.min(1, Math.max(0, (now - s) / (e - s)));
    const left = Math.max(0, Math.round((e - now) / 60000));
    return (
      <section className="hero">
        <div className="hero-tag in"><span className="dot" /> In session{current.session ? ` · ${current.code} ${current.session}` : ""}</div>
        <h1 className="hero-course">{current.name}</h1>
        <div className="hero-meta">
          <span className="t">{current.start}<span className="dash">–</span>{current.end}</span>
          {current.room && <><span className="sep">·</span><span className="r"><MapPin size={14} /> {current.room}</span></>}
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
    return (
      <section className="hero">
        <div className="hero-tag next"><span className="dot amber" /> Up next{next.session ? ` · ${next.code} ${next.session}` : ""}</div>
        <h1 className="hero-course">{next.name}</h1>
        <div className="hero-meta">
          <span className="t">{next.start}</span>
          {next.room && <><span className="sep">·</span><span className="r"><MapPin size={14} /> {next.room}</span></>}
          {next.faculty && <><span className="sep">·</span><span className="f">{next.faculty}</span></>}
        </div>
        <div className="hero-when">{sameDay ? (mins <= 90 ? `Starts in ${mins} min` : "Later today") : prettyDate(next.date)}</div>
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

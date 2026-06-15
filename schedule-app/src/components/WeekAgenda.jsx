import { ChevronLeft, ChevronRight } from "lucide-react";

function toMin(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

export default function WeekAgenda({ visible, now, offset, setOffset, todayISO }) {
  const monday = new Date(now);
  const dow = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - dow + offset * 7);
  monday.setHours(0, 0, 0, 0);

  const days = [...Array(7)].map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const label = `${monday.toLocaleDateString([], { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString([], { day: "numeric", month: "short" })}`;

  return (
    <section className="panel">
      <div className="weeknav">
        <button onClick={() => setOffset(offset - 1)} aria-label="Previous week"><ChevronLeft size={18} /></button>
        <div className="weeknav-mid">
          <span className="wk-range">{label}</span>
          {offset !== 0 && <button className="wk-today" onClick={() => setOffset(0)}>This week</button>}
        </div>
        <button onClick={() => setOffset(offset + 1)} aria-label="Next week"><ChevronRight size={18} /></button>
      </div>

      {days.map((d) => {
        const iso = ymd(d);
        const items = visible.filter((c) => c.date === iso).sort((a, b) => toMin(a.start) - toMin(b.start));
        return (
          <div key={iso} className={`agday ${iso === todayISO ? "agtoday" : ""}`}>
            <div className="agday-h">
              <span className="agday-dow">{d.toLocaleDateString([], { weekday: "short" })}</span>
              <span className="agday-num">{d.getDate()}</span>
              {iso === todayISO && <span className="agday-today">Today</span>}
            </div>
            <div className="agday-body">
              {items.length === 0
                ? <span className="agday-free">–</span>
                : items.map((c, i) => (
                    <div key={i} className={`ag ${c.type !== "class" ? "soft" : ""}`}>
                      <span className="ag-t">{c.start}</span>
                      <span className="ag-c">
                        {c.name}
                        {c.session && <span className="ses">{c.code} {c.session}</span>}
                      </span>
                      {c.type === "class" && c.room && <span className="ag-r">{c.room}</span>}
                    </div>
                  ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

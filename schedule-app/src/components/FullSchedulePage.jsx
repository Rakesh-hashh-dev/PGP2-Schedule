import { useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Clock, MapPin, User } from "lucide-react";

function toMin(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }

function fmtDate(iso) {
  const [Y, M, D] = iso.split("-").map(Number);
  return new Date(Y, M - 1, D).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

export default function FullSchedulePage({ allClasses, enrolled, legend, termLabel, onBack }) {
  const [filterCode, setFilterCode] = useState(null); // null = show all

  // Get only the user's enrolled classes, sorted chronologically
  const myClasses = useMemo(() => {
    if (!enrolled) return [];
    return allClasses
      .filter(c => {
        if (c.type !== "class") return false;
        const sec = enrolled[c.code];
        return sec !== undefined && c.section === sec;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || toMin(a.start) - toMin(b.start));
  }, [allClasses, enrolled]);

  // Group by subject code for filter chips
  const subjectCodes = useMemo(() => {
    const codes = [...new Set(myClasses.map(c => c.code))];
    codes.sort((a, b) => (legend[a]?.name || a).localeCompare(legend[b]?.name || b));
    return codes;
  }, [myClasses, legend]);

  // Apply filter
  const filtered = filterCode ? myClasses.filter(c => c.code === filterCode) : myClasses;

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map();
    for (const c of filtered) {
      if (!map.has(c.date)) map.set(c.date, []);
      map.get(c.date).push(c);
    }
    return [...map.entries()];
  }, [filtered]);

  const totalSessions = filtered.length;

  return (
    <div className="fs-page">
      {/* Header */}
      <div className="fs-header">
        <button className="fr-btn fr-btn-secondary fs-back" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="fs-header-info">
          <h1 className="fs-title">Full Schedule</h1>
          <span className="fs-subtitle">
            {filterCode ? (legend[filterCode]?.name || filterCode) : `${subjectCodes.length} subjects`} · {totalSessions} sessions
            {termLabel && <> · {termLabel}</>}
          </span>
        </div>
      </div>

      {/* Subject filter chips */}
      <div className="fs-filters">
        <button
          className={`fs-chip ${!filterCode ? "fs-chip-on" : ""}`}
          onClick={() => setFilterCode(null)}
        >
          All Subjects
        </button>
        {subjectCodes.map(code => (
          <button
            key={code}
            className={`fs-chip ${filterCode === code ? "fs-chip-on" : ""}`}
            onClick={() => setFilterCode(filterCode === code ? null : code)}
          >
            {code}
          </button>
        ))}
      </div>

      {/* Schedule grouped by date */}
      <div className="fs-list">
        {grouped.length === 0 ? (
          <p className="fr-empty" style={{ textAlign: "center", padding: "40px 0" }}>No sessions found.</p>
        ) : (
          grouped.map(([date, items]) => (
            <div key={date} className="fs-day">
              <div className="fs-day-header">
                <span className="fs-day-label">{fmtDate(date)}</span>
                <span className="fs-day-count">{items.length} session{items.length > 1 ? "s" : ""}</span>
              </div>
              <div className="fs-day-items">
                {items.map((c, i) => {
                  const colorIdx = (Array.from(c.code).reduce((h, ch) => h + ch.charCodeAt(0), 0)) % 6;
                  return (
                    <div key={i} className="fs-card">
                      <div className={`fs-card-accent accent-${colorIdx}`} />
                      <div className="fs-card-body">
                        <div className="fs-card-top">
                          <span className="fs-card-name">{c.name}</span>
                          <span className={`ses ses-${colorIdx}`}>{c.code} {c.session}</span>
                        </div>
                        <div className="fs-card-meta">
                          <span className="fs-meta-item"><Clock size={13} /> {c.start} – {c.end}</span>
                          {c.room && <span className="fs-meta-item"><MapPin size={13} /> {c.room}</span>}
                          {c.faculty && <span className="fs-meta-item"><User size={13} /> {c.faculty}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

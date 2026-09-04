import { useState } from "react";
import { SplitSquareHorizontal, X } from "lucide-react";
import "../styles/provisional.css";

const DISMISS_KEY = "pgp2.dismissed-provisional-sections";

function loadDismissed() {
  try { return localStorage.getItem(DISMISS_KEY) || ""; } catch { return ""; }
}

// Explains the two ways an enrolled course can fail to show a normal timetable.
//
// `codes` — the section isn't allocated in the roster sheet yet. The roster
// script reports an unallocated course as "Single", which matches no row of an
// A/B timetable, so rather than hide the course App.jsx shows every section and
// this explains why the same class appears at two different times.
//
// `unscheduled` — the course is in the term's legend and the student is
// enrolled, but the master timetable has no rows for it at all (nor a roster
// tab). There is nothing to show and no section to guess at; without this the
// course simply sits in their subject list producing an empty calendar.
export default function ProvisionalSectionNotice({ codes, unscheduled = [], legend, sectionsByCode }) {
  // Keyed by the exact course set, so a newly-affected course re-opens the
  // notice instead of inheriting an old dismissal.
  const key = [...codes].sort().join(",") + "|" + [...unscheduled].sort().join(",");
  const [dismissedKey, setDismissedKey] = useState(loadDismissed);
  if ((!codes.length && !unscheduled.length) || dismissedKey === key) return null;

  const dismiss = () => {
    setDismissedKey(key);
    try { localStorage.setItem(DISMISS_KEY, key); } catch { /* blocked storage */ }
  };

  const named = codes.map((code) => ({
    code,
    name: legend?.[code]?.name || code,
    sections: sectionsByCode?.[code] || [],
  }));
  const pending = unscheduled.map((code) => ({ code, name: legend?.[code]?.name || code }));

  return (
    <section className="ps-note" role="status">
      <div className="ps-note-ico"><SplitSquareHorizontal size={18} /></div>
      <div className="ps-note-body">
        {named.length > 0 && (
          <>
            <div className="ps-note-title">
              {named.length === 1
                ? "Your section for this course isn't assigned yet"
                : `Sections aren't assigned yet for ${named.length} courses`}
            </div>
            <ul className="ps-note-list">
              {named.map(({ code, name, sections }) => (
                <li key={code}>
                  <strong>{name}</strong>
                  {sections.length > 0 && (
                    <span> · showing {sections.join(" and ")}</span>
                  )}
                </li>
              ))}
            </ul>
            <p className="ps-note-sub">
              Every section is shown until the roster is updated, so you may see the
              same class listed at two different times. It corrects itself
              automatically once your section is allocated.
            </p>
          </>
        )}
        {pending.length > 0 && (
          <>
            <div className="ps-note-title" style={named.length ? { marginTop: 10 } : undefined}>
              {pending.length === 1
                ? "This course hasn't been timetabled yet"
                : `${pending.length} of your courses haven't been timetabled yet`}
            </div>
            <ul className="ps-note-list">
              {pending.map(({ code, name }) => (
                <li key={code}><strong>{name}</strong></li>
              ))}
            </ul>
            <p className="ps-note-sub">
              The schedule sheet has no sessions for it so far, so nothing appears
              on your calendar. It will fill in on its own once the sessions and
              your section are published — you don't need to re-do your setup.
            </p>
          </>
        )}
      </div>
      <button type="button" className="ps-note-dismiss" aria-label="Dismiss" onClick={dismiss}>
        <X size={13} />
      </button>
    </section>
  );
}

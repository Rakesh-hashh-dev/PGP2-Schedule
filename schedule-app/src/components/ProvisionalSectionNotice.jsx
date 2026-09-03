import { useState } from "react";
import { SplitSquareHorizontal, X } from "lucide-react";
import "../styles/provisional.css";

const DISMISS_KEY = "pgp2.dismissed-provisional-sections";

function loadDismissed() {
  try { return localStorage.getItem(DISMISS_KEY) || ""; } catch { return ""; }
}

// Shown when a course's section hasn't been allocated in the roster sheet yet.
// The roster script reports an unallocated course as "Single", which matches no
// row of an A/B timetable — so rather than hide the course, App.jsx shows every
// section and this explains why the same class appears at two different times.
export default function ProvisionalSectionNotice({ codes, legend, sectionsByCode }) {
  // Keyed by the exact course set, so a newly-affected course re-opens the
  // notice instead of inheriting an old dismissal.
  const key = [...codes].sort().join(",");
  const [dismissedKey, setDismissedKey] = useState(loadDismissed);
  if (!codes.length || dismissedKey === key) return null;

  const dismiss = () => {
    setDismissedKey(key);
    try { localStorage.setItem(DISMISS_KEY, key); } catch { /* blocked storage */ }
  };

  const named = codes.map((code) => ({
    code,
    name: legend?.[code]?.name || code,
    sections: sectionsByCode?.[code] || [],
  }));

  return (
    <section className="ps-note" role="status">
      <div className="ps-note-ico"><SplitSquareHorizontal size={18} /></div>
      <div className="ps-note-body">
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
      </div>
      <button type="button" className="ps-note-dismiss" aria-label="Dismiss" onClick={dismiss}>
        <X size={13} />
      </button>
    </section>
  );
}

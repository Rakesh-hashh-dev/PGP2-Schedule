export default function MobileV2Switcher({ view, examsEnabled, onNavigate }) {
  let label;
  let items;

  if (view === "today" || view === "tomorrow") {
    label = "Choose day";
    items = [["today", "Today"], ["tomorrow", "Tomorrow"]];
  } else if (view === "week" || view === "fullSchedule") {
    label = "Schedule view";
    items = [["week", "Week"], ["fullSchedule", "Full timetable"]];
  } else if (view === "assignments" || view === "exams") {
    if (!examsEnabled) return null;
    label = "Task type";
    items = [["assignments", "Assignments"], ["exams", "Exams"]];
  } else {
    return null;
  }

  return (
    <div className="mobile-v2-switcher" role="tablist" aria-label={label}>
      {items.map(([id, text]) => (
        <button
          type="button"
          key={id}
          role="tab"
          aria-selected={view === id}
          className={view === id ? "is-active" : ""}
          onClick={() => onNavigate(id)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

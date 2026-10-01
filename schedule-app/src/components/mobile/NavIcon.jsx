import "../../styles/nav-icons.css";

// A shared, two-tone SVG family for both mobile navigation layouts.
export default function NavIcon({ kind, size = 22 }) {
  const artwork = {
    today: <><circle className="nav-icon-wash" cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="8.5" /><path d="M12 6.5V12l3.5 2M7 3.5l-2 2M17 3.5l2 2" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></>,
    tomorrow: <><path className="nav-icon-wash" d="M6 16a6 6 0 0 1 12 0Z" /><path d="M6 16a6 6 0 0 1 12 0M3 16h18M5 20h14M12 3v3M4.5 8l2 2M19.5 8l-2 2" /><path d="m10 7 2-2 2 2" /></>,
    schedule: <><rect className="nav-icon-wash" x="3.5" y="5" width="17" height="16" rx="4" /><rect x="3.5" y="5" width="17" height="16" rx="4" /><path d="M8 3v4M16 3v4M4 10h16M7.5 14h2M14.5 14h2M7.5 17.5h2" /><rect x="14" y="16.5" width="3" height="3" rx=".8" fill="currentColor" stroke="none" /></>,
    attendance: <><path className="nav-icon-wash" d="M8 5H6a2.5 2.5 0 0 0-2.5 2.5v11A2.5 2.5 0 0 0 6 21h12a2.5 2.5 0 0 0 2.5-2.5v-11A2.5 2.5 0 0 0 18 5h-2" /><path d="M8 5H6a2.5 2.5 0 0 0-2.5 2.5v11A2.5 2.5 0 0 0 6 21h12a2.5 2.5 0 0 0 2.5-2.5v-11A2.5 2.5 0 0 0 18 5h-2" /><rect x="8" y="3" width="8" height="4" rx="2" /><path d="m8 14 2.5 2.5L16 11" /></>,
    exams: <><path className="nav-icon-wash" d="m2.5 9 9.5-5 9.5 5-9.5 5Z" /><path d="m2.5 9 9.5-5 9.5 5-9.5 5Z" /><path d="M6 11v6c3.5 2.5 8.5 2.5 12 0v-6M21.5 9v7M20 18h3" /></>,
    social: <><circle className="nav-icon-wash" cx="9" cy="8" r="3.5" /><circle cx="9" cy="8" r="3.5" /><path className="nav-icon-wash" d="M2.5 20v-2a6.5 6.5 0 0 1 13 0v2Z" /><path d="M2.5 20v-2a6.5 6.5 0 0 1 13 0v2M16 4.5a3.5 3.5 0 0 1 0 7M18 14a5 5 0 0 1 3.5 4.8V20" /></>,
    planner: <><rect className="nav-icon-wash" x="4" y="4" width="16" height="17" rx="3.5" /><rect x="4" y="4" width="16" height="17" rx="3.5" /><path d="M8 2.5v3M16 2.5v3M8 10h8M8 14h4M8 17.5h2" /><path d="m14 17 1.5 1.5 3-3" /></>,
    tasks: <><rect className="nav-icon-wash" x="3.5" y="3.5" width="17" height="17" rx="4.5" /><rect x="3.5" y="3.5" width="17" height="17" rx="4.5" /><path d="m7.5 12 3 3 6-6" /></>,
    more: <><rect className="nav-icon-wash" x="3" y="3" width="7" height="7" rx="2.5" /><rect x="3" y="3" width="7" height="7" rx="2.5" /><rect x="14" y="3" width="7" height="7" rx="2.5" /><rect x="3" y="14" width="7" height="7" rx="2.5" /><path d="M14.5 17.5h6M17.5 14.5v6" /></>,
  };
  return <svg className="premium-nav-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{artwork[kind]}</svg>;
}

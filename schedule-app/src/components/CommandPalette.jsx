import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, Calendar, ClipboardList, Clock, GraduationCap,
  Megaphone, Package, Search, Users, X, Zap,
} from "lucide-react";
import { CalendarEventBadgeSVG } from "./CalendarSVGs.jsx";
import "../styles/cmdk.css";

const PAGES = [
  { id: "today", label: "Today", detail: "Your day at a glance", Icon: Clock },
  { id: "week", label: "Week", detail: "Upcoming classes", Icon: Calendar },
  { id: "attendance", label: "Attendance", detail: "Marks and status", Icon: ClipboardList },
  { id: "exams", label: "Exams", detail: "Exam schedule", Icon: GraduationCap },
  { id: "notifications", label: "Announcements", detail: "Campus updates", Icon: Megaphone },
  { id: "friends", label: "Social", detail: "Friends and activity", Icon: Users },
  { id: "board", label: "Campus Board", detail: "Posts and conversations", Icon: Package },
  { id: "glance", label: "Glance", detail: "Quick overview", Icon: Zap },
];

export default function CommandPalette({ isOpen, onClose, onViewChange, allClasses = [], friends = [], onOpenCalendarExport }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const modalRef = useRef(null);
  const listRef = useRef(null);

  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (isOpen) { setQuery(""); setSelectedIndex(0); }
  }

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousFocus = document.activeElement;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = event => {
      if (event.key === "Escape") onClose();
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const q = query.trim().toLowerCase();
  const uniqueClasses = useMemo(() => [...new Map(
    allClasses.filter(item => item.type === "class" && item.name && item.code)
      .map(item => [item.code, item])
  ).values()], [allClasses]);

  const groups = [];
  if (!q || "add subjects to calendar ios android ical export sync google apple phone".includes(q)) {
    groups.push({ label: "Quick action", items: [{
      id: "cal-export", label: "Add subjects to Calendar", detail: "Export to your phone or calendar app",
      icon: <CalendarEventBadgeSVG size={18} />,
      perform: () => { onOpenCalendarExport?.(); onClose(); },
    }] });
  }

  const pages = PAGES.filter(item => !q || `${item.label} ${item.detail}`.toLowerCase().includes(q))
    .map(item => ({
      ...item, icon: <item.Icon size={18} strokeWidth={1.9} />,
      perform: () => { onViewChange(item.id); onClose(); },
    }));
  if (pages.length) groups.push({ label: "Pages", items: pages });

  if (q) {
    const classes = uniqueClasses.filter(item =>
      `${item.name} ${item.code} ${item.room || ""}`.toLowerCase().includes(q)
    ).slice(0, 5).map(item => ({
      id: `class-${item.code}`, label: item.name,
      detail: [item.code, item.room].filter(Boolean).join(" · "),
      icon: <GraduationCap size={18} strokeWidth={1.9} />,
      perform: () => { onViewChange("fullSchedule"); onClose(); },
    }));
    if (classes.length) groups.push({ label: "Classes", items: classes });

    const people = friends.filter(item => item.name?.toLowerCase().includes(q))
      .slice(0, 3).map(item => ({
        id: `friend-${item.id}`, label: item.name, detail: "Open Social",
        icon: <Users size={18} strokeWidth={1.9} />,
        perform: () => { onViewChange("friends"); onClose(); },
      }));
    if (people.length) groups.push({ label: "Friends", items: people });
  }

  const results = groups.flatMap(group => group.items);
  const activeIndex = Math.min(selectedIndex, results.length - 1);

  useEffect(() => {
    if (isOpen && activeIndex >= 0) {
      listRef.current?.querySelector(`[data-result-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, isOpen, query]);

  const handleModalKeyDown = event => {
    if (event.key === "Tab") {
      const focusable = [...modalRef.current.querySelectorAll("button, input")];
      const edge = event.shiftKey ? focusable[0] : focusable.at(-1);
      if (document.activeElement === edge) {
        event.preventDefault();
        (event.shiftKey ? focusable.at(-1) : focusable[0])?.focus();
      }
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!results.length) return;
      event.preventDefault();
      setSelectedIndex(index => (index + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length);
      inputRef.current?.focus();
    } else if (event.key === "Enter" && results.length && document.activeElement === inputRef.current) {
      event.preventDefault();
      results[activeIndex]?.perform();
    }
  };

  if (!isOpen) return null;

  let resultIndex = 0;
  return (
    <div className="cmd-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="cmd-modal" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="cmd-title" onKeyDown={handleModalKeyDown}>
        <div className="cmd-heading">
          <div><p>TERMFlow SEARCH</p><h2 id="cmd-title">Where would you like to go?</h2></div>
          <button type="button" className="cmd-close" onClick={onClose} aria-label="Close search"><X size={18} /></button>
        </div>
        <div className="cmd-search-wrap">
          <Search size={19} className="cmd-icon" aria-hidden="true" />
          <input ref={inputRef} className="cmd-input" type="search" aria-label="Search pages, classes, and friends"
            aria-controls="cmd-results" placeholder="Search pages, classes, friends…" value={query}
            onChange={event => { setQuery(event.target.value); setSelectedIndex(0); }} />
          {query && <button type="button" className="cmd-clear" onClick={() => { setQuery(""); setSelectedIndex(0); inputRef.current?.focus(); }} aria-label="Clear search"><X size={15} /></button>}
        </div>

        <div className="cmd-body" id="cmd-results" ref={listRef}>
          {results.length === 0 ? (
            <div className="cmd-empty"><Search size={24} aria-hidden="true" /><strong>No matches for “{query}”</strong><span>Try a page name, course code, room, or friend.</span></div>
          ) : groups.map(group => (
            <section className="cmd-section" key={group.label} aria-label={group.label}>
              <div className="cmd-section-title"><span>{group.label}</span><span>{group.items.length}</span></div>
              {group.items.map(item => {
                const index = resultIndex++;
                return (
                  <button type="button" key={item.id} className={`cmd-item${index === activeIndex ? " is-active" : ""}`}
                    data-result-index={index} onMouseEnter={() => setSelectedIndex(index)} onClick={item.perform}>
                    <span className="cmd-item-icon" aria-hidden="true">{item.icon}</span>
                    <span className="cmd-item-copy"><strong>{item.label}</strong><small>{item.detail}</small></span>
                    <ArrowRight className="cmd-item-arrow" size={16} aria-hidden="true" />
                  </button>
                );
              })}
            </section>
          ))}
        </div>
        <div className="cmd-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> Move</span>
          <span><kbd>Enter</kbd> Open</span>
          <span><kbd>Esc</kbd> Close</span>
          <span className="cmd-footer-count">{results.length} {results.length === 1 ? "result" : "results"}</span>
        </div>
      </div>
    </div>
  );
}

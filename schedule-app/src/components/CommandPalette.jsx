import React, { useState, useEffect, useRef } from "react";
import "../styles/cmdk.css";
import { Search, Clock, Calendar, ClipboardList, GraduationCap, Users, Megaphone, MapPin, X, Package, Zap } from "lucide-react";
import { CalendarEventBadgeSVG } from "./CalendarSVGs.jsx";

export default function CommandPalette({ isOpen, onClose, onViewChange, allClasses = [], friends = [], onOpenCalendarExport }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  // Reset the query when the palette opens — adjusted during render (React docs
  // pattern) instead of inside an effect, so there is no cascading re-render.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (isOpen) setQuery("");
  }

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        isOpen ? onClose() : document.dispatchEvent(new CustomEvent("open-command-palette"));
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const q = query.toLowerCase();

  // Search classes
  const uniqueClasses = React.useMemo(() => {
    return Array.from(new Map(allClasses.filter(c => c.type === "class" && c.name).map(c => [c.code, c])).values());
  }, [allClasses]);

  const classMatches = React.useMemo(() => {
    if (!q) return [];
    return uniqueClasses.filter(c => 
      c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || (c.room && c.room.toLowerCase().includes(q))
    ).slice(0, 5);
  }, [uniqueClasses, q]);

  // Search friends
  const friendMatches = React.useMemo(() => {
    if (!q) return [];
    return friends.filter(f => f.name.toLowerCase().includes(q)).slice(0, 3);
  }, [friends, q]);

  if (!isOpen) return null;

  // Actions
  const actionItems = [
    {
      id: "cal-export",
      label: "Add subjects to Calendar (iOS / Android)",
      icon: <CalendarEventBadgeSVG size={18} />,
      perform: () => { onOpenCalendarExport?.(); onClose(); }
    }
  ].filter(i => i.label.toLowerCase().includes(q) || "calendar ical export sync google apple phone".includes(q));

  // Navigation links.
  const navItems = [
    { id: "today", label: "Today", icon: <Clock size={16} /> },
    { id: "week", label: "Week", icon: <Calendar size={16} /> },
    { id: "attendance", label: "Attendance", icon: <ClipboardList size={16} /> },
    { id: "exams", label: "Exams", icon: <GraduationCap size={16} /> },
    { id: "notifications", label: "Announcements", icon: <Megaphone size={16} /> },
    { id: "friends", label: "Social", icon: <Users size={16} /> },
    { id: "board", label: "Campus Board", icon: <Package size={16} /> },
    { id: "glance", label: "Glance", icon: <Zap size={16} /> },
  ].filter(i => i.label.toLowerCase().includes(q));

  const hasResults = navItems.length > 0 || actionItems.length > 0 || classMatches.length > 0 || friendMatches.length > 0;

  return (
    <div className="cmd-backdrop" onClick={onClose}>
      <div className="cmd-modal" onClick={e => e.stopPropagation()}>
        <div className="cmd-header">
          <Search size={18} className="cmd-icon" />
          <input 
            ref={inputRef}
            className="cmd-input" 
            placeholder="Search classes, friends, or jump to..." 
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button className="cmd-close" onClick={onClose}><X size={18} /></button>
        </div>
        
        <div className="cmd-body">
          {!hasResults && <div className="cmd-empty">No results found for "{query}"</div>}

          {actionItems.length > 0 && (
            <div className="cmd-section">
              <div className="cmd-section-title">Quick Actions</div>
              {actionItems.map(item => (
                <button key={item.id} className="cmd-item" onClick={item.perform}>
                  {item.icon} <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}

          {navItems.length > 0 && (
            <div className="cmd-section">
              <div className="cmd-section-title">Navigation</div>
              {navItems.map(item => (
                <button key={item.id} className="cmd-item" onClick={() => { onViewChange(item.id); onClose(); }}>
                  {item.icon} <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}

          {classMatches.length > 0 && (
            <div className="cmd-section">
              <div className="cmd-section-title">Classes</div>
              {classMatches.map(c => (
                <button key={c.code} className="cmd-item" onClick={() => { onViewChange("fullSchedule"); onClose(); }}>
                  <div className="cmd-class-info">
                    <span className="cmd-class-name">{c.name} ({c.code})</span>
                    {c.room && <span className="cmd-class-room"><MapPin size={12} /> {c.room}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {friendMatches.length > 0 && (
            <div className="cmd-section">
              <div className="cmd-section-title">Friends</div>
              {friendMatches.map(f => (
                <button key={f.id} className="cmd-item" onClick={() => { onViewChange("friends"); onClose(); }}>
                  <Users size={16} /> <span>{f.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="cmd-footer">
          <span><kbd>↑</kbd> <kbd>↓</kbd> to navigate</span>
          <span><kbd>Enter</kbd> to select</span>
          <span><kbd>Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}

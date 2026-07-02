import React, { useState, useEffect, useRef } from "react";
import "../styles/cmdk.css";
import { Search, Users, Flag, FileText, X } from "lucide-react";

export default function AdminCommandPalette({ isOpen, onClose, allUsers = [], flags = {}, auditLogs = [], onUserSelect, onFlagSelect }) {
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
      // Cmd+Shift+K or Ctrl+Shift+K
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        isOpen ? onClose() : document.dispatchEvent(new CustomEvent("open-admin-command-palette"));
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const q = query.toLowerCase();

  // Search Users
  const userMatches = React.useMemo(() => {
    if (!q) return [];
    return allUsers.filter(u => 
      (u.name && u.name.toLowerCase().includes(q)) || 
      (u.user_id && u.user_id.toLowerCase().includes(q))
    ).slice(0, 5);
  }, [allUsers, q]);

  // Search Flags
  const flagMatches = React.useMemo(() => {
    if (!q) return [];
    const allFlagKeys = Object.keys(flags);
    return allFlagKeys.filter(key => key.toLowerCase().includes(q)).slice(0, 5);
  }, [flags, q]);

  // Search Audit Logs
  const logMatches = React.useMemo(() => {
    if (!q) return [];
    return auditLogs.filter(log => 
      log.action.toLowerCase().includes(q) || 
      (log.admin_id && log.admin_id.toLowerCase().includes(q))
    ).slice(0, 5);
  }, [auditLogs, q]);

  if (!isOpen) return null;

  const hasResults = userMatches.length > 0 || flagMatches.length > 0 || logMatches.length > 0;

  return (
    <div className="cmd-backdrop" onClick={onClose} style={{ zIndex: 10000 }}>
      <div className="cmd-modal" onClick={e => e.stopPropagation()}>
        <div className="cmd-header">
          <Search size={18} className="cmd-icon" />
          <input 
            ref={inputRef}
            className="cmd-input" 
            placeholder="Admin Search: Users, Flags, Logs..." 
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button className="cmd-close" onClick={onClose}><X size={18} /></button>
        </div>
        
        <div className="cmd-body">
          {!hasResults && q && <div className="cmd-empty">No admin results found for "{query}"</div>}
          {!q && <div className="cmd-empty" style={{ opacity: 0.7 }}>Start typing to search across the admin panel...</div>}

          {userMatches.length > 0 && (
            <div className="cmd-section">
              <div className="cmd-section-title">Users</div>
              {userMatches.map(u => (
                <button key={u.user_id} className="cmd-item" onClick={() => { onUserSelect(u); onClose(); }}>
                  <Users size={16} /> <span>{u.name || "Student"} <span style={{ opacity: 0.5, fontSize: "0.8em" }}>({u.user_id.substring(0, 8)})</span></span>
                </button>
              ))}
            </div>
          )}

          {flagMatches.length > 0 && (
            <div className="cmd-section">
              <div className="cmd-section-title">Feature Flags</div>
              {flagMatches.map(fKey => (
                <button key={fKey} className="cmd-item" onClick={() => { onFlagSelect(fKey); onClose(); }}>
                  <Flag size={16} /> <span>{fKey}</span>
                  <span style={{ marginLeft: "auto", fontSize: "0.8em", background: flags[fKey] ? "var(--live)" : "var(--muted)", color: "white", padding: "2px 6px", borderRadius: 10 }}>
                    {typeof flags[fKey] === "boolean" ? (flags[fKey] ? "ON" : "OFF") : "CONFIG"}
                  </span>
                </button>
              ))}
            </div>
          )}

          {logMatches.length > 0 && (
            <div className="cmd-section">
              <div className="cmd-section-title">Audit Logs</div>
              {logMatches.map(log => (
                <button key={log.id || log.created_at} className="cmd-item" style={{ cursor: "default" }}>
                  <FileText size={16} /> 
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                    <span>{log.action}</span>
                    <span style={{ fontSize: "0.75em", opacity: 0.7 }}>{new Date(log.created_at).toLocaleString()}</span>
                  </div>
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

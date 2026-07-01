import { useState, useEffect } from "react";
import { Users, Megaphone, Flag, Save, Trash2, ShieldAlert, Check, Search, RefreshCw, AlertTriangle, CalendarDays, XCircle, VenetianMask, Ban, BarChart3, Terminal, Clock, Database, FileText, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { LEGEND } from "../data/schedule.js";
import { getSnapshot } from "../lib/sheet.js";
import AdminCommandPalette from "./AdminCommandPalette";
import Hero from "./Hero.jsx";

export async function logAdminAction(admin_id, action, details) {
  try {
    await supabase.from("admin_audit_logs").insert({ admin_id, action, details });
  } catch (e) {
    console.error("Audit log failed", e);
  }
}

function Avatar({ name, email }) {
  const init = name ? name[0] : (email ? email[0] : "?");
  return <div className="admin-avatar">{init.toUpperCase()}</div>;
}

export default function AdminDashboard({ user, startImpersonation, syncLogs = [], timeOverride, setTimeOverride, allChanges = [] }) {
  const [totalUsers, setTotalUsers] = useState(null);
  const [activeUsers, setActiveUsers] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const [dbSize, setDbSize] = useState("...");
  
  const [announcement, setAnnouncement] = useState("");
  const [activeAnnouncement, setActiveAnnouncement] = useState(null);
  
  const [showAllAdminNotifs, setShowAllAdminNotifs] = useState(false);
  
  const [flags, setFlags] = useState({
    enableFriends: true,
    enableExams: true,
    enableAttendance: true,
    maintenanceMode: false,
    bannedUsers: [],
    classOverrides: {},
    abTests: {}
  });
  
  const [popularCourses, setPopularCourses] = useState([]);
  const [overrideDate, setOverrideDate] = useState("");
  const [overrideClass, setOverrideClass] = useState("");
  const [roomOverrideDate, setRoomOverrideDate] = useState("");
  const [roomOverrideClass, setRoomOverrideClass] = useState("");
  const [roomOverrideRoom, setRoomOverrideRoom] = useState("");
  const [roomOverrideStart, setRoomOverrideStart] = useState("");
  const [roomOverrideEnd, setRoomOverrideEnd] = useState("");
  const [roomOverrideSection, setRoomOverrideSection] = useState("All");
  
  const [showAllLogs, setShowAllLogs] = useState(false);
  const displayedLogs = showAllLogs ? syncLogs : syncLogs.slice(0, 5);
  
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const [allUsers, setAllUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);

  // New states
  const [feedbackList, setFeedbackList] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [announcementTarget, setAnnouncementTarget] = useState("global");
  const [selectedUser, setSelectedUser] = useState(null);

  // Scheduled Announcements State
  const [announcementStart, setAnnouncementStart] = useState("");
  const [announcementEnd, setAnnouncementEnd] = useState("");

  // Quick Links State
  const [qlTitle, setQlTitle] = useState("");
  const [qlUrl, setQlUrl] = useState("");
  const [qlStart, setQlStart] = useState("");
  const [qlEnd, setQlEnd] = useState("");

  // Software Update Config
  const [updatePromptTitle, setUpdatePromptTitle] = useState("");
  const [updatePromptDesc, setUpdatePromptDesc] = useState("");
  const [updatePromptHighlights, setUpdatePromptHighlights] = useState("");

  // Live Editor State
  const [liveSchedule, setLiveSchedule] = useState([]);
  const [liveEditorDate, setLiveEditorDate] = useState(new Date().toISOString().split("T")[0]);
  const [liveEditorModal, setLiveEditorModal] = useState(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const admin_id = user?.id || user?.user_id || "unknown";

  useEffect(() => {
    const handleOpen = () => setIsCommandPaletteOpen(true);
    document.addEventListener("open-admin-command-palette", handleOpen);
    return () => document.removeEventListener("open-admin-command-palette", handleOpen);
  }, []);

  useEffect(() => {
    setLiveSchedule(getSnapshot().CLASSES || []);
  }, []);

  const fetchDashboardData = async () => {
    setStatsLoading(true);
    setLoadingUsers(true);

    async function fetchStatsAndUsers() {
      try {
        const { data, count, error } = await supabase.from("profiles").select("user_id, courses", { count: "exact" });
        if (error) {
          console.error("Supabase Error:", error);
          setTotalUsers("Error: " + error.message);
        } else if (data) {
          setTotalUsers(count);
          let allEnrolled = [];
          const usersWithNames = data.map(d => {
            if (d.courses) {
               const courses = Object.keys(d.courses).filter(c => c !== "_name" && c !== "_email");
               allEnrolled.push(...courses);
            }
            return {
              user_id: d.user_id,
              name: d.courses?._name || "Student",
              courses: d.courses
            };
          });
          setAllUsers(usersWithNames);
          setActiveUsers(Math.floor(count * 0.85)); // Mock active users for now

          // Tally popular courses
          const counts = {};
          allEnrolled.forEach(c => { counts[c] = (counts[c] || 0) + 1; });
          const topCourses = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 3);
          setPopularCourses(topCourses);
        } else {
          setTotalUsers("No data returned");
        }
      } catch (e) {
        console.error("Fetch Error:", e);
        setTotalUsers("Error: " + e.message);
      }
    }

    async function fetchDbSize() {
      try {
        const { data, error } = await supabase.rpc("get_db_size");
        if (error) {
          setDbSize("Error");
        } else {
          setDbSize(data || "N/A");
        }
      } catch (e) {
        setDbSize("Error");
      }
    }

    async function fetchFeedbackAndLogs() {
      const { data: fb } = await supabase.from("feedback").select("*").order("created_at", { ascending: false }).limit(20);
      if (fb) setFeedbackList(fb);

      const { data: logs } = await supabase.from("admin_audit_logs").select("*").order("created_at", { ascending: false }).limit(20);
      if (logs) setAuditLogs(logs);
    }

    await Promise.all([
      fetchStatsAndUsers(),
      fetchDbSize(),
      fetchFeedbackAndLogs()
    ]);
    
    setStatsLoading(false);
    setLoadingUsers(false);
  };

  useEffect(() => {
    fetchDashboardData();

    async function fetchConfig() {
      try {
        const { data, error } = await supabase.from("system_config").select("*").eq("id", "global").single();
        if (data) {
          if (data.announcement) {
            setActiveAnnouncement(data.announcement);
            setAnnouncement(data.announcement);
          }
          if (data.flags) {
            setFlags(prev => ({ ...prev, ...data.flags }));
            if (data.flags.updatePrompt) {
              setUpdatePromptTitle(data.flags.updatePrompt.title || "");
              setUpdatePromptDesc(data.flags.updatePrompt.desc || "");
              setUpdatePromptHighlights(data.flags.updatePrompt.highlights?.join("\n") || "");
            }
          }
        }
      } catch (e) {
        // Table likely doesn't exist yet
      }
    }
    fetchConfig();
  }, []);

  async function saveConfig() {
    setSaving(true);
    setSaveMsg("");
    try {
      const newFlags = {
        ...flags,
        updatePrompt: {
          title: updatePromptTitle,
          desc: updatePromptDesc,
          highlights: updatePromptHighlights.split("\n").filter(l => l.trim())
        }
      };
      const { error } = await supabase.from("system_config").upsert({
        id: "global",
        announcement: activeAnnouncement,
        flags: newFlags,
        updated_at: new Date().toISOString()
      });
      if (error) {
        setSaveMsg("Failed: " + error.message);
      } else {
        await logAdminAction(admin_id, "save_config", { announcement: activeAnnouncement, flags: newFlags });
        setSaveMsg("Successfully saved to cloud!");
        setTimeout(() => setSaveMsg(""), 3000);
      }
    } catch (e) {
      setSaveMsg("Error saving config.");
    }
    setSaving(false);
  }

  async function forceRefresh() {
    if (confirm("Are you sure you want to force all active users to refresh their app?")) {
      await saveConfig();
      await logAdminAction(admin_id, "force_refresh", {});
      alert("Broadcast sent! Users will refresh on their next navigation.");
    }
  }

  const filteredUsers = allUsers.filter(u => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.user_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddOverride = () => {
    if (!overrideDate || !overrideClass) {
      alert("Please select a date and enter a class code to cancel.");
      return;
    }
    const nextOverrides = { ...(flags.classOverrides || {}) };
    if (!nextOverrides[overrideDate]) nextOverrides[overrideDate] = {};
    nextOverrides[overrideDate][overrideClass] = { type: "cancelled", name: `Cancelled: ${overrideClass}` };
    setFlags({...flags, classOverrides: nextOverrides});
    logAdminAction(admin_id, "cancel_class", { date: overrideDate, class: overrideClass });
    setOverrideClass("");
  };

  const handleAddRoomOverride = () => {
    if (!roomOverrideDate || !roomOverrideClass || (!roomOverrideRoom && !roomOverrideStart && !roomOverrideEnd)) {
      alert("Please fill in Date, Class Code, and at least one change (Room, Start Time, or End Time).");
      return;
    }
    const nextOverrides = { ...(flags.classOverrides || {}) };
    if (!nextOverrides[roomOverrideDate]) nextOverrides[roomOverrideDate] = {};
    
    const overrideKey = roomOverrideSection === "All" ? roomOverrideClass : `${roomOverrideClass}_${roomOverrideSection}`;
    const existing = nextOverrides[roomOverrideDate][overrideKey] || {};
    
    const changes = { ...existing };
    if (roomOverrideRoom) changes.room = roomOverrideRoom;
    if (roomOverrideStart) changes.start = roomOverrideStart;
    if (roomOverrideEnd) changes.end = roomOverrideEnd;
    
    nextOverrides[roomOverrideDate][overrideKey] = changes;
    setFlags({...flags, classOverrides: nextOverrides});
    logAdminAction(admin_id, "edit_class_override", { date: roomOverrideDate, class: overrideKey, changes });
    setRoomOverrideClass("");
    setRoomOverrideRoom("");
    setRoomOverrideStart("");
    setRoomOverrideEnd("");
    setRoomOverrideSection("All");
  };

  const markFeedbackResolved = async (id) => {
    await supabase.from("feedback").update({ status: "resolved" }).eq("id", id);
    setFeedbackList(feedbackList.map(f => f.id === id ? { ...f, status: "resolved" } : f));
  };

  const exportConfigJSON = () => {
    const json = JSON.stringify({ announcement: activeAnnouncement, flags }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config_backup.json';
    a.click();
    logAdminAction(admin_id, "export_config", {});
  };

  return (
    <div className="admin-page">
      
      {/* ── Hero Section ── */}
      <section className="hero" style={{ marginBottom: 32, padding: "40px 20px", textAlign: "center", borderRadius: 24 }}>
        <div style={{ display: "inline-flex", background: "rgba(109, 91, 208, 0.1)", color: "var(--live)", padding: "12px 24px", borderRadius: 30, alignItems: "center", gap: 12, marginBottom: 16 }}>
          <ShieldAlert size={28} />
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px" }}>Admin Control Center</h1>
          <button onClick={fetchDashboardData} disabled={statsLoading} style={{ background: "transparent", border: "none", color: "var(--live)", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", justifyContent: "center", opacity: statsLoading ? 0.5 : 1 }} title="Refresh Data">
            <RefreshCw size={20} className={statsLoading ? "spin-icon" : ""} />
          </button>
          <button onClick={() => setIsCommandPaletteOpen(true)} style={{ background: "transparent", border: "none", color: "var(--live)", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", justifyContent: "center" }} title="Open Command Palette (Cmd+Shift+K)">
            <Search size={20} />
          </button>
        </div>
        <p style={{ color: "var(--muted)", margin: "0 0 32px 0", fontSize: 16 }}>Global settings, feature flags, and user management.</p>
        
        <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
          <div style={{ background: "var(--card)", padding: "16px 32px", borderRadius: 16, border: "1px solid var(--border)", minWidth: 180 }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700, color: "var(--muted)", marginBottom: 8, letterSpacing: "1px" }}>Total Users</div>
            <div style={{ fontSize: 36, fontWeight: 800, fontFamily: "var(--display)", color: "var(--text)" }}>{statsLoading ? "..." : totalUsers}</div>
          </div>
          <div style={{ background: "var(--card)", padding: "16px 32px", borderRadius: 16, border: "1px solid var(--border)", minWidth: 180 }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700, color: "var(--muted)", marginBottom: 8, letterSpacing: "1px" }}>Active Today</div>
            <div style={{ fontSize: 36, fontWeight: 800, fontFamily: "var(--display)", color: "var(--text)" }}>{statsLoading ? "..." : activeUsers}</div>
          </div>
          <div style={{ background: "var(--card)", padding: "16px 32px", borderRadius: 16, border: "1px solid var(--border)", minWidth: 180 }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700, color: "var(--muted)", marginBottom: 8, letterSpacing: "1px", display: "flex", alignItems: "center", gap: 6 }}><Database size={14}/> DB Storage Used</div>
            <div style={{ fontSize: 36, fontWeight: 800, fontFamily: "var(--display)", color: "var(--text)" }}>{statsLoading ? "..." : dbSize}</div>
          </div>

        </div>
      </section>

      {/* ── Linear Layout ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        <section className="admin-card" style={{ display: "flex", flexDirection: "column" }}>
          <h2><Megaphone size={20} color="var(--amber)" /> Scheduled Announcements</h2>
          <p className="admin-subtext">Schedule targeted announcements. Active ones will appear as banners to matched users.</p>
          
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input type="date" value={announcementStart} onChange={e => setAnnouncementStart(e.target.value)} className="admin-input" style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid var(--border)" }} title="Start Date" />
            <input type="date" value={announcementEnd} onChange={e => setAnnouncementEnd(e.target.value)} className="admin-input" style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid var(--border)" }} title="End Date (Inclusive)" />
            <select className="admin-input" value={announcementTarget} onChange={e => setAnnouncementTarget(e.target.value)} style={{ flex: 2, padding: "8px", borderRadius: 8, border: "1px solid var(--border)" }}>
              <option value="global">Global</option>
              <option value="section_A">Section A</option>
              <option value="section_B">Section B</option>
              <option value="has_friends">Social Users</option>
              <optgroup label="Subject Wise">
                {Object.entries(LEGEND || {}).map(([code, info]) => (
                  <option key={code} value={`subject_${code}`}>{code}</option>
                ))}
              </optgroup>
            </select>
          </div>
          <textarea 
            className="admin-textarea"
            value={announcement}
            onChange={e => setAnnouncement(e.target.value)}
            placeholder="e.g., Exam registration closes tomorrow!"
          />
          <button className="admin-btn primary" style={{ marginTop: 12 }} onClick={() => {
            if (!announcement || !announcementStart || !announcementEnd) return alert("Please fill message and dates.");
            const newItem = { id: Date.now().toString(), message: announcement, target: announcementTarget, start: announcementStart, end: announcementEnd };
            setFlags({...flags, scheduledAnnouncements: [...(flags.scheduledAnnouncements || []), newItem]});
            setAnnouncement(""); setAnnouncementStart(""); setAnnouncementEnd("");
          }}>
            Add Scheduled Announcement
          </button>

          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {(flags.scheduledAnnouncements || []).map(a => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{a.message}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Target: {a.target} | {a.start} to {a.end}</div>
                </div>
                <button onClick={() => {
                  setFlags({...flags, scheduledAnnouncements: flags.scheduledAnnouncements.filter(x => x.id !== a.id)});
                }} className="admin-btn outline" style={{ padding: "4px 8px", borderColor: "var(--danger)", color: "var(--danger)" }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-card" style={{ display: "flex", flexDirection: "column" }}>
          <h2><Flag size={20} color="var(--violet)" /> Dynamic Quick Links</h2>
          <p className="admin-subtext">Push temporary important links to the sidebar (e.g. Exam Portal).</p>
          
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <input type="text" placeholder="Link Title" value={qlTitle} onChange={e => setQlTitle(e.target.value)} className="admin-input" style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid var(--border)", minWidth: 150 }} />
            <input type="url" placeholder="https://..." value={qlUrl} onChange={e => setQlUrl(e.target.value)} className="admin-input" style={{ flex: 2, padding: "8px", borderRadius: 8, border: "1px solid var(--border)", minWidth: 200 }} />
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input type="date" value={qlStart} onChange={e => setQlStart(e.target.value)} className="admin-input" style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid var(--border)" }} title="Start Date" />
            <input type="date" value={qlEnd} onChange={e => setQlEnd(e.target.value)} className="admin-input" style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid var(--border)" }} title="End Date (Inclusive)" />
            <button className="admin-btn primary" onClick={() => {
              if (!qlTitle || !qlUrl || !qlStart || !qlEnd) return alert("Fill all fields.");
              const newItem = { id: Date.now().toString(), title: qlTitle, url: qlUrl, start: qlStart, end: qlEnd };
              setFlags({...flags, quickLinks: [...(flags.quickLinks || []), newItem]});
              setQlTitle(""); setQlUrl(""); setQlStart(""); setQlEnd("");
            }}>
              Add Quick Link
            </button>
          </div>

          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
            {(flags.quickLinks || []).map(ql => (
              <div key={ql.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{ql.title}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{ql.url} | {ql.start} to {ql.end}</div>
                </div>
                <button onClick={() => {
                  setFlags({...flags, quickLinks: flags.quickLinks.filter(x => x.id !== ql.id)});
                }} className="admin-btn outline" style={{ padding: "4px 8px", borderColor: "var(--danger)", color: "var(--danger)" }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </section>

        {/* Feedback Section */}
        <section className="admin-card">
          <h2><Terminal size={20} color="var(--green)" /> Feedback & Bug Reports</h2>
          <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
            {feedbackList.length === 0 ? <div className="admin-empty">No feedback yet.</div> : 
             feedbackList.map(f => (
               <div key={f.id} style={{ padding: "12px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8 }}>
                 <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                   <span style={{ fontSize: 12, color: "var(--muted)" }}>{new Date(f.created_at).toLocaleString()}</span>
                   <span style={{ fontSize: 12, fontWeight: 700, color: f.status === "resolved" ? "var(--green)" : "var(--amber)" }}>{f.status.toUpperCase()}</span>
                 </div>
                 <div style={{ fontSize: 14, color: "var(--text)" }}>{f.message}</div>
                 {f.status === "pending" && (
                   <button onClick={() => markFeedbackResolved(f.id)} style={{ marginTop: 8, background: "transparent", border: "none", color: "var(--green)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Mark Resolved</button>
                 )}
               </div>
             ))
            }
          </div>
        </section>

        <section className="admin-card admin-directory-card">
          <h2><Users size={20} color="var(--green)" /> User Directory</h2>
          <div className="admin-search-box">
            <Search size={16} color="var(--muted)" />
            <input 
              type="text" 
              placeholder="Search users..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div style={{ marginBottom: 12, display: "flex", gap: 12 }}>
            <button className="admin-btn outline" onClick={exportConfigJSON} style={{ padding: "6px 12px", fontSize: 13 }}>Backup Config to JSON</button>
          </div>
          <div className="admin-user-list">
            {loadingUsers ? (
              <div className="admin-loading">Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="admin-empty">No users found.</div>
            ) : (
              filteredUsers.map(u => (
                <div key={u.user_id} className="admin-user-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    <Avatar name={u.name} email={u.user_id} />
                    <div className="admin-user-info" onClick={() => setSelectedUser(u)} style={{ cursor: "pointer" }} title="Click to view full details">
                      <div className="admin-user-name" style={{ color: flags.bannedUsers?.includes(u.user_id) ? "var(--danger)" : "inherit" }}>
                         {u.name || "Student"} {flags.bannedUsers?.includes(u.user_id) && "(Banned)"}
                      </div>
                      <div className="admin-user-id">{u.user_id}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => startImpersonation(u)} className="admin-btn-icon" title="Impersonate User" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 6 }}>
                      <VenetianMask size={20} color="var(--amber)" />
                    </button>
                    <button onClick={() => {
                       const isBanned = flags.bannedUsers?.includes(u.user_id);
                       const next = isBanned ? flags.bannedUsers.filter(id => id !== u.user_id) : [...(flags.bannedUsers || []), u.user_id];
                       setFlags({...flags, bannedUsers: next});
                       logAdminAction(admin_id, isBanned ? "unban_user" : "ban_user", { target_user: u.user_id });
                    }} className="admin-btn-icon" title={flags.bannedUsers?.includes(u.user_id) ? "Unban User" : "Ban User"} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 6 }}>
                      <Ban size={20} color={flags.bannedUsers?.includes(u.user_id) ? "var(--danger)" : "var(--muted)"} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
          <section className="admin-card">
            <h2><Flag size={20} color="var(--violet)" /> Feature Flags</h2>
            <div className="admin-flag-list">
              {Object.keys(flags).filter(k => k !== "maintenanceMode" && k !== "bannedUsers" && k !== "classOverrides" && k !== "abTests" && k !== "scheduledAnnouncements" && k !== "quickLinks" && k !== "heroBackdrop").map(key => (
                <label key={key} className="admin-flag-item">
                  <input 
                    type="checkbox" 
                    checked={flags[key]} 
                    onChange={e => setFlags({ ...flags, [key]: e.target.checked })}
                  />
                  <span>{key}</span>
                </label>
              ))}
            </div>
            
            <div className="admin-field" style={{ marginTop: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px" }}>Hero Backdrop Strategy</label>
              <select 
                className="admin-input" 
                value={flags.heroBackdrop || "swap"} 
                onChange={e => setFlags({ ...flags, heroBackdrop: e.target.value })}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", width: "100%" }}
              >
                <option value="none">None (Remove Background)</option>
                <option value="swap">Swap Alt Days (Default)</option>
                <option value="v2">Static (V2 Image)</option>
                <option value="v3">Static (V3 Image)</option>
              </select>
            </div>
            
            <div style={{ marginTop: 24 }}>
               <label style={{ display: "block", marginBottom: 8, fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px" }}>Preview</label>
               <div style={{ borderRadius: 16, overflow: "hidden", position: "relative", pointerEvents: "none", border: "1px solid var(--border)", paddingBottom: 16, background: "var(--bg)" }}>
                 <div style={{ transform: "scale(0.8)", transformOrigin: "top center", marginBottom: "-40px" }}>
                   <Hero 
                     sysConfig={{ flags: { heroBackdrop: flags.heroBackdrop } }}
                     now={new Date().getTime() - 1000 * 60 * 30}
                     todayISO={new Date().toISOString().split("T")[0]}
                     tomorrowISO={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
                     current={{ name: "Strategic Management", start: "10:00", end: "11:30", room: "LT-1", date: new Date().toISOString().split("T")[0], type: "class", code: "SM" }}
                     premiumMode={true}
                   />
                 </div>
               </div>
            </div>
          </section>

          <section className="admin-card">
            <h2><Megaphone size={20} color="var(--amber)" /> All Announcements</h2>
            <div className="admin-subtext" style={{ marginBottom: 16 }}>Live feed of all schedule changes (including admin-only data quality issues).</div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {allChanges.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)", background: "rgba(0,0,0,0.02)", borderRadius: 8 }}>No announcements found.</div>
              ) : (
                allChanges.slice(0, showAllAdminNotifs ? undefined : 3).map(c => (
                  <div key={c.id} style={{ 
                    padding: "10px 14px", 
                    background: "rgba(0,0,0,0.02)", 
                    borderRadius: 8, 
                    borderLeft: `3px solid ${c.admin_only ? "var(--amber)" : "var(--violet)"}`,
                    borderStyle: c.admin_only ? "dashed" : "solid",
                    borderTop: "1px solid var(--border)",
                    borderRight: "1px solid var(--border)",
                    borderBottom: "1px solid var(--border)"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", lineHeight: 1.4 }}>{c.text}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "flex", gap: 8 }}>
                          <span>{new Date(c.ts).toLocaleString()}</span>
                          {c.admin_only && <span style={{ color: "var(--amber)", fontWeight: 700 }}>ADMIN ONLY</span>}
                          {c.code && <span>Course: {c.code}</span>}
                          <span>Type: {c.kind}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
              
              {allChanges.length > 3 && (
                <button 
                  onClick={() => setShowAllAdminNotifs(true)}
                  style={{
                    padding: "8px",
                    background: "transparent",
                    border: "1px dashed var(--border)",
                    borderRadius: 8,
                    cursor: "pointer",
                    color: "var(--muted)",
                    fontWeight: 600,
                    marginTop: 4,
                    transition: "all 0.2s"
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--text)"; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--muted)"; }}
                >
                  View More ({allChanges.length - 3} remaining)
                </button>
              )}
            </div>
          </section>

          {showAllAdminNotifs && (
            <div className="assign-modal-overlay" onClick={() => setShowAllAdminNotifs(false)}>
              <div className="assign-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600, maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
                <div className="assign-modal-head">
                  <h2><Megaphone size={20} color="var(--amber)" style={{ verticalAlign: "middle", marginRight: 8, marginTop: -3 }} /> All Announcements</h2>
                  <button className="assign-modal-close" onClick={() => setShowAllAdminNotifs(false)}><X size={16} /></button>
                </div>
                <div className="assign-modal-body" style={{ overflowY: "auto", flex: 1, padding: "24px 32px", gap: 12 }}>
                  {allChanges.map(c => (
                    <div key={c.id} style={{ 
                      padding: "12px 16px", 
                      background: "rgba(0,0,0,0.02)", 
                      borderRadius: 10, 
                      borderLeft: `3px solid ${c.admin_only ? "var(--amber)" : "var(--violet)"}`,
                      borderStyle: c.admin_only ? "dashed" : "solid",
                      borderTop: "1px solid var(--border)",
                      borderRight: "1px solid var(--border)",
                      borderBottom: "1px solid var(--border)"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", lineHeight: 1.4 }}>{c.text}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <span>{new Date(c.ts).toLocaleString()}</span>
                            {c.admin_only && <span style={{ color: "var(--amber)", fontWeight: 700 }}>ADMIN ONLY</span>}
                            {c.code && <span>Course: {c.code}</span>}
                            <span>Type: {c.kind}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <section className="admin-card danger-zone">
            <h2><AlertTriangle size={20} color="var(--danger, #e74c3c)" /> Danger Zone</h2>
            
            <div className="admin-danger-row">
              <div>
                <strong style={{ display: "block", marginBottom: 4 }}>Maintenance Mode</strong>
                <span className="admin-subtext" style={{ margin: 0 }}>Locks out all non-admin users immediately.</span>
              </div>
              <label className="admin-toggle">
                <input 
                  type="checkbox" 
                  checked={flags.maintenanceMode} 
                  onChange={e => setFlags({ ...flags, maintenanceMode: e.target.checked })}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="admin-danger-row">
              <div>
                <strong style={{ display: "block", marginBottom: 4 }}>Force Global Refresh</strong>
                <span className="admin-subtext" style={{ margin: 0 }}>Force all clients to re-sync from cloud.</span>
              </div>
              <button className="admin-btn outline" onClick={forceRefresh}>
                <RefreshCw size={14} /> Force Sync
              </button>
            </div>
          </section>

          {/* Class Cancellation Board */}
          <section className="admin-card" style={{ gridColumn: "1 / -1" }}>
            <h2><XCircle size={20} color="var(--danger)" /> Class Cancellation Board</h2>
            <p className="admin-subtext">Globally cancel a class for all students on a specific date.</p>
            <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
               <input type="date" className="admin-input" value={overrideDate} onChange={e => setOverrideDate(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)" }} />
               <input type="text" placeholder="Class Code (e.g. BM)" className="admin-input" value={overrideClass} onChange={e => setOverrideClass(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)" }} />
               <button className="cva-btn primary" onClick={handleAddOverride} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--danger)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Cancel Class</button>
            </div>
          </section>

          {/* Class Editor */}
          <section className="admin-card" style={{ gridColumn: "1 / -1" }}>
            <h2><CalendarDays size={20} color="var(--blue)" /> Class Editor</h2>
            <p className="admin-subtext">Globally change the classroom or timings for a specific class on a given date.</p>
            <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
               <input type="date" className="admin-input" value={roomOverrideDate} onChange={e => setRoomOverrideDate(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)" }} />
               <input type="text" placeholder="Class Code (e.g. BM)" className="admin-input" value={roomOverrideClass} onChange={e => setRoomOverrideClass(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)" }} />
               
               <select className="admin-input" value={roomOverrideSection} onChange={e => setRoomOverrideSection(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)" }}>
                 <option value="All">All Sections</option>
                 <option value="A">Section A</option>
                 <option value="B">Section B</option>
               </select>

               <input type="time" title="Start Time" className="admin-input" value={roomOverrideStart} onChange={e => setRoomOverrideStart(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)" }} />
               <input type="time" title="End Time" className="admin-input" value={roomOverrideEnd} onChange={e => setRoomOverrideEnd(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)" }} />
               <input type="text" placeholder="New Classroom" className="admin-input" value={roomOverrideRoom} onChange={e => setRoomOverrideRoom(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)" }} />
               <button className="cva-btn primary" onClick={handleAddRoomOverride} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--blue)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Save Change</button>
               {roomOverrideDate && roomOverrideClass && flags.classOverrides?.[roomOverrideDate]?.[roomOverrideSection === "All" ? roomOverrideClass : `${roomOverrideClass}_${roomOverrideSection}`] && (
                 <button className="cva-btn outline" onClick={() => {
                    const overrideKey = roomOverrideSection === "All" ? roomOverrideClass : `${roomOverrideClass}_${roomOverrideSection}`;
                    const next = {...flags.classOverrides};
                    delete next[roomOverrideDate][overrideKey];
                    if (Object.keys(next[roomOverrideDate]).length === 0) delete next[roomOverrideDate];
                    setFlags({...flags, classOverrides: next});
                    setRoomOverrideClass("");
                    setRoomOverrideRoom("");
                    setRoomOverrideStart("");
                    setRoomOverrideEnd("");
                    setRoomOverrideSection("All");
                 }} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--danger)", color: "var(--danger)", background: "transparent", cursor: "pointer", fontWeight: 600 }}>Remove Override</button>
               )}
            </div>
          </section>

          {/* Active Overrides List */}
          {flags.classOverrides && Object.keys(flags.classOverrides).length > 0 && (
            <section className="admin-card" style={{ gridColumn: "1 / -1" }}>
              <h2>Active Class Overrides</h2>
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(flags.classOverrides).map(([date, classes]) => 
                  Object.keys(classes).map(code => {
                    const override = classes[code];
                    const isCancelled = override.type === "cancelled";
                    const isRoomChanged = !!override.room;
                    const isTimeChanged = !!override.start || !!override.end;
                    const isModified = isRoomChanged || isTimeChanged;
                    const codeParts = code.split('_');
                    const displayCode = codeParts.length > 1 ? `${codeParts[0]} (Sec ${codeParts[1]})` : code;

                    return (
                      <div key={`${date}-${code}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.03)", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border)" }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>
                          {new Date(date).toLocaleDateString()} — {displayCode} 
                          {isCancelled && <span style={{ color: "var(--danger)", marginLeft: 8 }}>(Cancelled)</span>}
                          {isModified && !isCancelled && (
                            <span style={{ color: "var(--blue)", marginLeft: 8 }}>
                              ({[override.room && `Room: ${override.room}`, (override.start || override.end) && `${override.start || "?"} - ${override.end || "?"}`].filter(Boolean).join(" | ")})
                            </span>
                          )}
                        </span>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          {isModified && (
                            <button onClick={() => {
                               setRoomOverrideDate(date);
                               setRoomOverrideClass(codeParts[0]);
                               setRoomOverrideSection(codeParts[1] || "All");
                               setRoomOverrideRoom(override.room || "");
                               setRoomOverrideStart(override.start || "");
                               setRoomOverrideEnd(override.end || "");
                            }} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 13, color: "var(--blue)", fontWeight: 600, padding: "4px 8px" }}>
                               Edit
                            </button>
                          )}
                          <button onClick={() => {
                             const next = {...flags.classOverrides};
                             delete next[date][code];
                             if (Object.keys(next[date]).length === 0) delete next[date];
                             setFlags({...flags, classOverrides: next});
                          }} style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 4 }}>
                             <Trash2 size={16} color="var(--danger)" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          )}

          {/* Software Update Prompt Config */}
          <section className="admin-card">
            <h2><RefreshCw size={20} color="var(--violet)" /> Update Prompt Text</h2>
            <p className="admin-subtext">Configure what users see when a new app version is available.</p>
            <div className="admin-field">
              <label>Title</label>
              <input className="admin-input" value={updatePromptTitle} onChange={e => setUpdatePromptTitle(e.target.value)} placeholder="TermFlow just got better" />
            </div>
            <div className="admin-field">
              <label>Description</label>
              <textarea className="admin-textarea" value={updatePromptDesc} onChange={e => setUpdatePromptDesc(e.target.value)} placeholder="A fresh version is cached..." rows={2}></textarea>
            </div>
            <div className="admin-field">
              <label>Highlights (one per line)</label>
              <textarea className="admin-textarea" value={updatePromptHighlights} onChange={e => setUpdatePromptHighlights(e.target.value)} placeholder="Faster load times&#10;New features..." rows={3}></textarea>
            </div>
          </section>

          {/* Interactive Live Schedule Editor */}
          <section className="admin-card" style={{ gridColumn: "1 / -1" }}>
            <h2><CalendarDays size={20} color="var(--blue)" /> Live Schedule Editor</h2>
            <p className="admin-subtext">Click on a class slot to visually change the room or cancel the class.</p>
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <input type="date" className="admin-input" value={liveEditorDate} onChange={e => setLiveEditorDate(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }} />
            </div>
            <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 16 }}>
              {(() => {
                const baseClasses = liveSchedule.filter(c => c.date === liveEditorDate && c.type !== "break");
                const newClasses = [];
                const overridesForDate = flags.classOverrides?.[liveEditorDate] || {};
                
                Object.keys(overridesForDate).forEach(key => {
                  const codeParts = key.split('_');
                  const code = codeParts[0];
                  const section = codeParts[1] || "All";
                  const exists = baseClasses.some(c => c.code === code && (c.section === section || section === "All" || c.section === "Single"));
                  
                  if (!exists) {
                    const ovr = overridesForDate[key];
                    if (ovr.type !== "cancelled") {
                      newClasses.push({
                        date: liveEditorDate,
                        code: code,
                        section: section,
                        name: ovr.name || "Custom Added Class",
                        room: ovr.room || "",
                        start: ovr.start || "",
                        end: ovr.end || "",
                        type: ovr.type || "class"
                      });
                    }
                  }
                });
                
                const displayClasses = [...baseClasses, ...newClasses];
                
                // --- CONFLICT DETECTOR ---
                const conflicts = [];
                function toMinFP(t) { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); }
                
                for (let i = 0; i < displayClasses.length; i++) {
                  for (let j = i + 1; j < displayClasses.length; j++) {
                    const c1 = displayClasses[i];
                    const c2 = displayClasses[j];
                    
                    const ovr1 = overridesForDate[`${c1.code}_${c1.section}`] || overridesForDate[c1.code];
                    const ovr2 = overridesForDate[`${c2.code}_${c2.section}`] || overridesForDate[c2.code];
                    
                    if (ovr1?.type === "cancelled" || ovr2?.type === "cancelled") continue;
                    
                    const room1 = ovr1?.room || c1.room;
                    const room2 = ovr2?.room || c2.room;
                    
                    const start1 = toMinFP(ovr1?.start || c1.start || "00:00");
                    const end1 = toMinFP(ovr1?.end || c1.end || "00:00");
                    const start2 = toMinFP(ovr2?.start || c2.start || "00:00");
                    const end2 = toMinFP(ovr2?.end || c2.end || "00:00");

                    // Overlap logic: start1 < end2 && start2 < end1
                    const isTimeOverlap = start1 < end2 && start2 < end1;
                    
                    if (isTimeOverlap) {
                      if (room1 && room2 && room1.toLowerCase() === room2.toLowerCase() && room1.toLowerCase() !== "tbd") {
                        conflicts.push(`Room Double-Booked: ${room1} (${c1.code} and ${c2.code})`);
                      } else if (c1.section === c2.section || c1.section === "All" || c2.section === "All") {
                        conflicts.push(`Section Overlap: Section ${c1.section === "All" ? c2.section : c1.section} expected in ${c1.code} and ${c2.code} simultaneously.`);
                      }
                    }
                  }
                }
                // -------------------------

                if (displayClasses.length === 0) {
                  return <div className="admin-empty">No classes found for this date.</div>;
                }
                
                const classElements = displayClasses.map((c, i) => {
                  const override = overridesForDate[`${c.code}_${c.section}`] || overridesForDate[c.code] || null;
                  const isCancelled = override?.type === "cancelled";
                  const displayRoom = override?.room || c.room;
                  const displayStart = override?.start || c.start;
                  const displayEnd = override?.end || c.end;
                  return (
                    <div key={i} onClick={() => setLiveEditorModal(c)} style={{ minWidth: 200, padding: 12, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, cursor: "pointer", position: "relative", opacity: isCancelled ? 0.6 : 1 }}>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4, textDecoration: isCancelled ? "line-through" : "none" }}>{displayStart} - {displayEnd} | Sec: {c.section}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 4, textDecoration: isCancelled ? "line-through" : "none" }}>{c.code} - {c.name || "Class"}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)", textDecoration: isCancelled ? "line-through" : "none" }}>Room: {displayRoom || "TBD"}</div>
                      {override && <div style={{ position: "absolute", top: -6, right: -6, background: "var(--amber)", color: "#000", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 800 }}>OVERRIDDEN</div>}
                    </div>
                  );
                });
                
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
                    {conflicts.length > 0 && (
                       <div style={{ background: "rgba(231, 76, 60, 0.1)", border: "1px solid var(--danger)", padding: 12, borderRadius: 8, color: "var(--danger)" }}>
                         <strong style={{ display: "flex", alignItems: "center", gap: 8 }}><AlertTriangle size={16} /> Conflict Warning</strong>
                         <ul style={{ margin: "8px 0 0 0", paddingLeft: 20, fontSize: 13 }}>
                           {Array.from(new Set(conflicts)).map((c, idx) => <li key={idx}>{c}</li>)}
                         </ul>
                       </div>
                    )}
                    <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
                       {classElements}
                    </div>
                  </div>
                );
              })()}
            </div>
          </section>

          {/* Time Machine */}
          <section className="admin-card" style={{ gridColumn: "1 / -1" }}>
            <h2><Clock size={20} color="var(--amber)" /> Time Machine</h2>
            <p className="admin-subtext">Override the application's current time to test the timeline, agenda, and UI states.</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
              <input type="datetime-local" className="admin-input" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)" }}
                 value={timeOverride || ""} onChange={e => setTimeOverride(e.target.value)} />
              {timeOverride && (
                <button className="admin-btn outline" onClick={() => setTimeOverride(null)}>Reset to Real Time</button>
              )}
            </div>
            {timeOverride && (
               <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(245, 158, 11, 0.1)", border: "1px solid var(--amber)", color: "var(--amber)", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                 ⚠️ The application is currently running in simulated time.
               </div>
            )}
          </section>



          {/* Live Sync Logs */}
          <section className="admin-card" style={{ gridColumn: "1 / -1" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <h2 style={{ margin: 0, padding: 0 }}><Terminal size={20} color="var(--violet)" /> Live Sync Logs</h2>
                <p className="admin-subtext" style={{ margin: 0 }}>Real-time status of the connection to the Google Apps Script live feed.</p>
              </div>
              {syncLogs.length > 5 && (
                <button className="admin-btn outline" onClick={() => setShowAllLogs(!showAllLogs)} style={{ padding: "6px 12px", fontSize: 12 }}>
                  {showAllLogs ? "Show Less" : "View All Logs"}
                </button>
              )}
            </div>
            <div style={{ background: "rgba(0,0,0,0.8)", color: "#e2e8f0", borderRadius: 8, padding: 16, marginTop: 16, maxHeight: showAllLogs ? 500 : 200, overflowY: "auto", fontFamily: "monospace", fontSize: 13, border: "1px solid var(--border)", boxShadow: "inset 0 2px 10px rgba(0,0,0,0.2)" }}>
              {displayedLogs.length === 0 ? (
                <div style={{ color: "var(--muted)", fontStyle: "italic" }}>No sync logs yet. Press "Force Sync" above to test connection.</div>
              ) : (
                displayedLogs.map((log, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{new Date(log.ts).toLocaleTimeString()}</span>
                    <span style={{ color: log.status === "error" ? "var(--danger)" : "var(--green)", fontWeight: 700, width: 60 }}>[{log.status.toUpperCase()}]</span>
                    <span style={{ wordBreak: "break-word", color: log.status === "error" ? "var(--danger)" : "#e2e8f0" }}>{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Audit Logs */}
          <section className="admin-card" style={{ gridColumn: "1 / -1" }}>
            <h2><Terminal size={20} color="var(--violet)" /> Admin Audit Logs</h2>
            <p className="admin-subtext">Recent administrative actions performed by all admins.</p>
            <div style={{ padding: 16, marginTop: 16 }}>
              {auditLogs.length === 0 ? (
                <div className="admin-empty">No audit logs found.</div>
              ) : (
                <div style={{ position: "relative", borderLeft: "2px solid var(--border)", paddingLeft: 24, marginLeft: 12, display: "flex", flexDirection: "column", gap: 24 }}>
                  {auditLogs.map((log) => {
                     let Icon = FileText;
                     let color = "var(--text)";
                     if (log.action.includes("save") || log.action.includes("refresh")) { Icon = Save; color = "var(--blue)"; }
                     else if (log.action.includes("cancel") || log.action.includes("override") || log.action.includes("edit")) { Icon = AlertTriangle; color = "var(--amber)"; }
                     else if (log.action.includes("ban") || log.action.includes("delete")) { Icon = Trash2; color = "var(--danger)"; }
                     
                     return (
                        <div key={log.id} style={{ position: "relative" }}>
                           <div style={{ position: "absolute", left: -41, top: 0, width: 32, height: 32, borderRadius: 16, background: "var(--bg)", border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
                              <Icon size={16} color={color} />
                           </div>
                           <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                              <div style={{ flex: 1, minWidth: 200 }}>
                                 <div style={{ fontWeight: 800, color, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{log.action.replace(/_/g, ' ')}</div>
                                 <div style={{ fontSize: 13, color: "var(--muted)" }}>Admin ID: {log.admin_id}</div>
                                 {Object.keys(log.details || {}).length > 0 && (
                                   <pre style={{ margin: "8px 0 0 0", background: "rgba(0,0,0,0.02)", padding: "8px 12px", borderRadius: 8, fontSize: 12, border: "1px solid var(--border)", overflowX: "auto", maxWidth: "100%", color: "var(--text)" }}>
                                      {JSON.stringify(log.details, null, 2)}
                                   </pre>
                                 )}
                              </div>
                              <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", fontWeight: 600 }}>{new Date(log.created_at).toLocaleString()}</span>
                           </div>
                        </div>
                     );
                  })}
                </div>
              )}
            </div>
          </section>

        </div>

      </div>

      <div className="admin-save-footer">
        <button className="admin-save-btn" onClick={saveConfig} disabled={saving}>
          <Save size={18} /> {saving ? "Saving..." : "Deploy Config to Cloud"}
        </button>
        {saveMsg && (
          <span className={`admin-save-msg ${saveMsg.includes("Failed") || saveMsg.includes("Error") ? "error" : "success"}`}>
            {saveMsg.includes("Successfully") && <Check size={16} />}
            {saveMsg}
          </span>
        )}
      </div>

      {/* User X-Ray Modal */}
      {selectedUser && (
        <>
          <div className="notif-backdrop" onClick={() => setSelectedUser(null)} style={{ zIndex: 10000 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "var(--card)", padding: 24, borderRadius: 16, width: "90%", maxWidth: 400, zIndex: 10001, border: "1px solid var(--border)", boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, display: "flex", gap: 8, alignItems: "center" }}><Users size={18} color="var(--violet)" /> User Information</h2>
              <button onClick={() => setSelectedUser(null)} style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer" }}><XCircle size={18} /></button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><strong style={{ color: "var(--muted)", fontSize: 12, display: "block", textTransform: "uppercase" }}>Name</strong>{selectedUser.name}</div>
              <div><strong style={{ color: "var(--muted)", fontSize: 12, display: "block", textTransform: "uppercase" }}>User ID</strong>{selectedUser.user_id}</div>
              <div>
                <strong style={{ color: "var(--muted)", fontSize: 12, display: "block", textTransform: "uppercase", marginBottom: 4 }}>Enrolled Subjects</strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {selectedUser.courses ? Object.keys(selectedUser.courses).filter(c => c !== "_name" && c !== "_email").map(c => (
                    <span key={c} style={{ background: "var(--bg)", padding: "2px 8px", borderRadius: 4, fontSize: 12, border: "1px solid var(--border)", color: "var(--text)" }}>{c}</span>
                  )) : <span style={{ fontSize: 12, color: "var(--muted)" }}>No subjects enrolled.</span>}
                </div>
              </div>
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                <button onClick={async () => {
                  if (confirm("Are you sure you want to reset this user's setup? They will have to onboard again.")) {
                    await supabase.from("profiles").update({ courses: null }).eq("user_id", selectedUser.user_id);
                    await logAdminAction(admin_id, "reset_user_setup", { target_user: selectedUser.user_id });
                    setAllUsers(allUsers.map(u => u.user_id === selectedUser.user_id ? { ...u, courses: null } : u));
                    setSelectedUser(null);
                    alert("User setup cleared.");
                  }
                }} className="admin-btn outline" style={{ color: "var(--danger)", borderColor: "var(--danger)", width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: 8 }}>
                  <Trash2 size={16} /> Reset Setup
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Live Editor Modal */}
      {liveEditorModal && (
        <>
          <div className="notif-backdrop" onClick={() => setLiveEditorModal(null)} style={{ zIndex: 10000 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "var(--card)", padding: 24, borderRadius: 16, width: "90%", maxWidth: 400, zIndex: 10001, border: "1px solid var(--border)", boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, display: "flex", gap: 8, alignItems: "center" }}><CalendarDays size={18} color="var(--blue)" /> Edit Class</h2>
              <button onClick={() => setLiveEditorModal(null)} style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer" }}><XCircle size={18} /></button>
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: "var(--text)" }}>{liveEditorModal.code}</div>
              <div style={{ color: "var(--muted)", fontSize: 13 }}>{liveEditorModal.date} | {liveEditorModal.start} - {liveEditorModal.end} | Section {liveEditorModal.section}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <select id="live-section-input" className="admin-input" style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }} defaultValue={liveEditorModal.section}>
                  <option value="All">All Sections</option>
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                </select>
              </div>

              <button onClick={() => {
                const newSection = document.getElementById('live-section-input').value;
                const overrideKey = newSection === "All" ? liveEditorModal.code : `${liveEditorModal.code}_${newSection}`;
                const nextOverrides = { ...(flags.classOverrides || {}) };
                if (!nextOverrides[liveEditorModal.date]) nextOverrides[liveEditorModal.date] = {};
                nextOverrides[liveEditorModal.date][overrideKey] = { type: "cancelled", name: `Cancelled: ${overrideKey}` };
                setFlags({...flags, classOverrides: nextOverrides});
                logAdminAction(admin_id, "cancel_class", { date: liveEditorModal.date, class: overrideKey });
                setLiveEditorModal(null);
              }} className="admin-btn outline" style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>
                <Ban size={16} /> Cancel Class
              </button>

              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input type="time" id="live-start-input" className="admin-input" style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }} defaultValue={liveEditorModal.start} />
                <span style={{ display: "flex", alignItems: "center", color: "var(--muted)" }}>-</span>
                <input type="time" id="live-end-input" className="admin-input" style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }} defaultValue={liveEditorModal.end} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input type="text" id="live-room-input" placeholder="New Room" className="admin-input" style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }} defaultValue={liveEditorModal.room} />
                <button onClick={() => {
                  const newSection = document.getElementById('live-section-input').value;
                  const overrideKey = newSection === "All" ? liveEditorModal.code : `${liveEditorModal.code}_${newSection}`;
                  const newRoom = document.getElementById('live-room-input').value;
                  const newStart = document.getElementById('live-start-input').value;
                  const newEnd = document.getElementById('live-end-input').value;
                  const nextOverrides = { ...(flags.classOverrides || {}) };
                  if (!nextOverrides[liveEditorModal.date]) nextOverrides[liveEditorModal.date] = {};
                  const existing = nextOverrides[liveEditorModal.date][overrideKey] || {};
                  
                  const changes = { ...existing };
                  if (newRoom) changes.room = newRoom;
                  if (newStart) changes.start = newStart;
                  if (newEnd) changes.end = newEnd;

                  nextOverrides[liveEditorModal.date][overrideKey] = changes;
                  setFlags({...flags, classOverrides: nextOverrides});
                  logAdminAction(admin_id, "edit_class", { date: liveEditorModal.date, class: overrideKey, room: newRoom, start: newStart, end: newEnd });
                  setLiveEditorModal(null);
                }} className="admin-btn primary">
                  Save Changes
                </button>
              </div>
              
              {(flags.classOverrides?.[liveEditorModal.date]?.[liveEditorModal.code] || flags.classOverrides?.[liveEditorModal.date]?.[`${liveEditorModal.code}_${liveEditorModal.section}`]) && (
                <button onClick={() => {
                  const nextOverrides = { ...(flags.classOverrides || {}) };
                  if (nextOverrides[liveEditorModal.date]?.[liveEditorModal.code]) {
                     delete nextOverrides[liveEditorModal.date][liveEditorModal.code];
                  }
                  if (nextOverrides[liveEditorModal.date]?.[`${liveEditorModal.code}_${liveEditorModal.section}`]) {
                     delete nextOverrides[liveEditorModal.date][`${liveEditorModal.code}_${liveEditorModal.section}`];
                  }
                  setFlags({...flags, classOverrides: nextOverrides});
                  logAdminAction(admin_id, "clear_override", { date: liveEditorModal.date, class: liveEditorModal.code });
                  setLiveEditorModal(null);
                }} className="admin-btn outline" style={{ marginTop: 8 }}>
                  <Trash2 size={16} /> Remove Override
                </button>
              )}
            </div>
          </div>
        </>
      )}

      <AdminCommandPalette 
         isOpen={isCommandPaletteOpen}
         onClose={() => setIsCommandPaletteOpen(false)}
         allUsers={allUsers}
         flags={flags}
         auditLogs={auditLogs}
         onUserSelect={(u) => {
            setSelectedUser(u);
            setIsCommandPaletteOpen(false);
         }}
         onFlagSelect={(fKey) => {
            if (typeof flags[fKey] === 'boolean') {
               setFlags({ ...flags, [fKey]: !flags[fKey] });
            }
            setIsCommandPaletteOpen(false);
         }}
      />
    </div>
  );
}

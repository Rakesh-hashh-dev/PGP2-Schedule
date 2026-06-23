import { useState, useEffect } from "react";
import { Users, Megaphone, Flag, Save, Trash2, ShieldAlert, Check, Search, RefreshCw, AlertTriangle, CalendarDays, XCircle, VenetianMask, Ban, BarChart3, Terminal, Clock, Database } from "lucide-react";
import { supabase } from "../lib/supabase";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Papa from 'papaparse';
import { LEGEND } from "../data/schedule.js";

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

export default function AdminDashboard({ user, startImpersonation, syncLogs = [], timeOverride, setTimeOverride }) {
  const [totalUsers, setTotalUsers] = useState(null);
  const [activeUsers, setActiveUsers] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const [dbSize, setDbSize] = useState("...");
  
  const [announcement, setAnnouncement] = useState("");
  const [activeAnnouncement, setActiveAnnouncement] = useState(null);
  
  const [flags, setFlags] = useState({
    enableFriends: true,
    enableExams: true,
    enableAttendance: true,
    maintenanceMode: false,
    bannedUsers: [],
    classOverrides: {}
  });
  
  const [popularCourses, setPopularCourses] = useState([]);
  const [overrideDate, setOverrideDate] = useState("");
  const [overrideClass, setOverrideClass] = useState("");
  const [roomOverrideDate, setRoomOverrideDate] = useState("");
  const [roomOverrideClass, setRoomOverrideClass] = useState("");
  const [roomOverrideRoom, setRoomOverrideRoom] = useState("");
  
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
  const [dailyStats, setDailyStats] = useState([]);
  const [announcementTarget, setAnnouncementTarget] = useState("global");

  const admin_id = user?.id || user?.user_id || "unknown";

  useEffect(() => {
    async function fetchStatsAndUsers() {
      setStatsLoading(true);
      setLoadingUsers(true);
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
      setStatsLoading(false);
      setLoadingUsers(false);
    }
    fetchStatsAndUsers();

    async function fetchConfig() {
      try {
        const { data, error } = await supabase.from("system_config").select("*").eq("id", "global").single();
        if (data) {
          if (data.announcement) {
            setActiveAnnouncement(data.announcement);
            setAnnouncement(data.announcement);
          }
          if (data.flags) setFlags(prev => ({ ...prev, ...data.flags }));
        }
      } catch (e) {
        // Table likely doesn't exist yet
      }
    }
    fetchConfig();

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
    fetchDbSize();

    async function fetchFeedbackAndLogs() {
      const { data: fb } = await supabase.from("feedback").select("*").order("created_at", { ascending: false }).limit(20);
      if (fb) setFeedbackList(fb);

      const { data: logs } = await supabase.from("admin_audit_logs").select("*").order("created_at", { ascending: false }).limit(20);
      if (logs) setAuditLogs(logs);
      
      const { data: stats } = await supabase.from("daily_stats").select("*").order("date", { ascending: true }).limit(30);
      if (stats) setDailyStats(stats);
    }
    fetchFeedbackAndLogs();
  }, []);

  async function saveConfig() {
    setSaving(true);
    setSaveMsg("");
    try {
      const { error } = await supabase.from("system_config").upsert({
        id: "global",
        announcement: activeAnnouncement,
        flags,
        updated_at: new Date().toISOString()
      });
      if (error) {
        setSaveMsg("Failed: " + error.message);
      } else {
        await logAdminAction(admin_id, "save_config", { announcement: activeAnnouncement, flags });
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
    if (!roomOverrideDate || !roomOverrideClass || !roomOverrideRoom) {
      alert("Please fill in all fields (Date, Class Code, and New Classroom) before adding.");
      return;
    }
    const nextOverrides = { ...(flags.classOverrides || {}) };
    if (!nextOverrides[roomOverrideDate]) nextOverrides[roomOverrideDate] = {};
    const existing = nextOverrides[roomOverrideDate][roomOverrideClass] || {};
    nextOverrides[roomOverrideDate][roomOverrideClass] = { ...existing, room: roomOverrideRoom };
    setFlags({...flags, classOverrides: nextOverrides});
    logAdminAction(admin_id, "change_room", { date: roomOverrideDate, class: roomOverrideClass, room: roomOverrideRoom });
    setRoomOverrideClass("");
    setRoomOverrideRoom("");
  };

  const handleCsvUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const nextOverrides = { ...(flags.classOverrides || {}) };
        let count = 0;
        results.data.forEach(row => {
          if (!row.Date || !row.Class) return;
          if (!nextOverrides[row.Date]) nextOverrides[row.Date] = {};
          if (row.Action === "cancel") {
            nextOverrides[row.Date][row.Class] = { type: "cancelled", name: `Cancelled: ${row.Class}` };
            count++;
          } else if (row.Action === "room" && row.Room) {
            nextOverrides[row.Date][row.Class] = { ...(nextOverrides[row.Date][row.Class] || {}), room: row.Room };
            count++;
          }
        });
        setFlags({...flags, classOverrides: nextOverrides});
        logAdminAction(admin_id, "csv_import", { rows_imported: count });
        alert(`Imported ${count} overrides from CSV.`);
      }
    });
  };

  const markFeedbackResolved = async (id) => {
    await supabase.from("feedback").update({ status: "resolved" }).eq("id", id);
    setFeedbackList(feedbackList.map(f => f.id === id ? { ...f, status: "resolved" } : f));
  };

  const exportUsersCSV = () => {
    const csv = Papa.unparse(allUsers.map(u => ({ id: u.user_id, name: u.name, courses: Object.keys(u.courses || {}).filter(k=>!k.startsWith("_")).join("|") })));
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users_export.csv';
    a.click();
    logAdminAction(admin_id, "export_users", {});
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
            <div style={{ fontSize: 36, fontWeight: 800, fontFamily: "var(--display)", color: "var(--text)" }}>{dbSize}</div>
          </div>
          <div style={{ background: "var(--card)", padding: "16px 32px", borderRadius: 16, border: "1px solid var(--border)", minWidth: 200, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700, color: "var(--muted)", marginBottom: 8, letterSpacing: "1px", display: "flex", alignItems: "center", gap: 6 }}><BarChart3 size={14}/> Top Electives</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", display: "flex", flexDirection: "column", gap: 4 }}>
              {popularCourses.length > 0 ? popularCourses.map(([c, n]) => <div key={c}>{c} <span style={{color: "var(--muted)"}}>({n})</span></div>) : "None yet"}
            </div>
          </div>
        </div>
      </section>

      {/* ── Linear Layout ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        <section className="admin-card" style={{ display: "flex", flexDirection: "column" }}>
          <h2><Megaphone size={20} color="var(--amber)" /> Targeted Announcements</h2>
          <p className="admin-subtext">Push an instant banner to users based on targeting. Leave blank to clear.</p>
          <div style={{ marginBottom: 12 }}>
            <select className="admin-input" value={announcementTarget} onChange={e => setAnnouncementTarget(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}>
              <option value="global">Global (All Users)</option>
              <option value="section_A">Section A Only</option>
              <option value="section_B">Section B Only</option>
              <option value="has_friends">Social Users (Has Friends)</option>
              <optgroup label="Subject Wise">
                {Object.entries(LEGEND || {}).map(([code, info]) => (
                  <option key={code} value={`subject_${code}`}>{code} - {info.name}</option>
                ))}
              </optgroup>
            </select>
          </div>
          <textarea 
            className="admin-textarea"
            value={announcement}
            onChange={e => setAnnouncement(e.target.value)}
            placeholder="e.g., Welcome to the new TermFlow update! Check out the friends tab."
          />
          <div className="admin-actions">
            <button className="admin-btn primary" onClick={() => setActiveAnnouncement({ message: announcement, target: announcementTarget })}>
              Stage Announcement
            </button>
            <button className="admin-btn outline" onClick={() => { setAnnouncement(""); setActiveAnnouncement(null); }}>
              <Trash2 size={16} /> Clear
            </button>
          </div>
          {activeAnnouncement && activeAnnouncement.message && (
            <div className="admin-staged-preview">
              <div className="preview-label">Staged Preview (Target: {activeAnnouncement.target})</div>
              {activeAnnouncement.message}
            </div>
          )}
        </section>

        {/* Analytics Section */}
        <section className="admin-card">
          <h2><BarChart3 size={20} color="var(--blue)" /> Daily Active Users (DAU)</h2>
          <div style={{ height: 300, width: "100%", marginTop: 16 }}>
            {dailyStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" stroke="var(--muted)" tick={{fontSize: 12}} />
                  <YAxis stroke="var(--muted)" tick={{fontSize: 12}} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="active_users" stroke="var(--violet)" strokeWidth={3} dot={{r: 4}} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="admin-loading">No daily stats data available.</div>
            )}
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
            <button className="admin-btn outline" onClick={exportUsersCSV} style={{ padding: "6px 12px", fontSize: 13 }}>Export Users to CSV</button>
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
                    <div className="admin-user-info">
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
              {Object.keys(flags).filter(k => k !== "maintenanceMode" && k !== "bannedUsers" && k !== "classOverrides").map(key => (
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
          </section>

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

          {/* Classroom Allotment Edit */}
          <section className="admin-card" style={{ gridColumn: "1 / -1" }}>
            <h2><CalendarDays size={20} color="var(--blue)" /> Classroom Allotment Edit</h2>
            <p className="admin-subtext">Globally change the classroom for a specific class on a given date.</p>
            <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
               <input type="date" className="admin-input" value={roomOverrideDate} onChange={e => setRoomOverrideDate(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)" }} />
               <input type="text" placeholder="Class Code (e.g. BM)" className="admin-input" value={roomOverrideClass} onChange={e => setRoomOverrideClass(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)" }} />
               <input type="text" placeholder="New Classroom" className="admin-input" value={roomOverrideRoom} onChange={e => setRoomOverrideRoom(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)" }} />
               <button className="cva-btn primary" onClick={handleAddRoomOverride} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--blue)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Change Room</button>
            </div>
            
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
               <h3 style={{ fontSize: 14, margin: "0 0 8px 0" }}>Bulk Import (CSV)</h3>
               <p className="admin-subtext">Upload a CSV with columns: <code>Date</code> (YYYY-MM-DD), <code>Class</code> (Code), <code>Action</code> (cancel/room), and <code>Room</code>.</p>
               <input type="file" accept=".csv" onChange={handleCsvUpload} style={{ fontSize: 13 }} />
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
                    return (
                      <div key={`${date}-${code}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.03)", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border)" }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>
                          {new Date(date).toLocaleDateString()} — {code} 
                          {isCancelled && <span style={{ color: "var(--danger)", marginLeft: 8 }}>(Cancelled)</span>}
                          {isRoomChanged && !isCancelled && <span style={{ color: "var(--blue)", marginLeft: 8 }}>(Room: {override.room})</span>}
                        </span>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          {isRoomChanged && (
                            <button onClick={() => {
                               setRoomOverrideDate(date);
                               setRoomOverrideClass(code);
                               setRoomOverrideRoom(override.room);
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
            <div style={{ background: "rgba(0,0,0,0.8)", color: "#e2e8f0", borderRadius: 8, padding: 16, marginTop: 16, maxHeight: 300, overflowY: "auto", fontFamily: "monospace", fontSize: 13, border: "1px solid var(--border)" }}>
              {auditLogs.length === 0 ? (
                <div style={{ color: "var(--muted)", fontStyle: "italic" }}>No audit logs found.</div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} style={{ display: "flex", gap: 12, marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{new Date(log.created_at).toLocaleString()}</span>
                    <span style={{ color: "var(--live)", fontWeight: 700 }}>[{log.action}]</span>
                    <span style={{ color: "#e2e8f0" }}>{JSON.stringify(log.details)}</span>
                  </div>
                ))
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

    </div>
  );
}

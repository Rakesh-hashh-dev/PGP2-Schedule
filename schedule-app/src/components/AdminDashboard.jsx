import { useState, useEffect } from "react";
import "../styles/admin.css";
import "../styles/assignments.css";
import "../styles/cmdk.css";
import { Users, Megaphone, Flag, Save, Trash2, ShieldAlert, Check, Search, RefreshCw, AlertTriangle, CalendarDays, XCircle, VenetianMask, Ban, Terminal, Clock, Database, FileText, X, BellRing, Sparkles, Pencil, BarChart2, UtensilsCrossed, GraduationCap, MessageSquare } from "lucide-react";
import { supabase } from "../lib/supabase";
import { logAdminAction } from "../lib/adminAudit.js";
import { LEGEND } from "../data/schedule.js";
import { BASE_MENU } from "../data/messMenu.js";
import snapshotMeta from "../data/snapshot-meta.json";
import { getSnapshot } from "../lib/sheet.js";
import AdminCommandPalette from "./AdminCommandPalette";
import Hero from "./Hero.jsx";
import FeedbackFlashToast from "./FeedbackFlashToast.jsx";

// Frozen clock for the Hero backdrop preview — computed once at module load so
// render stays pure (react-hooks/purity)
const PREVIEW_NOW = Date.now();
const PREVIEW_TODAY_ISO = new Date(PREVIEW_NOW).toISOString().split("T")[0];
const PREVIEW_TOMORROW_ISO = new Date(PREVIEW_NOW + 86400000).toISOString().split("T")[0];


// Mess Menu Editor — meal slots as stored in data/messMenu.js
const MESS_MEALS = [
  { key: "breakfast", label: "Breakfast Mains", hint: "Daily items (bread, cornflakes, sprouts, egg, fruits, beverages) are appended automatically." },
  { key: "lunch", label: "Lunch" },
  { key: "snacksW13", label: "Snacks — Week 1 & 3" },
  { key: "snacksW24", label: "Snacks — Week 2 & 4", hint: "Leave empty to serve the Week 1 & 3 snacks on those weeks too." },
  { key: "dinner", label: "Dinner" },
];
// Date#getDay() indices in Monday-first display order
const MESS_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const MESS_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function Avatar({ name, email }) {
  const init = name ? name[0] : (email ? email[0] : "?");
  return <div className="admin-avatar">{init.toUpperCase()}</div>;
}

export default function AdminDashboard({ user, startImpersonation, syncLogs = [], timeOverride, setTimeOverride, allChanges = [] }) {
  const [totalUsers, setTotalUsers] = useState(null);
  const [activeUsers, setActiveUsers] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const [dbSize, setDbSize] = useState("...");
  const [sysMetrics, setSysMetrics] = useState(null);
  const [sysMetricsLoading, setSysMetricsLoading] = useState(false);
  const [sysMetricsError, setSysMetricsError] = useState("");
  
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
    abTests: {},
    dispatchEnabled: true
  });
  
  const [popularCourses, setPopularCourses] = useState([]);
  const [overrideDate, setOverrideDate] = useState(new Date().toISOString().split("T")[0]);
  const [overrideClass, setOverrideClass] = useState("");
  const [overrideSection, setOverrideSection] = useState("All");

  const [bulkCsv, setBulkCsv] = useState("");
  const [copySourceDate, setCopySourceDate] = useState("");
  const [copyTargetDate, setCopyTargetDate] = useState("");
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
  const [feedbackFilter, setFeedbackFilter] = useState("pending");
  const [auditLogs, setAuditLogs] = useState([]);
  const [announcementTarget, setAnnouncementTarget] = useState("global");
  const [selectedUser, setSelectedUser] = useState(null);

  // New states for added features
  const [pushSubCount, setPushSubCount] = useState("...");
  const [skipStats, setSkipStats] = useState([]);
  const [friendPingsCount, setFriendPingsCount] = useState("...");
  const [shareCodes, setShareCodes] = useState([]);
  const [userSectionFilter, setUserSectionFilter] = useState("All");

  // Scheduled Announcements State
  const [announcementStart, setAnnouncementStart] = useState("");
  const [announcementEnd, setAnnouncementEnd] = useState("");

  // Quick Links State
  const [qlTitle, setQlTitle] = useState("");
  const [qlUrl, setQlUrl] = useState("");
  const [qlStart, setQlStart] = useState("");
  const [qlEnd, setQlEnd] = useState("");

  // Push Notification Broadcast State
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [pushUrl, setPushUrl] = useState("");
  const [pushSending, setPushSending] = useState(false);
  const [pushResult, setPushResult] = useState("");
  const [pushScheduleDate, setPushScheduleDate] = useState("");
  const [pushScheduleTime, setPushScheduleTime] = useState("");

  const [selectedUserIds, setSelectedUserIds] = useState(new Set());

  // What's New (feature updates) State
  const [wnEmoji, setWnEmoji] = useState("");
  const [wnTitle, setWnTitle] = useState("");
  const [wnDesc, setWnDesc] = useState("");
  const [wnEditingId, setWnEditingId] = useState(null);

  // Software Update Config
  const [updatePromptTitle, setUpdatePromptTitle] = useState("");
  const [updatePromptDesc, setUpdatePromptDesc] = useState("");
  const [updatePromptHighlights, setUpdatePromptHighlights] = useState("");

  // Feedback Flash Config
  const [feedbackFlashes, setFeedbackFlashes] = useState([]);
  const [previewFlashId, setPreviewFlashId] = useState(null);

  // Live Editor State
  const [liveSchedule] = useState(() => getSnapshot().CLASSES || []);
  const [liveEditorDate, setLiveEditorDate] = useState(new Date().toISOString().split("T")[0]);
  const [liveEditorModal, setLiveEditorModal] = useState(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Keep original fetched config for diffing
  const [originalFlags, setOriginalFlags] = useState(null);

  // API Health Check — live ping results
  const [healthStatus, setHealthStatus] = useState({ supabase: null, sheets: null, push: null });
  const [healthChecking, setHealthChecking] = useState(false);

  // 7-day activity analytics (index 0 = 6 days ago, index 6 = today)
  const [activityChartData, setActivityChartData] = useState(Array(7).fill(0));
  const [peakHour, setPeakHour] = useState(null);


  // Reactive flag — avoids stale localStorage.getItem() at render time
  const [hasAdminKey, setHasAdminKey] = useState(() => !!localStorage.getItem("pgp2.push-admin-key"));

  // Live Editor Modal — controlled input state (replaces document.getElementById anti-pattern)
  const [modalSection, setModalSection] = useState("All");
  const [modalRoom, setModalRoom] = useState("");
  const [modalStart, setModalStart] = useState("");
  const [modalEnd, setModalEnd] = useState("");
  const [modalCode, setModalCode] = useState("");
  const [modalName, setModalName] = useState("");
  const [modalIsNew, setModalIsNew] = useState(false);

  // A/B Test editor
  const [abTestName, setAbTestName] = useState("");
  const [abTestRollout, setAbTestRollout] = useState(50);

  // Mess Menu Editor — drafts hold only meals the admin has typed in; anything
  // else falls through to the staged override (flags) or the bundled menu.
  const [messEditDay, setMessEditDay] = useState(() => new Date().getDay());
  const [messDrafts, setMessDrafts] = useState({});

  const admin_id = user?.id || user?.user_id || "unknown";

  useEffect(() => {
    const handleOpen = () => setIsCommandPaletteOpen(true);
    document.addEventListener("open-admin-command-palette", handleOpen);
    return () => document.removeEventListener("open-admin-command-palette", handleOpen);
  }, []);

  const fetchSysMetrics = async () => {
    let adminKey = localStorage.getItem("pgp2.push-admin-key") || "";
    if (!adminKey) return;
    setSysMetricsLoading(true);
    setSysMetricsError("");
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-metrics`, {
        headers: { "x-admin-key": adminKey }
      });
      if (!resp.ok) {
        setSysMetricsError(`Failed to fetch metrics: ${resp.status}`);
      } else {
        const data = await resp.json();
        setSysMetrics(data.metrics);
      }
    } catch (e) {
      setSysMetricsError(e.message);
    }
    setSysMetricsLoading(false);
  };

  const promptAdminKey = () => {
    const key = prompt("Enter the Admin Secret Key (set as ADMIN_SECRET or PUSH_ADMIN_SECRET in Supabase):");
    if (key) {
      localStorage.setItem("pgp2.push-admin-key", key);
      setHasAdminKey(true);
      fetchSysMetrics();
    }
  };

  // Fetches everything; loading flags start true at mount, so only the manual
  // Refresh action needs to flip them back on (see fetchDashboardData below).
  const loadDashboardData = async () => {
    async function fetchStatsAndUsers() {
      try {
        // profiles still holds pre-cutover DEV ghost rows (kept as the data
        // source for migrate-user's on-login restore). Exclude them so the
        // stats reflect the Clerk PROD instance. If the RPC is gone (post
        // Phase 2 cleanup) the filter is simply empty.
        const [{ data, error }, devIdsRes] = await Promise.all([
          supabase.from("profiles").select("user_id, courses, last_seen_at, updated_at"),
          supabase.rpc("get_dev_user_ids"),
        ]);
        const devIds = new Set((devIdsRes.data || []).map(r => (typeof r === "string" ? r : r.dev_user_id)));
        if (error) {
          console.error("Supabase Error:", error);
          setTotalUsers("Error: " + error.message);
        } else if (data) {
          const prodRows = data.filter(d => !devIds.has(d.user_id));
          setTotalUsers(prodRows.length);
          let allEnrolled = [];
          const usersWithNames = prodRows.map(d => {
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

          // Real active count from the last_seen_at heartbeat (App.jsx stamps it hourly)
          const dayAgoTs = Date.now() - 24 * 60 * 60 * 1000;
          setActiveUsers(prodRows.filter(d => d.last_seen_at && new Date(d.last_seen_at).getTime() >= dayAgoTs).length);

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

    async function fetchExtraAdminStats() {
      try {
        const { data: sc } = await supabase.from("share_codes").select("*");
        if (sc) setShareCodes(sc);

        // push_subscriptions / friend_pings / attendance are RLS-locked to the
        // requesting user, so counting them client-side only sees the admin's
        // own rows. get_admin_stats() (SECURITY DEFINER) returns true
        // cohort-wide aggregates; fall back to the clipped counts if the RPC
        // is ever dropped.
        const { data: stats, error: statsErr } = await supabase.rpc("get_admin_stats");
        if (!statsErr && stats) {
          setPushSubCount(stats.push_subscriptions ?? 0);
          setFriendPingsCount(stats.friend_pings ?? 0);
          setSkipStats(stats.skips_by_course || []);
          return;
        }

        const { count: pCount } = await supabase.from("push_subscriptions").select("*", { count: "exact", head: true });
        setPushSubCount(pCount ?? 0);

        const { count: fCount } = await supabase.from("friend_pings").select("*", { count: "exact", head: true });
        setFriendPingsCount(fCount ?? 0);

        const { data: att } = await supabase.from("attendance").select("session_key, status").eq("status", "absent");
        if (att) {
           const skipsByCourse = {};
           att.forEach(a => {
              // session_key: YYYY-MM-DD_HH:MM_CODE_SECTION
              const parts = a.session_key.split("_");
              if (parts.length >= 3) {
                 const code = parts[2];
                 skipsByCourse[code] = (skipsByCourse[code] || 0) + 1;
              }
           });
           const topSkips = Object.entries(skipsByCourse).sort((a,b) => b[1] - a[1]).slice(0, 5);
           setSkipStats(topSkips);
        }
      } catch (e) {
         // ignore
      }
    }

    async function fetchActivityData() {
      try {
        const { data: actData } = await supabase
          .from("profiles")
          .select("last_seen_at")
          .not("last_seen_at", "is", null);
        if (actData) {
          // Build 7-day bar chart — index 6 = today, index 0 = 6 days ago
          const counts = Array(7).fill(0);
          const now = Date.now();
          actData.forEach(row => {
            const daysAgo = Math.floor((now - new Date(row.last_seen_at).getTime()) / 86400000);
            if (daysAgo >= 0 && daysAgo < 7) counts[6 - daysAgo]++;
          });
          setActivityChartData(counts);

          // Compute peak hour from all timestamps
          const hourCounts = Array(24).fill(0);
          actData.forEach(row => { hourCounts[new Date(row.last_seen_at).getHours()]++; });
          const peak = hourCounts.indexOf(Math.max(...hourCounts));
          setPeakHour(peak);
        }
      } catch (e) { /* non-critical, ignore */ }
    }

    await Promise.all([
      fetchStatsAndUsers(),
      fetchDbSize(),
      fetchFeedbackAndLogs(),
      fetchSysMetrics(),
      fetchExtraAdminStats(),
      fetchActivityData()
    ]);
    
    setStatsLoading(false);
    setLoadingUsers(false);
  };

  // Manual Refresh action — an event handler, so sync setState here is fine
  const fetchDashboardData = () => {
    setStatsLoading(true);
    setLoadingUsers(true);
    return loadDashboardData();
  };

  useEffect(() => {
    // All setState calls inside happen after awaits; the analyzer just can't
    // see through Promise.all of async fns. Loading flags already default true.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboardData();

    async function fetchConfig() {
      try {
        const { data } = await supabase.from("system_config").select("*").eq("id", "global").single();
        if (data) {
          if (data.announcement) {
            setActiveAnnouncement(data.announcement);
            setAnnouncement(data.announcement);
          }
          if (data.flags) {
            setFlags(prev => ({ ...prev, ...data.flags }));
            setOriginalFlags(data.flags);
            if (data.flags.updatePrompt) {
              setUpdatePromptTitle(data.flags.updatePrompt.title || "");
              setUpdatePromptDesc(data.flags.updatePrompt.desc || "");
              setUpdatePromptHighlights(data.flags.updatePrompt.highlights?.join("\n") || "");
            }
            if (data.flags.feedbackFlashes) {
              setFeedbackFlashes(data.flags.feedbackFlashes);
            } else if (data.flags.feedbackFlash) {
              setFeedbackFlashes([{ ...data.flags.feedbackFlash, id: Date.now().toString() }]);
            }
          }
        }
      } catch (e) {
        // Table likely doesn't exist yet
      }
    }
    fetchConfig();
  }, []);

  const changesCount = originalFlags ? Object.keys(flags).reduce((acc, k) => {
    if (JSON.stringify(flags[k]) !== JSON.stringify(originalFlags[k])) return acc + 1;
    return acc;
  }, 0) : 0;

  // Warn on tab close when there are unsaved config changes
  useEffect(() => {
    if (changesCount === 0) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
   
  }, [changesCount]);

  async function saveConfig() {
    if (flags.adminRoles && flags.adminRoles[admin_id] === "monitor") {
       return alert("You only have 'Monitor' access. Configuration changes are disabled for your role.");
    }
    setSaving(true);
    setSaveMsg("");
    try {
      // Ensure announcedAt is set for newly enabled flashes
      const updatedFlashes = feedbackFlashes.map(ff => {
        const originalFf = originalFlags?.feedbackFlashes?.find(o => o.id === ff.id) || 
                           (originalFlags?.feedbackFlash && originalFlags.feedbackFlash.id === ff.id ? originalFlags.feedbackFlash : null);
        
        let announcedAt = ff.announcedAt;
        if (ff.enabled && (!originalFf?.enabled || originalFf?.deadline !== ff.deadline)) {
            announcedAt = new Date().toISOString();
        }
        return { ...ff, announcedAt };
      });

      const newFlags = {
        ...flags,
        updatePrompt: {
          title: updatePromptTitle,
          desc: updatePromptDesc,
          highlights: updatePromptHighlights.split("\n").filter(l => l.trim())
        },
        feedbackFlashes: updatedFlashes
      };
      
      // Clean up legacy flag
      delete newFlags.feedbackFlash;
      
      const historyEntry = {
         timestamp: new Date().toISOString(),
         flags: originalFlags,
         author: admin_id
      };
      newFlags.configHistory = [historyEntry, ...(newFlags.configHistory || [])].slice(0, 15);

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
        setOriginalFlags(newFlags);
        setSaveMsg("Successfully saved to cloud!");
        setTimeout(() => setSaveMsg(""), 3000);
      }
    } catch (e) {
      setSaveMsg("Error saving config.");
    }
    setSaving(false);
  }

  async function sendPushBroadcast() {
    if (!pushTitle.trim() || !pushBody.trim()) return alert("Fill in title and message.");
    let pushKey = localStorage.getItem("pgp2.push-admin-key") || "";
    if (!pushKey) {
      pushKey = prompt("Enter the push admin key (PUSH_ADMIN_SECRET set on the send-push edge function):") || "";
      if (!pushKey) return;
      localStorage.setItem("pgp2.push-admin-key", pushKey);
    }
    if (!confirm(`Send this push notification to ALL subscribed devices?\n\n${pushTitle}\n${pushBody}`)) return;
    setPushSending(true);
    setPushResult("");
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-push-key": pushKey,
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ title: pushTitle.trim(), body: pushBody.trim(), url: pushUrl.trim() || "/" }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        if (resp.status === 401) localStorage.removeItem("pgp2.push-admin-key");
        setPushResult(`Failed: ${data.error || resp.status}`);
      } else {
        setPushResult(`Sent to ${data.sent} device${data.sent !== 1 ? "s" : ""}${data.failed ? `, ${data.failed} failed` : ""}${data.pruned ? `, ${data.pruned} stale pruned` : ""}.`);
        setPushTitle(""); setPushBody(""); setPushUrl("");
        await logAdminAction(admin_id, "push_broadcast", { title: pushTitle.trim() });
      }
    } catch (e) {
      setPushResult("Error: " + e.message);
    }
    setPushSending(false);
  }

  async function forceRefresh() {
    if (confirm("Are you sure you want to force all active users to refresh their app?")) {
      await saveConfig();
      await logAdminAction(admin_id, "force_refresh", {});
      alert("Broadcast sent! Users will refresh on their next navigation.");
    }
  }

  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildMsg, setRebuildMsg] = useState("");

  async function triggerSnapshotRebuild() {
    const hook = import.meta.env.VITE_DEPLOY_HOOK_URL;
    if (!hook) {
      alert("No deploy hook configured.\n\nCreate one in Vercel → Project Settings → Git → Deploy Hooks, then add its URL as VITE_DEPLOY_HOOK_URL in Vercel env vars.");
      return;
    }
    if (!confirm("Trigger a redeploy to regenerate the bundled snapshot from the live sheet?")) return;
    setRebuilding(true);
    setRebuildMsg("");
    try {
      // Deploy hooks don't send CORS headers — no-cors still fires the request
      await fetch(hook, { method: "POST", mode: "no-cors" });
      await logAdminAction(admin_id, "snapshot_rebuild", {});
      setRebuildMsg("Redeploy triggered — new snapshot goes live in ~2 min.");
    } catch (e) {
      setRebuildMsg("Failed to trigger: " + e.message);
    }
    setRebuilding(false);
  }

  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.user_id?.toLowerCase().includes(searchQuery.toLowerCase());
    let matchesSection = true;
    if (userSectionFilter !== "All") {
       matchesSection = Object.keys(u.courses || {}).some(c => c.endsWith(`_${userSectionFilter}`));
    }
    return matchesSearch && matchesSection;
  });

  const cancelClass = (date, code, section) => {
    const key = !section || section === "All" || section === "Single" ? code : `${code}_${section}`;
    const nextOverrides = { ...(flags.classOverrides || {}) };
    nextOverrides[date] = { ...(nextOverrides[date] || {}), [key]: { type: "cancelled", name: `Cancelled: ${key}` } };
    setFlags({ ...flags, classOverrides: nextOverrides });
    logAdminAction(admin_id, "cancel_class", { date, class: key });
  };

  // Only lifts the cancellation — leaves room/time overrides on the same key intact
  const restoreClass = (date, code, section) => {
    const nextOverrides = { ...(flags.classOverrides || {}) };
    const forDate = { ...(nextOverrides[date] || {}) };
    [code, `${code}_${section}`].forEach(key => {
      if (forDate[key]?.type === "cancelled") delete forDate[key];
    });
    if (Object.keys(forDate).length === 0) delete nextOverrides[date];
    else nextOverrides[date] = forDate;
    setFlags({ ...flags, classOverrides: nextOverrides });
    logAdminAction(admin_id, "restore_class", { date, class: code, section });
  };

  const handleAddOverride = () => {
    const code = overrideClass.trim().toUpperCase();
    if (!overrideDate || !code) {
      alert("Please select a date and enter a class code to cancel.");
      return;
    }
    if (!LEGEND[code] && !window.confirm(`"${code}" isn't a known course code. Cancel it anyway?`)) return;
    cancelClass(overrideDate, code, overrideSection);
    setOverrideClass("");
    setOverrideSection("All");
  };

  const handleAddRoomOverride = () => {
    if (!roomOverrideDate || !roomOverrideClass || (!roomOverrideRoom && !roomOverrideStart && !roomOverrideEnd)) {
      alert("Please fill in Date, Class Code, and at least one change (Room, Start Time, or End Time).");
      return;
    }
    const nextOverrides = { ...(flags.classOverrides || {}) };
    nextOverrides[roomOverrideDate] = { ...(nextOverrides[roomOverrideDate] || {}) };
    
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

  // Stale = date-keyed config students still download but that can never apply again
  const todayISO = new Date().toISOString().split("T")[0];
  const staleOverrideDates = Object.keys(flags.classOverrides || {}).filter(d => d < todayISO);
  const staleAnnouncements = (flags.scheduledAnnouncements || []).filter(a => a.end && a.end < todayISO);
  const staleQuickLinks = (flags.quickLinks || []).filter(ql => ql.end && ql.end < todayISO);
  const staleConfigCount = staleOverrideDates.length + staleAnnouncements.length + staleQuickLinks.length;

  const activeOverrideDates = Object.keys(flags.classOverrides || {}).filter(d => d >= todayISO);
  const activeOverrideCount = activeOverrideDates.reduce((acc, d) => acc + Object.keys(flags.classOverrides[d]).length, 0);


  const purgeStaleConfig = () => {
    if (!window.confirm(`Remove ${staleOverrideDates.length} past override date(s), ${staleAnnouncements.length} expired announcement(s) and ${staleQuickLinks.length} expired quick link(s)? Remember to deploy after.`)) return;
    const nextOverrides = { ...(flags.classOverrides || {}) };
    staleOverrideDates.forEach(d => delete nextOverrides[d]);
    setFlags({
      ...flags,
      classOverrides: nextOverrides,
      scheduledAnnouncements: (flags.scheduledAnnouncements || []).filter(a => !(a.end && a.end < todayISO)),
      quickLinks: (flags.quickLinks || []).filter(ql => !(ql.end && ql.end < todayISO)),
    });
    logAdminAction(admin_id, "purge_stale_config", { overrideDates: staleOverrideDates.length, announcements: staleAnnouncements.length, quickLinks: staleQuickLinks.length });
  };

  const markFeedbackResolved = async (id) => {
    await supabase.from("feedback").update({ status: "resolved" }).eq("id", id);
    setFeedbackList(feedbackList.map(f => f.id === id ? { ...f, status: "resolved" } : f));
  };

  const _exportConfigJSON = () => {
    const json = JSON.stringify({ announcement: activeAnnouncement, flags }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config_backup.json';
    a.click();
    logAdminAction(admin_id, "export_config", {});
  };

  // ── API Health Check: probes real services ──────────────────
  const checkApiHealth = async () => {
    setHealthChecking(true);
    const next = { supabase: null, sheets: null, push: null };

    // 1. Supabase DB latency
    try {
      const t = Date.now();
      const { error } = await supabase.from("system_config").select("id").limit(1);
      next.supabase = error ? "error" : `${Date.now() - t}ms`;
    } catch (e) { next.supabase = "error"; }

    // 2. Push Gateway — verify the edge function responds (sends no push)
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          "x-push-key": localStorage.getItem("pgp2.push-admin-key") || "__health_check__",
        },
        body: JSON.stringify({ __healthcheck: true }),
      });
      // 400/401 = function is reachable (auth or bad body); 5xx = down
      next.push = resp.status < 500 ? "ok" : "error";
    } catch (e) { next.push = "error"; }

    // 3. Google Sheets live feed — HEAD-like fetch with a short timeout
    const FEED_URL = "https://script.google.com/macros/s/AKfycbwOCmpZAbzN7hRkb-xx6-SDejt3c45E5NBZ0NHuJW8CBRYO4ROJfwE_MI_g4aODwo08Gg/exec";
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const resp = await fetch(`${FEED_URL}?action=ping`, { signal: ctrl.signal, redirect: "follow" });
      clearTimeout(timer);
      next.sheets = resp.ok ? "ok" : "error";
    } catch (e) {
      next.sheets = e.name === "AbortError" ? "timeout" : "error";
    }

    setHealthStatus(next);
    setHealthChecking(false);
  };

  // ── Mess Menu Editor helpers ─────────────────────────────────
  // Textarea value: unsaved draft → staged override → bundled default
  const messMealText = (meal) => {
    if (messDrafts[meal] !== undefined) return messDrafts[meal];
    const staged = flags.messMenuOverrides?.[messEditDay]?.[meal];
    return (staged ?? BASE_MENU[messEditDay][meal] ?? []).join("\n");
  };

  const stageMessMenuEdits = () => {
    const dayOverride = {};
    MESS_MEALS.forEach(({ key }) => {
      const items = messMealText(key).split("\n").map(s => s.trim()).filter(Boolean);
      // Only store meals that differ from the bundled menu
      if (JSON.stringify(items) !== JSON.stringify(BASE_MENU[messEditDay][key] ?? [])) {
        dayOverride[key] = items;
      }
    });
    const next = { ...(flags.messMenuOverrides || {}) };
    if (Object.keys(dayOverride).length === 0) delete next[messEditDay];
    else next[messEditDay] = dayOverride;
    setFlags({ ...flags, messMenuOverrides: next });
    setMessDrafts({});
    logAdminAction(admin_id, "edit_mess_menu", { day: MESS_DAY_NAMES[messEditDay], meals: Object.keys(dayOverride) });
  };

  const resetMessMenuDay = () => {
    if (!window.confirm(`Reset ${MESS_DAY_NAMES[messEditDay]} to the bundled menu (discard the override)?`)) return;
    const next = { ...(flags.messMenuOverrides || {}) };
    delete next[messEditDay];
    setFlags({ ...flags, messMenuOverrides: next });
    setMessDrafts({});
    logAdminAction(admin_id, "reset_mess_menu_day", { day: MESS_DAY_NAMES[messEditDay] });
  };

  // Helper to open the Live Editor modal AND initialise controlled inputs
  const openLiveEditorModal = (c, isNew = false) => {
    setLiveEditorModal(c);
    setModalIsNew(isNew);
    setModalCode(c.code || "");
    setModalName(c.name || "");
    setModalSection(c.section === "Single" ? "All" : (c.section || "All"));
    setModalRoom(c.room || "");
    setModalStart(c.start || "");
    setModalEnd(c.end || "");
  };

  return (
    <div className="admin-page">
      
      {/* ── Hero Section ── */}
      <section className="hero" style={{ marginBottom: 32, padding: "40px 20px", textAlign: "center", borderRadius: 24 }}>
        <div style={{ display: "inline-flex", background: "rgba(109, 91, 208, 0.1)", color: "var(--live)", padding: "12px 24px", borderRadius: 30, alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap", justifyContent: "center" }}>
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
          <div style={{ background: "var(--card)", padding: "16px 32px", borderRadius: 16, border: "1px solid var(--border)", minWidth: 180 }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700, color: "var(--muted)", marginBottom: 8, letterSpacing: "1px", display: "flex", alignItems: "center", gap: 6 }}><BellRing size={14}/> Push Subscribers</div>
            <div style={{ fontSize: 36, fontWeight: 800, fontFamily: "var(--display)", color: "var(--text)" }}>{statsLoading ? "..." : pushSubCount}</div>
          </div>

        </div>
        <div style={{ marginTop: 24 }}>
           <details style={{ cursor: "pointer", color: "var(--muted)", fontSize: 13 }}>
              <summary>Keyboard Shortcuts</summary>
              <div style={{ marginTop: 8, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: 12, display: "inline-block", textAlign: "left" }}>
                 <div style={{ display: "flex", justifyContent: "space-between", gap: 32, marginBottom: 4 }}><span>Open Command Palette</span><kbd>Cmd/Ctrl + Shift + K</kbd></div>
              </div>
           </details>
        </div>
      </section>

      {/* ── Linear Layout ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>



          {/* Interactive Live Schedule Editor */}
          <section className="admin-card" style={{ gridColumn: "1 / -1" }}>
            <h2><CalendarDays size={20} color="var(--blue)" /> Live Schedule Editor</h2>
            <p className="admin-subtext">Click on a class slot to visually change the room or cancel the class.</p>
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <input type="date" className="admin-input" value={liveEditorDate} onChange={e => setLiveEditorDate(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }} />
              <button 
                className="admin-btn primary"
                onClick={() => openLiveEditorModal({ date: liveEditorDate, code: "", name: "", type: "class", section: "All" }, true)}
              >
                + Add Class
              </button>
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
                
                // Chronological order — raw data lists Sec A, then Sec B, then
                // Single-section/guest classes, which buries them off-screen
                const displayClasses = [...baseClasses, ...newClasses]
                  .sort((a, b) => (a.start || "").localeCompare(b.start || "") || (a.code || "").localeCompare(b.code || ""));
                
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
                  const isGuest = (c.session || "").toLowerCase().includes("guest");
                  const displayRoom = override?.room || c.room;
                  const displayStart = override?.start || c.start;
                  const displayEnd = override?.end || c.end;
                  return (
                    <div key={i} onClick={() => openLiveEditorModal(c)} style={{ minWidth: 200, padding: 12, background: "var(--bg)", border: `1px solid ${isGuest ? "var(--violet)" : "var(--border)"}`, borderRadius: 12, cursor: "pointer", position: "relative", opacity: isCancelled ? 0.6 : 1 }}>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4, textDecoration: isCancelled ? "line-through" : "none" }}>
                        {displayStart} - {displayEnd} | Sec: {c.section === "Single" ? "All" : c.section}
                        {isGuest && <span style={{ marginLeft: 6, background: "var(--violet)", color: "#fff", padding: "1px 6px", borderRadius: 4, fontSize: 9.5, fontWeight: 800, letterSpacing: ".03em" }}>GUEST</span>}
                      </div>
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
                    <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, WebkitOverflowScrolling: "touch" }}>
                       {classElements}
                    </div>
                  </div>
                );
              })()}
            </div>
          </section>

          {/* Class Cancellation Board */}
          <section className="admin-card" style={{ gridColumn: "1 / -1" }}>
            <h2><XCircle size={20} color="var(--danger)" /> Class Cancellation Board</h2>
            <p className="admin-subtext">Globally cancel a class for all students on a specific date. Pick a date, then cancel directly from that day's schedule. Changes go live after "Deploy Config to Cloud".</p>
            <div className="admin-field" style={{ maxWidth: 220 }}>
              <label>Date</label>
              <input type="date" className="admin-input" value={overrideDate} onChange={e => setOverrideDate(e.target.value)} />
            </div>
            {overrideDate && (() => {
              const overridesForDate = flags.classOverrides?.[overrideDate] || {};
              const dayClasses = liveSchedule
                .filter(c => c.date === overrideDate && c.type !== "break")
                .sort((a, b) => (a.start || "").localeCompare(b.start || "") || (a.code || "").localeCompare(b.code || ""));
              if (dayClasses.length === 0) {
                return <div className="admin-empty" style={{ padding: "20px 0" }}>No classes scheduled on this date. Use manual entry below if needed.</div>;
              }
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                  {dayClasses.map((c, i) => {
                    const sectionKey = `${c.code}_${c.section}`;
                    const isCancelled = overridesForDate[c.code]?.type === "cancelled" || overridesForDate[sectionKey]?.type === "cancelled";
                    return (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", opacity: isCancelled ? 0.65 : 1 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", textDecoration: isCancelled ? "line-through" : "none" }}>
                            {c.code} — {c.name || LEGEND[c.code]?.name || "Class"}
                            {isCancelled && <span style={{ marginLeft: 8, background: "var(--danger)", color: "#fff", padding: "1px 7px", borderRadius: 4, fontSize: 10, fontWeight: 800, letterSpacing: ".04em", textDecoration: "none", display: "inline-block" }}>CANCELLED</span>}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                            {c.start} - {c.end} · Sec: {c.section === "Single" ? "All" : c.section} · Room: {c.room || "TBD"}
                          </div>
                        </div>
                        {isCancelled ? (
                          <button className="admin-btn outline" onClick={() => restoreClass(overrideDate, c.code, c.section)} style={{ flex: "0 0 auto", padding: "7px 14px", fontSize: 13 }}>
                            <RefreshCw size={14} /> Restore
                          </button>
                        ) : (
                          <button className="admin-btn outline" onClick={() => cancelClass(overrideDate, c.code, c.section)} style={{ flex: "0 0 auto", padding: "7px 14px", fontSize: 13, borderColor: "var(--danger)", color: "var(--danger)" }}>
                            <XCircle size={14} /> Cancel
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            
            {overrideDate && (
              <div style={{ marginTop: 12 }}>
                 <button className="admin-btn danger outline" onClick={() => {
                    const dayClasses = liveSchedule.filter(c => c.date === overrideDate && c.type !== "break");
                    if (dayClasses.length === 0) return alert("No classes to cancel on this date.");
                    if (!window.confirm(`Mark all ${dayClasses.length} classes on ${overrideDate} as cancelled (Holiday)?`)) return;
                    
                    const next = {...flags.classOverrides};
                    if (!next[overrideDate]) next[overrideDate] = {};
                    dayClasses.forEach(c => {
                       const sectionKey = c.section === "Single" ? c.code : `${c.code}_${c.section}`;
                       next[overrideDate][sectionKey] = { type: "cancelled" };
                    });
                    setFlags({...flags, classOverrides: next});
                 }} style={{ padding: "8px 16px" }}>
                    <XCircle size={15} /> Mark Entire Day as Holiday (Cancel All)
                 </button>
              </div>
            )}
            
            <details style={{ marginTop: 14 }}>
              <summary style={{ fontSize: 13, color: "var(--muted)", cursor: "pointer", fontWeight: 600 }}>Manual entry (class not listed?)</summary>
              <div className="admin-field-row" style={{ marginTop: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div className="admin-field">
                  <label>Class Code</label>
                  <input type="text" list="cancel-course-codes" placeholder="e.g. BM" className="admin-input" value={overrideClass} onChange={e => setOverrideClass(e.target.value)} />
                  <datalist id="cancel-course-codes">
                    {Object.entries(LEGEND).map(([code, info]) => <option key={code} value={code}>{info.name}</option>)}
                  </datalist>
                </div>
                <div className="admin-field">
                  <label>Section</label>
                  <select className="admin-input" value={overrideSection} onChange={e => setOverrideSection(e.target.value)}>
                    <option value="All">All Sections</option>
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                  </select>
                </div>
                <button className="admin-btn danger" onClick={handleAddOverride} style={{ flex: "0 0 auto", marginBottom: 10, padding: "9px 16px" }}>
                  <XCircle size={15} /> Cancel Class
                </button>
              </div>
            </details>
          </section>

          {/* Class Editor */}
          <section className="admin-card" style={{ gridColumn: "1 / -1" }}>
            <h2><CalendarDays size={20} color="var(--blue)" /> Class Editor</h2>
            <p className="admin-subtext">Globally change the classroom or timings for a specific class on a given date.</p>
            <div className="admin-field-row" style={{ marginTop: 10 }}>
              <div className="admin-field">
                <label>Date</label>
                <input type="date" className="admin-input" value={roomOverrideDate} onChange={e => setRoomOverrideDate(e.target.value)} />
              </div>
              <div className="admin-field">
                <label>Class Code</label>
                <input type="text" placeholder="e.g. BM" className="admin-input" value={roomOverrideClass} onChange={e => setRoomOverrideClass(e.target.value)} />
              </div>
              <div className="admin-field">
                <label>Section</label>
                <select className="admin-input" value={roomOverrideSection} onChange={e => setRoomOverrideSection(e.target.value)}>
                  <option value="All">All Sections</option>
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                </select>
              </div>
            </div>
            <div className="admin-field-row">
              <div className="admin-field">
                <label>New Start <span className="admin-optional">(optional)</span></label>
                <input type="time" className="admin-input" value={roomOverrideStart} onChange={e => setRoomOverrideStart(e.target.value)} />
              </div>
              <div className="admin-field">
                <label>New End <span className="admin-optional">(optional)</span></label>
                <input type="time" className="admin-input" value={roomOverrideEnd} onChange={e => setRoomOverrideEnd(e.target.value)} />
              </div>
              <div className="admin-field">
                <label>New Classroom <span className="admin-optional">(optional)</span></label>
                <input type="text" placeholder="e.g. C-104" className="admin-input" value={roomOverrideRoom} onChange={e => setRoomOverrideRoom(e.target.value)} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
               <button className="admin-btn blue" onClick={handleAddRoomOverride} style={{ padding: "9px 16px" }}><CalendarDays size={15} /> Save Change</button>
               {roomOverrideDate && roomOverrideClass && flags.classOverrides?.[roomOverrideDate]?.[roomOverrideSection === "All" ? roomOverrideClass : `${roomOverrideClass}_${roomOverrideSection}`] && (
                 <button onClick={() => {
                    const overrideKey = roomOverrideSection === "All" ? roomOverrideClass : `${roomOverrideClass}_${roomOverrideSection}`;
                    const next = {...flags.classOverrides};
                    next[roomOverrideDate] = { ...next[roomOverrideDate] };
                    delete next[roomOverrideDate][overrideKey];
                    if (Object.keys(next[roomOverrideDate]).length === 0) delete next[roomOverrideDate];
                    setFlags({...flags, classOverrides: next});
                    setRoomOverrideClass("");
                    setRoomOverrideRoom("");
                    setRoomOverrideStart("");
                    setRoomOverrideEnd("");
                    setRoomOverrideSection("All");
                 }} className="admin-btn outline" style={{ padding: "9px 16px", borderColor: "var(--danger)", color: "var(--danger)" }}>Remove Override</button>
               )}
            </div>
          </section>

          {/* Bulk Overrides & Copy */}
          <section className="admin-card" style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32 }}>
             <div>
                <h2><CalendarDays size={20} color="var(--violet)" /> Copy Overrides</h2>
                <p className="admin-subtext">Duplicate all overrides (cancellations/rooms) from one day to another.</p>
                <div className="admin-field-row" style={{ marginTop: 12 }}>
                   <div className="admin-field">
                      <label>Source Date</label>
                      <input type="date" className="admin-input" value={copySourceDate} onChange={e => setCopySourceDate(e.target.value)} />
                   </div>
                   <div className="admin-field">
                      <label>Target Date</label>
                      <input type="date" className="admin-input" value={copyTargetDate} onChange={e => setCopyTargetDate(e.target.value)} />
                   </div>
                </div>
                <button className="admin-btn outline" style={{ marginTop: 12 }} onClick={() => {
                   if(!copySourceDate || !copyTargetDate) return alert("Select both dates.");
                   if(!flags.classOverrides?.[copySourceDate]) return alert("No overrides found on source date.");
                   if(!window.confirm(`Copy all overrides from ${copySourceDate} to ${copyTargetDate}?`)) return;
                   
                   const next = {...flags.classOverrides};
                   next[copyTargetDate] = JSON.parse(JSON.stringify(next[copySourceDate]));
                   setFlags({...flags, classOverrides: next});
                   setCopySourceDate(""); setCopyTargetDate("");
                }}>Copy to Target Date</button>
             </div>
             <div>
                <h2><FileText size={20} color="var(--blue)" /> Bulk CSV Importer</h2>
                <p className="admin-subtext">Format: Date,Code,Section,Room,Start,End,Cancel(true/false)</p>
                <textarea className="admin-textarea" value={bulkCsv} onChange={e => setBulkCsv(e.target.value)} placeholder="2026-07-20,BM,A,C-104,10:00,11:30,false&#10;2026-07-21,QM,B,,,,true" rows={4} style={{ marginTop: 12, fontFamily: "monospace", fontSize: 12, whiteSpace: "pre" }}></textarea>
                <button className="admin-btn outline" style={{ marginTop: 12 }} onClick={() => {
                   if (!bulkCsv.trim()) return;
                   try {
                      const next = {...flags.classOverrides};
                      const lines = bulkCsv.trim().split("\n");
                      let count = 0;
                      for (const line of lines) {
                         const [date, code, section, room, start, end, cancelStr] = line.split(",").map(s => s?.trim());
                         if (!date || !code || !section) continue;
                         if (!next[date]) next[date] = {};
                         const sectionKey = section === "All" || section === "Single" ? code : `${code}_${section}`;
                         
                         if (cancelStr?.toLowerCase() === "true") {
                            next[date][sectionKey] = { type: "cancelled" };
                         } else {
                            next[date][sectionKey] = {
                               type: "class",
                               ...(room && { room }),
                               ...(start && { start }),
                               ...(end && { end })
                            };
                         }
                         count++;
                      }
                      setFlags({...flags, classOverrides: next});
                      setBulkCsv("");
                      alert(`Imported ${count} overrides successfully.`);
                   } catch (e) {
                      alert("Invalid CSV format. " + e.message);
                   }
                }}>Import CSV</button>
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
                             next[date] = { ...next[date] };
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

          {/* Mess Menu Editor */}
          <section className="admin-card" style={{ gridColumn: "1 / -1" }}>
            <h2><UtensilsCrossed size={20} color="var(--amber)" /> Mess Menu Editor</h2>
            <p className="admin-subtext">Edit the weekly mess menu shown on the Mess Card — one dish per line. Stage a day, then publish with "Deploy Config to Cloud".</p>

            {/* Day picker (Mon-first) */}
            <div style={{ display: "flex", gap: 8, marginTop: 12, marginBottom: 16, flexWrap: "wrap" }}>
              {MESS_DAY_ORDER.map(d => {
                const isOverridden = !!flags.messMenuOverrides?.[d];
                const on = d === messEditDay;
                return (
                  <button
                    key={d}
                    className={`admin-btn ${on ? "primary" : "outline"}`}
                    onClick={() => {
                      if (d === messEditDay) return;
                      if (Object.keys(messDrafts).length > 0 && !window.confirm("Discard unstaged edits on this day?")) return;
                      setMessDrafts({});
                      setMessEditDay(d);
                    }}
                    style={{ padding: "7px 14px", fontSize: 13, position: "relative" }}
                  >
                    {MESS_DAY_NAMES[d].slice(0, 3)}
                    {isOverridden && <span title="Menu overridden for this day" style={{ position: "absolute", top: -4, right: -4, width: 10, height: 10, borderRadius: "50%", background: "var(--amber)", border: "2px solid var(--card)" }} />}
                  </button>
                );
              })}
            </div>

            {flags.messMenuOverrides?.[messEditDay] && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 13, color: "var(--amber-text, var(--amber))", background: "var(--amber-transparent, rgba(240,180,41,0.1))", border: "1px solid var(--amber)", borderRadius: 8, padding: "8px 12px" }}>
                <AlertTriangle size={14} /> {MESS_DAY_NAMES[messEditDay]} is overridden — meals below show the overridden menu, not the bundled default.
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
              {MESS_MEALS.map(({ key, label, hint }) => (
                <div key={key} className="admin-field" style={{ marginBottom: 0 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {label}
                    {flags.messMenuOverrides?.[messEditDay]?.[key] && <span style={{ background: "var(--amber)", color: "#000", padding: "1px 6px", borderRadius: 4, fontSize: 9.5, fontWeight: 800, letterSpacing: ".03em" }}>OVERRIDDEN</span>}
                  </label>
                  <textarea
                    className="admin-textarea"
                    rows={6}
                    value={messMealText(key)}
                    onChange={e => setMessDrafts({ ...messDrafts, [key]: e.target.value })}
                    placeholder="One dish per line"
                    style={{ fontSize: 13, lineHeight: 1.5 }}
                  />
                  {hint && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{hint}</div>}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
              <button className="admin-btn primary" onClick={stageMessMenuEdits} style={{ padding: "9px 16px" }}>
                <Check size={15} /> Stage {MESS_DAY_NAMES[messEditDay]}&apos;s Menu
              </button>
              {(flags.messMenuOverrides?.[messEditDay] || Object.keys(messDrafts).length > 0) && (
                <button className="admin-btn outline" onClick={resetMessMenuDay} style={{ padding: "9px 16px", borderColor: "var(--danger)", color: "var(--danger)" }}>
                  <RefreshCw size={15} /> Reset Day to Default
                </button>
              )}
              {Object.keys(messDrafts).length > 0 && (
                <span style={{ fontSize: 12, color: "var(--amber-text, var(--amber))", fontWeight: 600 }}>Unstaged edits — stage them, then deploy config.</span>
              )}
            </div>
          </section>

          {/* Analytics Dashboard — real data from Supabase */}
          <section className="admin-card" style={{ gridColumn: "1 / -1" }}>
             <h2><BarChart2 size={20} color="var(--violet)" /> Analytics & Usage</h2>
             <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>

                {/* 7-Day Active Users — real last_seen_at buckets */}
                <div style={{ flex: 1, minWidth: 250, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
                   <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>7-Day Active Users</div>
                   {(() => {
                      const maxVal = Math.max(...activityChartData, 1);
                      const dayLabels = Array.from({ length: 7 }, (_, i) => {
                        // eslint-disable-next-line react-hooks/purity
                        const d = new Date(Date.now() - (6 - i) * 86400000);
                        return d.toLocaleDateString("en-IN", { weekday: "short" });
                      });
                      return (
                        <>
                          <div style={{ height: 100, display: "flex", alignItems: "flex-end", gap: 6 }}>
                            {activityChartData.map((v, i) => (
                              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", gap: 4 }}>
                                <div title={`${v} users`} style={{ width: "100%", background: i === 6 ? "var(--violet)" : "rgba(109,91,208,0.45)", borderRadius: "4px 4px 0 0", height: `${Math.max(4, (v / maxVal) * 100)}%`, transition: "height 0.4s" }}></div>
                              </div>
                            ))}
                          </div>
                          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                            {dayLabels.map((l, i) => <div key={i} style={{ flex: 1, fontSize: 9, color: "var(--muted)", textAlign: "center", fontWeight: i === 6 ? 800 : 400 }}>{l}</div>)}
                          </div>
                          <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                            Total past 7 days: <strong style={{ color: "var(--text)" }}>{activityChartData.reduce((a, b) => a + b, 0)}</strong> unique sessions
                          </div>
                        </>
                      );
                   })()}
                </div>

                {/* Most-Skipped Classes — from attendance table */}
                <div style={{ flex: 1, minWidth: 250, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
                   <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>Most Skipped Classes</div>
                   <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {skipStats.length === 0 ? (
                         <div className="admin-empty" style={{ fontSize: 12 }}>No absence data yet.</div>
                      ) : skipStats.map(([code, count]) => {
                         const maxSkip = skipStats[0][1];
                         return (
                           <div key={code}>
                             <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                               <span style={{ fontWeight: 600 }}>{code}</span><span style={{ color: "var(--muted)" }}>{count} absences</span>
                             </div>
                             <div style={{ height: 6, background: "var(--card)", borderRadius: 3, overflow: "hidden" }}>
                               <div style={{ width: `${Math.round((count / maxSkip) * 100)}%`, height: "100%", background: "var(--danger)" }}></div>
                             </div>
                           </div>
                         );
                      })}
                   </div>
                </div>

                {/* Peak Hour — computed from last_seen_at timestamps */}
                <div style={{ flex: 1, minWidth: 250, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
                   <Clock size={32} color="var(--blue)" style={{ marginBottom: 12 }} />
                   <div style={{ fontSize: 28, fontWeight: 800 }}>
                     {peakHour !== null ? `${peakHour % 12 || 12}:00 ${peakHour < 12 ? "AM" : "PM"}` : "—"}
                   </div>
                   <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Peak Usage Hour (IST)</div>
                   <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Based on last_seen_at heartbeats</div>
                   {statsLoading && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>Loading...</div>}
                </div>
             </div>
          </section>

          {/* Admin Tools Extra Monitors */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
             
             {/* API Health Check — live pings */}
             <section className="admin-card">
               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                 <h2><Terminal size={20} color="var(--live)" /> API Health Check</h2>
                 <button onClick={checkApiHealth} disabled={healthChecking} className="admin-btn outline" style={{ padding: "4px 10px", fontSize: 12 }}>
                   <RefreshCw size={13} className={healthChecking ? "spin-icon" : ""} /> {healthChecking ? "Checking…" : "Run Check"}
                 </button>
               </div>
               <p className="admin-subtext">Click "Run Check" to probe all services live.</p>
               <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                  {[
                    { key: "supabase", label: "Supabase Database", icon: <Database size={14} /> },
                    { key: "push",     label: "Push Notification Gateway", icon: <BellRing size={14} /> },
                    { key: "sheets",   label: "Google Sheets Live Feed", icon: <FileText size={14} /> },
                  ].map(({ key, label, icon }) => {
                    const s = healthStatus[key];
                    const _isOk  = s && s !== "error" && s !== "timeout";
                    const isErr = s === "error" || s === "timeout";
                    const bg  = !s ? "var(--bg)" : isErr ? "rgba(231,76,60,0.08)" : "rgba(46,204,113,0.08)";
                    const tag = !s ? (healthChecking ? "Checking…" : "Not checked") :
                                isErr ? (s === "timeout" ? "Timeout" : "Error") :
                                key === "supabase" ? s : "Operational";
                    const tagColor = !s ? "var(--muted)" : isErr ? "var(--danger)" : "var(--green)";
                    return (
                      <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: bg, borderRadius: 8, border: `1px solid ${!s ? "var(--border)" : isErr ? "var(--danger)" : "var(--green)"}`, transition: "all 0.3s" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>{icon} {label}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: tagColor, padding: "2px 8px", borderRadius: 10, background: `${tagColor}22` }}>{tag}</span>
                      </div>
                    );
                  })}
               </div>
             </section>

             {/* A/B Testing — managed from flags.abTests */}
             <section className="admin-card">
               <h2><Flag size={20} color="var(--blue)" /> A/B Testing</h2>
               <p className="admin-subtext">Rollout experiments stored in flags. Deploy config to apply changes.</p>

               {/* Add new experiment */}
               <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                 <div className="admin-field" style={{ flex: 2, minWidth: 140 }}>
                   <label>Experiment Name</label>
                   <input className="admin-input" value={abTestName} onChange={e => setAbTestName(e.target.value)} placeholder="e.g. new_home_v4" />
                 </div>
                 <div className="admin-field" style={{ flex: 1, minWidth: 80 }}>
                   <label>Rollout %</label>
                   <input type="number" min={0} max={100} className="admin-input" value={abTestRollout} onChange={e => setAbTestRollout(Number(e.target.value))} />
                 </div>
                 <button className="admin-btn primary" style={{ marginBottom: 10 }} onClick={() => {
                   const key = abTestName.trim().toLowerCase().replace(/\s+/g, "_");
                   if (!key) return alert("Enter an experiment name.");
                   setFlags({ ...flags, abTests: { ...(flags.abTests || {}), [key]: { name: abTestName.trim(), rollout: abTestRollout, active: true } } });
                   setAbTestName(""); setAbTestRollout(50);
                 }}>Add</button>
               </div>

               {/* Existing experiments */}
               <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                 {Object.keys(flags.abTests || {}).length === 0 ? (
                   <div className="admin-empty">No experiments. Add one above.</div>
                 ) : Object.entries(flags.abTests || {}).map(([key, exp]) => (
                   <div key={key} style={{ padding: 12, background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
                     <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                       <div>
                         <span style={{ fontSize: 13, fontWeight: 700 }}>{exp.name || key}</span>
                         <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>({key})</span>
                       </div>
                       <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                         <input type="number" min={0} max={100} value={exp.rollout} onChange={e => setFlags({ ...flags, abTests: { ...flags.abTests, [key]: { ...exp, rollout: Number(e.target.value) } } })} style={{ width: 52, padding: "2px 6px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 12, textAlign: "center" }} />
                         <span style={{ fontSize: 11, color: "var(--muted)" }}>%</span>
                         <button onClick={() => {
                           const next = { ...flags.abTests }; delete next[key];
                           setFlags({ ...flags, abTests: next });
                         }} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2 }}><Trash2 size={14} color="var(--danger)" /></button>
                       </div>
                     </div>
                     <div style={{ height: 6, background: "var(--card)", borderRadius: 3, overflow: "hidden", border: "1px solid var(--border)" }}>
                       <div style={{ width: `${Math.min(100, Math.max(0, exp.rollout))}%`, height: "100%", background: "var(--blue)", transition: "width 0.3s" }}></div>
                     </div>
                   </div>
                 ))}
               </div>
             </section>



             {/* Friend Pings & Share Codes */}
             <section className="admin-card">
               <h2><Users size={20} color="var(--green)" /> Social Hygiene</h2>
               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>Pending Friend Pings</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                     <span style={{ fontWeight: 800, fontSize: 16 }}>{friendPingsCount}</span>
                  </div>
               </div>
               
               <h3 style={{ fontSize: 12, textTransform: "uppercase", color: "var(--muted)", margin: "16px 0 8px 0", letterSpacing: "1px" }}>Active Share Codes</h3>
               <div style={{ maxHeight: 150, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                  {shareCodes.length === 0 ? <div className="admin-empty">No active share codes.</div> : 
                     [...shareCodes].sort((a, b) => {
                        const nameA = allUsers.find(u => u.user_id === a.user_id)?.name;
                        const nameB = allUsers.find(u => u.user_id === b.user_id)?.name;
                        if (nameA && !nameB) return -1;
                        if (!nameA && nameB) return 1;
                        return 0;
                     }).map(sc => {
                        const owner = allUsers.find(u => u.user_id === sc.user_id);
                        return (
                           <div key={sc.code} style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}>
                              <span style={{ fontWeight: 700, letterSpacing: "1px" }}>{sc.code}</span>
                              <span style={{ color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{owner?.name ? owner.name : sc.user_id}</span>
                           </div>
                        )
                     })
                  }
               </div>
             </section>
             
             {/* Enrollment Distribution */}
             <section className="admin-card">
               <h2><Database size={20} color="var(--violet)" /> Enrollment Stats</h2>
               <p className="admin-subtext">Top 5 most popular courses by enrollment.</p>
               <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                  {popularCourses.length === 0 ? <div className="admin-empty">No data.</div> : 
                     popularCourses.slice(0, 5).map(([code, count]) => {
                        const max = popularCourses[0][1];
                        const pct = Math.round((count / max) * 100);
                        return (
                           <div key={code}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                                 <span style={{ fontWeight: 600 }}>{code}</span>
                                 <span style={{ color: "var(--muted)" }}>{count} enrolled</span>
                              </div>
                              <div style={{ height: 6, background: "var(--bg)", borderRadius: 4, overflow: "hidden", border: "1px solid var(--border)" }}>
                                 <div style={{ height: "100%", width: `${pct}%`, background: "var(--violet)" }}></div>
                              </div>
                           </div>
                        )
                     })
                  }
               </div>
             </section>
          </div>

        <section className="admin-card" style={{ display: "flex", flexDirection: "column" }}>
          <h2><Megaphone size={20} color="var(--amber)" /> Scheduled Announcements</h2>
          <p className="admin-subtext">Schedule targeted announcements. Active ones will appear as banners to matched users.</p>
          
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <input type="date" value={announcementStart} onChange={e => setAnnouncementStart(e.target.value)} className="admin-input" style={{ flex: "1 1 130px", padding: "8px", borderRadius: 8, border: "1px solid var(--border)" }} title="Start Date" />
            <input type="date" value={announcementEnd} onChange={e => setAnnouncementEnd(e.target.value)} className="admin-input" style={{ flex: "1 1 130px", padding: "8px", borderRadius: 8, border: "1px solid var(--border)" }} title="End Date (Inclusive)" />
            <select className="admin-input" value={announcementTarget} onChange={e => setAnnouncementTarget(e.target.value)} style={{ flex: "2 1 200px", padding: "8px", borderRadius: 8, border: "1px solid var(--border)" }}>
              <option value="global">Global</option>
              <option value="section_A">Section A</option>
              <option value="section_B">Section B</option>
              <option value="has_friends">Social Users</option>
              <optgroup label="Subject Wise">
                {Object.entries(LEGEND || {}).map(([code]) => (
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
          {announcement && (
             <div style={{ padding: "12px", background: "var(--amber-transparent)", borderLeft: "4px solid var(--amber)", borderRadius: "0 8px 8px 0", marginTop: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                   <Megaphone size={16} color="var(--amber)" style={{ marginTop: 2, flexShrink: 0 }} />
                   <div style={{ fontSize: 13, color: "var(--amber-text)", fontWeight: 500, lineHeight: 1.4 }}>{announcement}</div>
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)", display: "flex", justifyContent: "flex-end" }}>
                   Preview mode: <button style={{ marginLeft: 4, background: "transparent", border: "none", color: "var(--blue)", cursor: "pointer", textDecoration: "underline" }} onClick={(e) => {
                      const t = e.currentTarget;
                      const p = t.parentElement.parentElement;
                      if(p.style.background.includes("transparent")) {
                         p.style.background = "#fff";
                         p.style.color = "#000";
                         t.innerText = "Light";
                      } else {
                         p.style.background = "var(--amber-transparent)";
                         p.style.color = "var(--amber-text)";
                         t.innerText = "Dark";
                      }
                   }}>Dark</button>
                </div>
             </div>
          )}
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
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <input type="date" value={qlStart} onChange={e => setQlStart(e.target.value)} className="admin-input" style={{ flex: "1 1 130px", padding: "8px", borderRadius: 8, border: "1px solid var(--border)" }} title="Start Date" />
            <input type="date" value={qlEnd} onChange={e => setQlEnd(e.target.value)} className="admin-input" style={{ flex: "1 1 130px", padding: "8px", borderRadius: 8, border: "1px solid var(--border)" }} title="End Date (Inclusive)" />
            <button className="admin-btn primary" style={{ flex: "1 1 130px" }} onClick={() => {
              if (!qlTitle || !qlUrl || !qlStart || !qlEnd) return alert("Fill all fields.");
              const newItem = { id: Date.now().toString(), title: qlTitle, url: qlUrl, start: qlStart, end: qlEnd };
              setFlags({...flags, quickLinks: [...(flags.quickLinks || []), newItem]});
              setQlTitle(""); setQlUrl(""); setQlStart(""); setQlEnd("");
            }}>
              Add Quick Link
            </button>
          </div>

          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
            {(flags.quickLinks || []).map((ql, idx) => (
              <div key={ql.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{ql.title}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{ql.url} | {ql.start} to {ql.end}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => {
                    if(idx === 0) return;
                    const next = [...flags.quickLinks];
                    [next[idx-1], next[idx]] = [next[idx], next[idx-1]];
                    setFlags({...flags, quickLinks: next});
                  }} disabled={idx === 0} className="admin-btn outline" style={{ padding: "4px 8px", opacity: idx === 0 ? 0.3 : 1 }}>↑</button>
                  <button onClick={() => {
                    if(idx === flags.quickLinks.length - 1) return;
                    const next = [...flags.quickLinks];
                    [next[idx+1], next[idx]] = [next[idx], next[idx+1]];
                    setFlags({...flags, quickLinks: next});
                  }} disabled={idx === flags.quickLinks.length - 1} className="admin-btn outline" style={{ padding: "4px 8px", opacity: idx === flags.quickLinks.length - 1 ? 0.3 : 1 }}>↓</button>
                  
                  <button onClick={() => {
                    setFlags({...flags, quickLinks: flags.quickLinks.filter(x => x.id !== ql.id)});
                  }} className="admin-btn outline" style={{ padding: "4px 8px", borderColor: "var(--danger)", color: "var(--danger)" }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>

          {/* Push Notification Broadcast */}
          <section className="admin-card" style={{ display: "flex", flexDirection: "column" }}>
            <h2><BellRing size={20} color="var(--live)" /> Push Notifications</h2>
            <p className="admin-subtext">Send a push notification to every device that enabled push on the Announcements page. Delivered even when the app is closed.</p>
            <div className="admin-field-row">
              <div className="admin-field">
                <label>Title</label>
                <input className="admin-input" value={pushTitle} onChange={e => setPushTitle(e.target.value)} placeholder="e.g. Room change: FIN-201 today" maxLength={80} />
              </div>
              <div className="admin-field">
                <label>Open URL (optional)</label>
                <input className="admin-input" value={pushUrl} onChange={e => setPushUrl(e.target.value)} placeholder="/?view=today" />
              </div>
            </div>
            <div className="admin-field">
              <label>Message</label>
              <textarea className="admin-textarea" value={pushBody} onChange={e => setPushBody(e.target.value)} placeholder="e.g. Today's 11:30 FIN-201 class moved to Room C-104." rows={2} maxLength={200}></textarea>
            </div>
            <div className="admin-field-row" style={{ marginTop: 8 }}>
               <div className="admin-field">
                 <label>Schedule Date (Optional)</label>
                 <input type="date" className="admin-input" value={pushScheduleDate} onChange={e => setPushScheduleDate(e.target.value)} />
               </div>
               <div className="admin-field">
                 <label>Schedule Time (Optional)</label>
                 <input type="time" className="admin-input" value={pushScheduleTime} onChange={e => setPushScheduleTime(e.target.value)} />
               </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
              <button className="admin-btn primary" onClick={() => {
                 if (pushScheduleDate && pushScheduleTime) {
                    if (!pushTitle.trim() || !pushBody.trim()) return alert("Fill in title and message.");
                    const newItem = { id: Date.now().toString(), title: pushTitle.trim(), body: pushBody.trim(), url: pushUrl.trim(), date: pushScheduleDate, time: pushScheduleTime };
                    setFlags({...flags, scheduledPushes: [...(flags.scheduledPushes || []), newItem]});
                    setPushTitle(""); setPushBody(""); setPushUrl(""); setPushScheduleDate(""); setPushScheduleTime("");
                    setPushResult("Push scheduled successfully (Requires deploy).");
                 } else {
                    sendPushBroadcast();
                 }
              }} disabled={pushSending}>
                <BellRing size={14} /> {pushSending ? "Sending..." : (pushScheduleDate && pushScheduleTime ? "Queue Push Notification" : "Send to All Subscribers")}
              </button>
              {pushResult && (
                <span className="admin-subtext" style={{ margin: 0, color: pushResult.startsWith("Sent") || pushResult.startsWith("Push scheduled") ? "var(--live)" : "var(--danger)" }}>{pushResult}</span>
              )}
            </div>

            {flags.scheduledPushes && flags.scheduledPushes.length > 0 && (
               <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Queued Pushes</label>
                  {flags.scheduledPushes.map(p => (
                     <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
                       <div>
                         <div style={{ fontSize: 13, fontWeight: 600 }}>{p.title}</div>
                         <div style={{ fontSize: 11, color: "var(--muted)" }}>Scheduled for {p.date} at {p.time}</div>
                       </div>
                       <button onClick={() => {
                         setFlags({...flags, scheduledPushes: flags.scheduledPushes.filter(x => x.id !== p.id)});
                       }} className="admin-btn outline" style={{ padding: "4px 8px", borderColor: "var(--danger)", color: "var(--danger)" }}><Trash2 size={14} /></button>
                     </div>
                  ))}
               </div>
            )}
          </section>

          {/* What's New — feature updates */}
          <section className="admin-card" style={{ display: "flex", flexDirection: "column" }}>
            <h2><Sparkles size={20} color="var(--violet)" /> What&rsquo;s New (Feature Updates)</h2>
            <p className="admin-subtext">Announce new features. Students see a "NEW" pill on the Today view until they open the What&rsquo;s New list. Publish with Deploy Config to Cloud.</p>
            <div className="admin-field-row">
              <div className="admin-field" style={{ flex: "0 0 90px" }}>
                <label>Emoji</label>
                <input className="admin-input" value={wnEmoji} onChange={e => setWnEmoji(e.target.value)} placeholder="🔔" maxLength={4} />
              </div>
              <div className="admin-field">
                <label>Feature Title</label>
                <input className="admin-input" value={wnTitle} onChange={e => setWnTitle(e.target.value)} placeholder="e.g. Class reminders are here" maxLength={60} />
              </div>
            </div>
            <div className="admin-field">
              <label>Description</label>
              <textarea className="admin-textarea" value={wnDesc} onChange={e => setWnDesc(e.target.value)} placeholder="e.g. Enable push on the Announcements tab to get pinged 15/30/60 min before your classes." rows={2} maxLength={200}></textarea>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button className="admin-btn primary" style={{ alignSelf: "flex-start" }} onClick={() => {
                if (!wnTitle.trim()) return alert("Feature title is required.");
                if (wnEditingId) {
                  // Edit in place — keeps its original date and list position
                  setFlags({
                    ...flags,
                    whatsNew: (flags.whatsNew || []).map(x => x.id === wnEditingId
                      ? { ...x, emoji: wnEmoji.trim(), title: wnTitle.trim(), desc: wnDesc.trim() }
                      : x)
                  });
                } else {
                  const entry = {
                    id: Date.now().toString(),
                    date: new Date().toISOString().split("T")[0],
                    emoji: wnEmoji.trim(),
                    title: wnTitle.trim(),
                    desc: wnDesc.trim(),
                  };
                  // newest first, keep the list short — students only care about recent
                  setFlags({ ...flags, whatsNew: [entry, ...(flags.whatsNew || [])].slice(0, 10) });
                }
                setWnEmoji(""); setWnTitle(""); setWnDesc(""); setWnEditingId(null);
              }}>
                <Sparkles size={14} /> {wnEditingId ? "Save Changes" : "Add Feature Update"}
              </button>
              {wnEditingId && (
                <button className="admin-btn outline" onClick={() => { setWnEmoji(""); setWnTitle(""); setWnDesc(""); setWnEditingId(null); }}>
                  Cancel
                </button>
              )}
            </div>

            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              {(flags.whatsNew || []).map(w => (
                <div key={w.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 12px", background: w.id === wnEditingId ? "rgba(109, 91, 208, 0.08)" : "var(--bg)", borderRadius: 8, border: `1px solid ${w.id === wnEditingId ? "var(--violet)" : "var(--border)"}` }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.emoji ? `${w.emoji} ` : ""}{w.title}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.date}{w.desc ? ` — ${w.desc}` : ""}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => { setWnEmoji(w.emoji || ""); setWnTitle(w.title || ""); setWnDesc(w.desc || ""); setWnEditingId(w.id); }} className="admin-btn outline" style={{ padding: "4px 8px" }} aria-label="Edit"><Pencil size={14} /></button>
                    <button onClick={() => {
                      setFlags({ ...flags, whatsNew: flags.whatsNew.filter(x => x.id !== w.id) });
                      if (wnEditingId === w.id) { setWnEmoji(""); setWnTitle(""); setWnDesc(""); setWnEditingId(null); }
                    }} className="admin-btn outline" style={{ padding: "4px 8px", borderColor: "var(--danger)", color: "var(--danger)" }} aria-label="Delete"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>

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

        <section className="admin-card admin-directory-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
             <h2><Users size={20} color="var(--green)" /> User Directory</h2>
             <button className="admin-btn outline" onClick={() => {
                const csvRows = [["User ID", "Name", "Email", "Courses"]];
                filteredUsers.forEach(u => {
                   csvRows.push([
                      u.user_id, 
                      u.name || "", 
                      u.email || "", 
                      u.courses ? Object.keys(u.courses).filter(c => c !== "_name" && c !== "_email").join(";") : ""
                   ].map(v => `"${v}"`).join(","));
                });
                const blob = new Blob([csvRows.join("\n")], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'user_export.csv';
                a.click();
             }} style={{ padding: "4px 10px", fontSize: 12 }}>Export Filtered to CSV</button>
          </div>
          <div className="admin-search-box" style={{ marginTop: 12 }}>
            <Search size={16} color="var(--muted)" />
            <input 
              type="text" 
              placeholder="Search users..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div style={{ marginBottom: 12, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {["All", "A", "B"].map(sec => (
                 <button key={sec} onClick={() => setUserSectionFilter(sec)} className={`admin-btn ${userSectionFilter === sec ? "" : "outline"}`} style={{ padding: "4px 10px", fontSize: 12 }}>
                    {sec === "All" ? "All Sections" : `Section ${sec}`}
                 </button>
              ))}
            </div>
          </div>

          {selectedUserIds.size > 0 && (
             <div style={{ background: "var(--amber-transparent)", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--amber)", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--amber-text)" }}>{selectedUserIds.size} Users Selected</span>
                <div style={{ display: "flex", gap: 8 }}>
                   <button className="admin-btn outline" onClick={() => {
                      const next = [...(flags.bannedUsers || [])];
                      selectedUserIds.forEach(id => { if(!next.includes(id)) next.push(id) });
                      setFlags({...flags, bannedUsers: next});
                      setSelectedUserIds(new Set());
                   }} style={{ fontSize: 11, padding: "4px 8px", borderColor: "var(--danger)", color: "var(--danger)" }}>Ban Selected</button>
                   
                   <button className="admin-btn outline" onClick={() => {
                      let next = [...(flags.bannedUsers || [])];
                      selectedUserIds.forEach(id => { next = next.filter(b => b !== id) });
                      setFlags({...flags, bannedUsers: next});
                      setSelectedUserIds(new Set());
                   }} style={{ fontSize: 11, padding: "4px 8px" }}>Unban Selected</button>

                   <button className="admin-btn outline" onClick={() => setSelectedUserIds(new Set())} style={{ fontSize: 11, padding: "4px 8px" }}>Clear Selection</button>
                </div>
             </div>
          )}

          <div className="admin-user-list">
            {loadingUsers ? (
              <div className="admin-loading">Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="admin-empty">No users found.</div>
            ) : (
              filteredUsers.map(u => (
                <div key={u.user_id} className="admin-user-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--border)", background: selectedUserIds.has(u.user_id) ? "var(--bg)" : "transparent" }}>
                  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    <input 
                       type="checkbox" 
                       checked={selectedUserIds.has(u.user_id)}
                       onChange={e => {
                          const next = new Set(selectedUserIds);
                          if(e.target.checked) next.add(u.user_id);
                          else next.delete(u.user_id);
                          setSelectedUserIds(next);
                       }}
                       style={{ width: 16, height: 16, accentColor: "var(--violet)" }}
                    />
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

        {/* Feedback Flash Scheduler */}
        <section className="admin-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2><MessageSquare size={20} color="var(--amber)" /> Feedback Flash Scheduler</h2>
            <button 
              onClick={() => setFeedbackFlashes([...feedbackFlashes, { id: Date.now().toString(), enabled: false, deadline: "", link: "", subjects: [] }])} 
              className="admin-btn outline" style={{ fontSize: 12, padding: "4px 8px" }}
            >
              + Add Flash
            </button>
          </div>
          <p className="admin-sub">
            Each enabled flash nudges targeted users up to 3 times: on announce (first save), 2 hours before and 20 minutes
            before the deadline. Each nudge shows for 1 hour and users can dismiss it once per session.
          </p>

          <div className="admin-form" style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            {feedbackFlashes.map((ff, index) => {
              const HOUR = 60 * 60 * 1000;
              const now = Date.now();
              const deadlineMs = ff.deadline ? new Date(ff.deadline).getTime() : null;

              const fmtAbs = ms => new Date(ms).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
              const fmtRel = ms => {
                const diff = ms - now;
                const mins = Math.round(Math.abs(diff) / 60000);
                const txt = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`;
                return diff >= 0 ? `in ${txt}` : `${txt} ago`;
              };

              const triggers = deadlineMs ? [
                { key: "announced", name: "Announce", time: ff.announcedAt ? new Date(ff.announcedAt).getTime() : null, pendingNote: "on first save" },
                { key: "2h", name: "2h before", time: deadlineMs - 2 * HOUR },
                { key: "20m", name: "20m before", time: deadlineMs - 20 * 60 * 1000 },
              ] : [];
              const inWindow = t => t != null && now >= t && now <= t + HOUR;

              const status = !ff.enabled
                ? { label: "Draft", color: "var(--muted)", bg: "color-mix(in srgb, var(--muted) 14%, transparent)" }
                : !deadlineMs
                  ? { label: "Needs deadline", color: "var(--amber)", bg: "rgba(234, 179, 8, .14)" }
                  : now > deadlineMs
                    ? { label: "Expired", color: "var(--red)", bg: "rgba(225, 29, 72, .10)" }
                    : triggers.some(t => inWindow(t.time))
                      ? { label: "Live now", color: "var(--live)", bg: "rgba(31, 169, 113, .14)" }
                      : { label: "Scheduled", color: "var(--violet)", bg: "rgba(109, 91, 208, .12)" };

              return (
                <div key={ff.id} style={{ display: "flex", flexDirection: "column", gap: 14, padding: 18, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, position: "relative", opacity: ff.enabled ? 1 : .72 }}>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input type="checkbox" checked={ff.enabled} onChange={e => setFeedbackFlashes(feedbackFlashes.map(f => f.id === ff.id ? { ...f, enabled: e.target.checked } : f))} />
                      <span style={{ fontWeight: 600 }}>Flash #{index + 1}</span>
                    </label>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: status.color, background: status.bg, padding: "3px 10px", borderRadius: 20 }}>
                      {status.label}
                    </span>
                    <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                      <button onClick={() => setPreviewFlashId(ff.id)} disabled={!ff.enabled} className="admin-btn" style={{ padding: "4px 8px", fontSize: 12 }}>
                        Preview
                      </button>
                      <button onClick={() => setFeedbackFlashes(feedbackFlashes.filter(f => f.id !== ff.id))} className="admin-btn outline" style={{ padding: "4px 8px", fontSize: 12, color: "var(--red)", borderColor: "var(--red)" }}>
                        Remove
                      </button>
                    </div>
                  </div>

                  {/* At-a-glance summary — visible even when the flash is disabled */}
                  <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
                    {deadlineMs ? (
                      <>
                        Deadline <strong style={{ color: "var(--text)" }}>{fmtAbs(deadlineMs)}</strong> ({fmtRel(deadlineMs)})
                        {" · "}{(ff.subjects || []).length ? `Targets ${ff.subjects.join(", ")}` : "All users"}
                        {" · "}{ff.link ? "External form" : "In-app widget"}
                      </>
                    ) : (
                      "No deadline set — this flash will never fire."
                    )}
                  </div>

                  {ff.enabled && (
                    <>
                      {deadlineMs && now > deadlineMs && (
                        <div style={{ fontSize: 12.5, color: "var(--red)", background: "rgba(225, 29, 72, .07)", border: "1px solid rgba(225, 29, 72, .18)", borderRadius: 10, padding: "8px 12px" }}>
                          Deadline has passed — users no longer see this flash. Set a new deadline to reuse it, or remove it to keep the list clean.
                        </div>
                      )}

                      {/* Trigger timeline: when users will actually see this flash */}
                      {deadlineMs && now <= deadlineMs && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {triggers.map(t => {
                            const live = inWindow(t.time);
                            const fired = t.time != null && now > t.time + HOUR;
                            const color = live ? "var(--live)" : fired ? "var(--muted)" : "var(--violet)";
                            return (
                              <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color, background: "var(--card)", border: `1px solid ${live ? "rgba(31, 169, 113, .35)" : "var(--border)"}`, borderRadius: 20, padding: "4px 10px" }}>
                                <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
                                {t.name}: {t.time == null ? t.pendingNote : live ? "live now" : fired ? "shown" : fmtRel(t.time)}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div className="admin-field">
                          <label>Deadline <span className="admin-optional">(Nudges fire before this)</span></label>
                          <input type="datetime-local" className="admin-input" value={ff.deadline || ""} onChange={e => setFeedbackFlashes(feedbackFlashes.map(f => f.id === ff.id ? { ...f, deadline: e.target.value } : f))} />
                        </div>

                        <div className="admin-field">
                          <label>Form Link <span className="admin-optional">(If blank, opens in-app widget)</span></label>
                          <input type="url" className="admin-input" value={ff.link || ""} onChange={e => setFeedbackFlashes(feedbackFlashes.map(f => f.id === ff.id ? { ...f, link: e.target.value } : f))} placeholder="https://forms.gle/..." />
                        </div>
                      </div>

                      <div className="admin-field">
                        <label>Target Subjects <span className="admin-optional">(Only enrolled users are nudged. None selected = everyone)</span></label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                          {Object.keys(LEGEND).map(code => {
                            const isSelected = (ff.subjects || []).includes(code);
                            return (
                              <button
                                key={code}
                                type="button"
                                onClick={() => {
                                  const newSubjects = isSelected ? (ff.subjects || []).filter(c => c !== code) : [...(ff.subjects || []), code];
                                  setFeedbackFlashes(feedbackFlashes.map(f => f.id === ff.id ? { ...f, subjects: newSubjects } : f));
                                }}
                                className={`admin-btn ${isSelected ? "primary" : "outline"}`}
                                style={{ padding: "4px 10px", fontSize: 12, borderRadius: 20 }}
                                title={LEGEND[code].name}
                              >
                                {code}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {feedbackFlashes.length === 0 && (
              <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", background: "var(--bg)", borderRadius: 12, border: "1px dashed var(--border)" }}>
                No feedback flashes scheduled. Add one and users get nudged automatically as its deadline approaches.
              </div>
            )}
            
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button onClick={saveConfig} disabled={saving} className="admin-btn primary">
                <Save size={16} /> Save Scheduler Config
              </button>
            </div>

            {previewFlashId && (
              <FeedbackFlashToast 
                config={{ 
                  deadline: feedbackFlashes.find(f => f.id === previewFlashId)?.deadline, 
                  link: feedbackFlashes.find(f => f.id === previewFlashId)?.link,
                  subjectName: (feedbackFlashes.find(f => f.id === previewFlashId)?.subjects || []).length > 0 ? LEGEND[feedbackFlashes.find(f => f.id === previewFlashId).subjects[0]]?.name : null
                }} 
                onClose={() => setPreviewFlashId(null)} 
              />
            )}
          </div>
        </section>

        {/* Feedback Section */}
        <section className="admin-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2><Terminal size={20} color="var(--green)" /> Feedback & Bug Reports</h2>
            <div style={{ display: "flex", gap: 6 }}>
               <button onClick={() => setFeedbackFilter("all")} className={`admin-btn ${feedbackFilter === "all" ? "" : "outline"}`} style={{ padding: "4px 8px", fontSize: 12 }}>All</button>
               <button onClick={() => setFeedbackFilter("pending")} className={`admin-btn ${feedbackFilter === "pending" ? "" : "outline"}`} style={{ padding: "4px 8px", fontSize: 12 }}>Pending Only</button>
            </div>
          </div>
          <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
            {feedbackList.filter(f => feedbackFilter === "all" || f.status === "pending").length === 0 ? <div className="admin-empty">No feedback found.</div> : 
             feedbackList.filter(f => feedbackFilter === "all" || f.status === "pending").map(f => {
               const fUser = allUsers.find(u => u.user_id === f.user_id);
               return (
               <div key={f.id} style={{ padding: "12px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8 }}>
                 <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                   <span style={{ fontSize: 12, color: "var(--muted)" }}>{new Date(f.created_at).toLocaleString()} • {fUser ? fUser.name : f.user_id}</span>
                   <span style={{ fontSize: 12, fontWeight: 700, color: f.status === "resolved" ? "var(--green)" : "var(--amber)" }}>{f.status.toUpperCase()}</span>
                 </div>
                 <div style={{ fontSize: 14, color: "var(--text)" }}>{f.message}</div>
                 {f.status === "pending" && (
                   <button onClick={() => markFeedbackResolved(f.id)} style={{ marginTop: 8, background: "transparent", border: "none", color: "var(--green)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Mark Resolved</button>
                 )}
               </div>
             )})}
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 24 }}>
          <section className="admin-card">
            <h2><Flag size={20} color="var(--violet)" /> Feature Flags</h2>
            <div className="admin-flag-list">
              {Object.keys(flags).filter(k => k !== "maintenanceMode" && k !== "bannedUsers" && k !== "classOverrides" && k !== "abTests" && k !== "scheduledAnnouncements" && k !== "quickLinks" && k !== "heroBackdrop" && k !== "whatsNew" && k !== "updatePrompt" && k !== "dispatchEnabled").map(key => (
                <label key={key} className="admin-flag-item">
                  <input 
                    type="checkbox" 
                    checked={!!flags[key]} 
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
                     now={PREVIEW_NOW - 1000 * 60 * 30}
                     todayISO={PREVIEW_TODAY_ISO}
                     tomorrowISO={PREVIEW_TOMORROW_ISO}
                     current={{ name: "Strategic Management", start: "10:00", end: "11:30", room: "LT-1", date: PREVIEW_TODAY_ISO, type: "class", code: "SM" }}
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <h2 style={{ margin: 0, padding: 0 }}><Terminal size={20} color="var(--violet)" /> Live Sync Logs</h2>
                <p className="admin-subtext" style={{ margin: 0 }}>Real-time status of the connection to the Google Apps Script live feed.</p>
              </div>
              {syncLogs.length > 5 && (
                <button className="admin-btn outline" onClick={() => setShowAllLogs(!showAllLogs)} style={{ padding: "6px 12px", fontSize: 12, flex: "none" }}>
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

          <section className="admin-card">
            <h2><Database size={20} color="var(--violet)" /> Bundled Snapshot</h2>
            <p className="admin-subtext">
              Fallback timetable baked into the app at build time. Regenerated automatically from the live sheet on every deploy.
            </p>

            <div className="admin-danger-row">
              <div>
                <strong style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  {snapshotMeta.status === "success" ? (
                    <><Check size={15} color="var(--live, #2ecc71)" /> Automation passed</>
                  ) : (
                    <><AlertTriangle size={15} color="var(--danger, #e74c3c)" /> Automation failed</>
                  )}
                </strong>
                <span className="admin-subtext" style={{ margin: 0 }}>
                  {snapshotMeta.status === "success" ? (
                    <>Generated {new Date(snapshotMeta.ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {snapshotMeta.classes} classes · {snapshotMeta.courses} courses · term {snapshotMeta.termStart} → {snapshotMeta.termEnd}</>
                  ) : (
                    <>
                      {snapshotMeta.error || "Feed unreachable at build time"} — serving snapshot from{" "}
                      {snapshotMeta.lastSuccessTs ? new Date(snapshotMeta.lastSuccessTs).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "an older build"}
                    </>
                  )}
                </span>
              </div>
              <button className="admin-btn outline" onClick={triggerSnapshotRebuild} disabled={rebuilding}>
                <RefreshCw size={14} className={rebuilding ? "spin-icon" : ""} /> Rebuild
              </button>
            </div>
            {rebuildMsg && (
              <span className={`admin-save-msg ${rebuildMsg.startsWith("Failed") ? "error" : "success"}`} style={{ display: "block", marginTop: 8 }}>
                {rebuildMsg}
              </span>
            )}
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
                  checked={!!flags.maintenanceMode}
                  onChange={e => setFlags({ ...flags, maintenanceMode: e.target.checked })}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="admin-danger-row">
              <div>
                <strong style={{ display: "block", marginBottom: 4 }}>Push Dispatcher</strong>
                <span className="admin-subtext" style={{ margin: 0 }}>
                  ON: the notifications system delivers push. OFF: pauses all outgoing push within a minute (the in-app inbox still updates; queued events resume when re-enabled). Kill-switch if the new push system misbehaves — flip OFF, then redeploy the legacy functions to fully fall back.
                </span>
              </div>
              <label className="admin-toggle">
                <input
                  type="checkbox"
                  checked={flags.dispatchEnabled !== false}
                  onChange={e => setFlags({ ...flags, dispatchEnabled: e.target.checked })}
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
        </div>
      </div>

      <div className="admin-save-footer" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button className="admin-save-btn" onClick={saveConfig} disabled={saving} style={{ position: "relative" }}>
          <Save size={18} /> {saving ? "Saving..." : "Deploy Config to Cloud"}
          {changesCount > 0 && (
             <div style={{ position: "absolute", top: -8, right: -8, background: "var(--danger)", color: "#fff", fontSize: 10, fontWeight: "bold", padding: "2px 6px", borderRadius: 10 }}>
               {changesCount} changed
             </div>
          )}
        </button>
        {activeOverrideCount > 0 && (
          <span style={{ fontSize: 12, color: "var(--orange)", display: "flex", alignItems: "center", gap: 4 }}>
            <AlertTriangle size={14} /> {activeOverrideCount} active overrides
          </span>
        )}
        {staleConfigCount > 0 && (
          <button className="admin-btn outline" onClick={purgeStaleConfig} title="Remove past-dated class overrides, expired announcements and quick links from the config students download" style={{ padding: "9px 16px" }}>
            <Trash2 size={15} /> Purge expired ({staleConfigCount})
          </button>
        )}
        {originalFlags && (
          <button className="admin-btn outline" onClick={() => {
             if (confirm("Revert all unsaved changes back to the currently deployed config?")) {
                setFlags(originalFlags);
                setSaveMsg("Reverted to deployed config.");
                setTimeout(() => setSaveMsg(""), 3000);
             }
          }} style={{ padding: "9px 16px" }}>
            <RefreshCw size={15} /> Revert Changes
          </button>
        )}
        {flags.configHistory && flags.configHistory.length > 0 && (
           <div style={{ position: "relative", display: "inline-block" }}>
              <select className="admin-input" onChange={e => {
                 if(!e.target.value) return;
                 const selectedHistory = flags.configHistory[parseInt(e.target.value)];
                 if(confirm(`Restore configuration saved on ${new Date(selectedHistory.timestamp).toLocaleString()}?`)) {
                    setFlags(selectedHistory.flags);
                    setSaveMsg("Restored from history. Deploy to apply.");
                    setTimeout(() => setSaveMsg(""), 3000);
                 }
                 e.target.value = ""; // reset
              }} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", width: 220 }}>
                 <option value="">Restore Past Version...</option>
                 {flags.configHistory.map((h, i) => (
                    <option key={h.timestamp} value={i}>{new Date(h.timestamp).toLocaleString()} by {h.author || "Admin"}</option>
                 ))}
              </select>
           </div>
        )}
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
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "var(--card)", padding: 24, borderRadius: 16, width: "90%", maxWidth: 400, maxHeight: "85vh", overflowY: "auto", zIndex: 10001, border: "1px solid var(--border)", boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, display: "flex", gap: 8, alignItems: "center" }}><Users size={18} color="var(--violet)" /> User Information</h2>
              <button onClick={() => setSelectedUser(null)} style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer" }}><XCircle size={18} /></button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><strong style={{ color: "var(--muted)", fontSize: 12, display: "block", textTransform: "uppercase" }}>Name</strong>{selectedUser.name}</div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                 <div><strong style={{ color: "var(--muted)", fontSize: 12, display: "block", textTransform: "uppercase" }}>User ID</strong>{selectedUser.user_id}</div>
                 <div style={{ textAlign: "right" }}><strong style={{ color: "var(--muted)", fontSize: 12, display: "block", textTransform: "uppercase" }}>Last Active</strong>{selectedUser.last_seen_at ? new Date(selectedUser.last_seen_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never"}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
                 <strong style={{ color: "var(--muted)", fontSize: 12, textTransform: "uppercase" }}>Role:</strong>
                 <select className="admin-input" value={flags.adminRoles?.[selectedUser.user_id] || "user"} onChange={e => {
                    const role = e.target.value;
                    const nextRoles = { ...(flags.adminRoles || {}) };
                    if (role === "user") delete nextRoles[selectedUser.user_id];
                    else nextRoles[selectedUser.user_id] = role;
                    setFlags({...flags, adminRoles: nextRoles});
                 }} style={{ padding: "4px 8px", fontSize: 12, flex: 1 }}>
                    <option value="user">Standard User</option>
                    <option value="monitor">Monitor (Read-only Admin)</option>
                    <option value="superadmin">Superadmin</option>
                 </select>
              </div>
              <div>
                <strong style={{ color: "var(--muted)", fontSize: 12, display: "block", textTransform: "uppercase", marginBottom: 4 }}>Enrolled Subjects</strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {selectedUser.courses ? Object.keys(selectedUser.courses).filter(c => c !== "_name" && c !== "_email").map(c => (
                    <span key={c} style={{ background: "var(--bg)", padding: "2px 8px", borderRadius: 4, fontSize: 12, border: "1px solid var(--border)", color: "var(--text)" }}>{c}</span>
                  )) : <span style={{ fontSize: 12, color: "var(--muted)" }}>No subjects enrolled.</span>}
                </div>
              </div>
              
              <div>
                 <strong style={{ color: "var(--muted)", fontSize: 12, display: "block", textTransform: "uppercase", marginBottom: 4 }}>Admin Notes</strong>
                 <textarea 
                    className="admin-input" 
                    placeholder="Private notes about this user..."
                    value={flags.adminNotes?.[selectedUser.user_id] || ""}
                    onChange={e => {
                       const val = e.target.value;
                       setFlags({
                          ...flags, 
                          adminNotes: { ...(flags.adminNotes || {}), [selectedUser.user_id]: val }
                       });
                    }}
                    style={{ width: "100%", minHeight: 60, padding: 8, fontSize: 12 }}
                 />
              </div>

              <div>
                 <strong style={{ color: "var(--muted)", fontSize: 12, display: "block", textTransform: "uppercase", marginBottom: 4 }}>Recent Activity</strong>
                 <div style={{ maxHeight: 120, overflowY: "auto", fontSize: 11, background: "var(--bg)", padding: 8, borderRadius: 8, border: "1px solid var(--border)" }}>
                    {auditLogs.filter(l => l.details?.target_user === selectedUser.user_id).length > 0 ? (
                       auditLogs.filter(l => l.details?.target_user === selectedUser.user_id).map(l => (
                          <div key={l.id} style={{ marginBottom: 4, borderBottom: "1px solid var(--border)", paddingBottom: 4 }}>
                             <span style={{ color: "var(--muted)" }}>{new Date(l.created_at).toLocaleDateString()}</span> - {l.action}
                          </div>
                       ))
                    ) : (
                       <div style={{ color: "var(--muted)" }}>No recent admin actions recorded.</div>
                    )}
                 </div>
              </div>

              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
                <button onClick={async () => {
                  if (flags.adminRoles && flags.adminRoles[admin_id] === "monitor") return alert("You don't have permission to reset user setups.");
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

      {/* Live Editor Modal — uses controlled React state, no document.getElementById */}
      {liveEditorModal && (
        <>
          <div className="notif-backdrop" onClick={() => setLiveEditorModal(null)} style={{ zIndex: 10000 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "var(--card)", padding: 24, borderRadius: 16, width: "90%", maxWidth: 400, maxHeight: "85vh", overflowY: "auto", zIndex: 10001, border: "1px solid var(--border)", boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, display: "flex", gap: 8, alignItems: "center" }}><CalendarDays size={18} color="var(--blue)" /> Edit Class</h2>
              <button onClick={() => setLiveEditorModal(null)} style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer" }}><XCircle size={18} /></button>
            </div>

            <div style={{ marginBottom: 16 }}>
              {modalIsNew ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className="admin-field">
                    <label>Course Code</label>
                    <input type="text" className="admin-input" value={modalCode} onChange={e => setModalCode(e.target.value)} placeholder="e.g. WAI" />
                  </div>
                  <div className="admin-field">
                    <label>Title</label>
                    <input type="text" className="admin-input" value={modalName} onChange={e => setModalName(e.target.value)} placeholder="e.g. WAI End Term" />
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontWeight: 700, color: "var(--text)" }}>{liveEditorModal.code} — {liveEditorModal.name || "Class"}</div>
                  <div style={{ color: "var(--muted)", fontSize: 13 }}>{liveEditorModal.date} | {liveEditorModal.start} – {liveEditorModal.end} | Section {liveEditorModal.section}</div>
                </>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Section selector */}
              <div className="admin-field">
                <label>Apply to Section</label>
                <select className="admin-input" value={modalSection} onChange={e => setModalSection(e.target.value)}>
                  <option value="All">All Sections</option>
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                </select>
              </div>

              {/* Cancel button */}
              <button onClick={() => {
                const overrideKey = modalSection === "All" ? liveEditorModal.code : `${liveEditorModal.code}_${modalSection}`;
                const nextOverrides = { ...(flags.classOverrides || {}) };
                nextOverrides[liveEditorModal.date] = { ...(nextOverrides[liveEditorModal.date] || {}) };
                nextOverrides[liveEditorModal.date][overrideKey] = { type: "cancelled", name: `Cancelled: ${overrideKey}` };
                setFlags({ ...flags, classOverrides: nextOverrides });
                logAdminAction(admin_id, "cancel_class", { date: liveEditorModal.date, class: overrideKey });
                setLiveEditorModal(null);
              }} className="admin-btn outline" style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>
                <Ban size={16} /> Cancel Class
              </button>

              {/* Mark as Exam toggle */}
              {(() => {
                const overrideKey = modalSection === "All" ? liveEditorModal.code : `${liveEditorModal.code}_${modalSection}`;
                const existing = flags.classOverrides?.[liveEditorModal.date]?.[overrideKey];
                const isExamOverride = existing?.type === "exam";
                return (
                  <button onClick={() => {
                    const nextOverrides = { ...(flags.classOverrides || {}) };
                    nextOverrides[liveEditorModal.date] = { ...(nextOverrides[liveEditorModal.date] || {}) };
                    if (isExamOverride) {
                      // Remove only the exam type flag, keep other overrides intact
                      const rest = { ...existing };
                      delete rest.type;
                      if (Object.keys(rest).length === 0) {
                        delete nextOverrides[liveEditorModal.date][overrideKey];
                        if (Object.keys(nextOverrides[liveEditorModal.date]).length === 0) delete nextOverrides[liveEditorModal.date];
                      } else {
                        nextOverrides[liveEditorModal.date][overrideKey] = rest;
                      }
                      logAdminAction(admin_id, "clear_exam_flag", { date: liveEditorModal.date, class: overrideKey });
                    } else {
                      nextOverrides[liveEditorModal.date][overrideKey] = { ...existing, type: "exam" };
                      logAdminAction(admin_id, "mark_as_exam", { date: liveEditorModal.date, class: overrideKey });
                    }
                    setFlags({ ...flags, classOverrides: nextOverrides });
                    setLiveEditorModal(null);
                  }} className="admin-btn outline" style={{ color: isExamOverride ? "var(--warning)" : "var(--violet)", borderColor: isExamOverride ? "var(--warning)" : "var(--violet)" }}>
                    <GraduationCap size={16} /> {isExamOverride ? "Remove Exam Flag" : "Mark as Exam"}
                  </button>
                );
              })()}

              {/* Time range */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div className="admin-field" style={{ flex: 1 }}>
                  <label>New Start</label>
                  <input type="time" className="admin-input" value={modalStart} onChange={e => setModalStart(e.target.value)} />
                </div>
                <span style={{ color: "var(--muted)", marginTop: 22 }}>–</span>
                <div className="admin-field" style={{ flex: 1 }}>
                  <label>New End</label>
                  <input type="time" className="admin-input" value={modalEnd} onChange={e => setModalEnd(e.target.value)} />
                </div>
              </div>

              {/* Room + Save */}
              <div className="admin-field">
                <label>New Room</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="text" placeholder="e.g. C-104" className="admin-input" style={{ flex: 1 }} value={modalRoom} onChange={e => setModalRoom(e.target.value)} />
                  <button onClick={() => {
                    const codeToUse = modalIsNew ? modalCode : liveEditorModal.code;
                    if (modalIsNew && !codeToUse) return alert("Course Code is required.");
                    const overrideKey = modalSection === "All" ? codeToUse : `${codeToUse}_${modalSection}`;
                    const nextOverrides = { ...(flags.classOverrides || {}) };
                    nextOverrides[liveEditorModal.date] = { ...(nextOverrides[liveEditorModal.date] || {}) };
                    const existing = nextOverrides[liveEditorModal.date][overrideKey] || {};
                    const changes = { ...existing };
                    if (modalRoom)  changes.room  = modalRoom;
                    if (modalStart) changes.start = modalStart;
                    if (modalEnd)   changes.end   = modalEnd;
                    if (modalIsNew) {
                      changes.name = modalName;
                      changes.type = "class"; // base type, can be marked as exam later
                    } else {
                      if (!modalRoom && !modalStart && !modalEnd) return alert("Enter at least one change (room, start, or end time).");
                    }
                    nextOverrides[liveEditorModal.date][overrideKey] = changes;
                    setFlags({ ...flags, classOverrides: nextOverrides });
                    logAdminAction(admin_id, "edit_class", { date: liveEditorModal.date, class: overrideKey, room: modalRoom, start: modalStart, end: modalEnd, name: modalName });
                    setLiveEditorModal(null);
                  }} className="admin-btn primary">Save</button>
                </div>
              </div>

              {/* Remove existing override */}
              {(flags.classOverrides?.[liveEditorModal.date]?.[liveEditorModal.code] || flags.classOverrides?.[liveEditorModal.date]?.[`${liveEditorModal.code}_${liveEditorModal.section}`]) && (
                <button onClick={() => {
                  const nextOverrides = { ...(flags.classOverrides || {}) };
                  nextOverrides[liveEditorModal.date] = { ...nextOverrides[liveEditorModal.date] };
                  delete nextOverrides[liveEditorModal.date][liveEditorModal.code];
                  delete nextOverrides[liveEditorModal.date][`${liveEditorModal.code}_${liveEditorModal.section}`];
                  if (Object.keys(nextOverrides[liveEditorModal.date]).length === 0) delete nextOverrides[liveEditorModal.date];
                  setFlags({ ...flags, classOverrides: nextOverrides });
                  logAdminAction(admin_id, "clear_override", { date: liveEditorModal.date, class: liveEditorModal.code });
                  setLiveEditorModal(null);
                }} className="admin-btn outline" style={{ marginTop: 4 }}>
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

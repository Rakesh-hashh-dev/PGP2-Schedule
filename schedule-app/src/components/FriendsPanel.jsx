import { useState, useEffect } from "react";
import "../styles/friends.css";
import { Copy, Link2, UserPlus, Users, Trash2, ArrowRight, Plus, X, Check, ChevronDown, ChevronUp, ChevronRight, RefreshCw, Globe, Lock, CheckCircle, AlertCircle, Info, AlertTriangle, Star, CalendarOff } from "lucide-react";
import { SkeletonText } from "./ui.jsx";

import {
  decodeSchedule, codeDisplayPart, buildShareUrl,
  saveFriend, removeFriend as removeFriendFromStore, updateFriend, writeFriends,
  loadGroups, createGroup, removeGroup as removeGroupFromStore, updateGroup,
  getOrCreateShareCode, pushFriendsToCloud, pushGroupsToCloud,
  refreshFriendCoursesFromCloud, sendFriendPing, hasPendingFriendRequest, deletePingsBetween,
  shareGroupWithMembers, unshareGroupFromMembers,
  sendGroupChatMessage, fetchGroupChatMessages,
  avatarGradient,
} from "../lib/friends.js";

// profiles still holds pre-cutover DEV ghost rows (the data source for
// migrate-user's on-login restore) — exclude them wherever we list students,
// same as AdminDashboard. Once Phase 2 deletes the ghosts and drops the RPC,
// this resolves to an empty set and the filter is a no-op.
let devGhostIdsPromise = null;
function fetchDevGhostIds(supabase) {
  if (!devGhostIdsPromise) {
    devGhostIdsPromise = (async () => {
      try {
        const { data } = await supabase.rpc("get_dev_user_ids");
        return new Set((data || []).map(r => (typeof r === "string" ? r : r.dev_user_id)));
      } catch {
        return new Set();
      }
    })();
  }
  return devGhostIdsPromise;
}

const TOAST_META = {
  success: { Icon: CheckCircle, color: "#1FA971" },
  error:   { Icon: AlertCircle, color: "#e74c3c" },
  info:    { Icon: Info,        color: "#6D5BD0" },
  warning: { Icon: AlertTriangle, color: "#C9882B" },
};

function Toast({ message, type = "info", action, onDone }) {
  const { Icon, color } = TOAST_META[type] || TOAST_META.info;
  return (
    <div className={`fr-toast fr-toast-${type}`} onAnimationEnd={e => e.animationName === "toast-out" && onDone?.()}>
      <Icon size={15} style={{ color, flex: "none" }} />
      <span className="fr-toast-text">{message}</span>
      {action && (
        <button className="fr-toast-action" onClick={() => { action.onClick(); onDone?.(); }}>
          {action.label}
        </button>
      )}
    </div>
  );
}

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableFriendItem({ f, renderFriendCard, isCompact }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: f.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : 1, position: 'relative' };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {renderFriendCard(f, isCompact)}
    </div>
  );
}

function FriendSkeleton() {
  return (
    <div className="fr-friend-card fr-sk-card">
      <div className="fr-sk-avatar sk-shimmer" />
      <div className="fr-sk-info">
        <div className="sk-shimmer" style={{ height: 14, width: "55%", borderRadius: 6 }} />
        <div className="sk-shimmer" style={{ height: 11, width: "35%", borderRadius: 5, marginTop: 6 }} />
      </div>
      <div className="fr-sk-actions">
        <div className="sk-shimmer" style={{ height: 32, width: 84, borderRadius: 10 }} />
      </div>
    </div>
  );
}

function GroupChat({ group, userId, userName }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let channel;
    async function load() {
      setLoading(true);
      // Phase 3: read from group_messages (not friend_pings)
      const msgs = await fetchGroupChatMessages(group.id);
      setMessages(msgs);
      setLoading(false);

      const { supabase } = await import("../lib/supabase.js");
      // Phase 3: subscribe to group_messages INSERTs
      channel = supabase.channel(`group-chat-${group.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${group.id}` }, payload => {
          const p = payload.new;
          setMessages(prev => {
            if (prev.some(m => m.id === p.id)) return prev;
            return [...prev, {
              id: p.id,
              from_id: p.from_id,
              name: p.from_name || "Someone",
              text: p.text || "",
              created_at: p.created_at
            }];
          });
        })
        .subscribe();
    }
    load();
    return () => { if (channel) channel.unsubscribe(); };
  }, [group.id]);

  async function handleSend(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const txt = text.trim();
    setText("");
    // Phase 3: write to group_messages (not friend_pings)
    await sendGroupChatMessage(group.id, userId, userName, txt);
  }

  return (
    <div className="fr-chat-box" style={{ marginTop: 16 }}>
      <p className="fr-group-body-label">Group Chat</p>
      <div className="fr-chat-msgs" style={{ maxHeight: 250, overflowY: "auto", padding: "12px", background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.05)", borderRadius: 12, marginBottom: 8, display: "flex", flexDirection: "column" }}>
         {loading ? <SkeletonText lines={3} /> : messages.length === 0 ? <div className="fr-empty">No messages yet. Say hi!</div> : messages.map(m => (
            <div key={m.id} style={{ display: "flex", gap: 8, marginBottom: 12, flexDirection: m.from_id === userId ? "row-reverse" : "row" }}>
               <div className="fr-group-avatar-dot" style={{ background: avatarGradient(m.name)[0], flexShrink: 0 }}>{m.name[0]?.toUpperCase()}</div>
               <div style={{ background: m.from_id === userId ? "var(--live)" : "#fff", color: m.from_id === userId ? "#fff" : "#000", padding: "8px 12px", borderRadius: 12, fontSize: 13, maxWidth: "85%", wordBreak: "break-word", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                  {m.from_id !== userId && <div style={{ fontSize: 10, opacity: 0.5, marginBottom: 4, fontWeight: 700 }}>{m.name}</div>}
                  {m.text}
               </div>
            </div>
         ))}
      </div>
      <form onSubmit={handleSend} style={{ display: "flex", gap: 6 }}>
         <input type="text" className="fr-add-input" placeholder="Message group..." value={text} onChange={e => setText(e.target.value)} style={{ flex: 1, padding: "8px 14px", borderRadius: 20, border: "1px solid rgba(0,0,0,0.1)", background: "#fff", fontSize: 13 }} />
         <button type="submit" className="fr-btn fr-btn-primary" style={{ borderRadius: 20, padding: "0 16px" }}>Send</button>
      </form>
    </div>
  );
}

function toMinFP(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function ymdFP(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
export default function FriendsPanel({
  userId, userName, enrolled, friends, setFriends,
  groups, setGroups, allClasses, now, onCompare, onGroupCompare, onOpenLeave,
}) {
  const [addCode, setAddCode] = useState("");
  const [addError, setAddError] = useState("");
  const [toast, setToast] = useState(null); // { message, type, action? }
  const [pendingDelete, setPendingDelete] = useState(null); // { id, timeoutId }
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState(null);

  const [myCode, setMyCode] = useState(null);
  const isGenerating = !!userId && !myCode; // code still being fetched/created
  const [isAdding, setIsAdding] = useState(false);
  const [syncingFriendId, setSyncingFriendId] = useState(null);
  const [sharingGroupId, setSharingGroupId] = useState(null);
  // Show skeleton only when no local friends and still might be syncing from cloud
  const [initialLoading, setInitialLoading] = useState(friends.length === 0);
  if (initialLoading && friends.length > 0) setInitialLoading(false);
  useEffect(() => {
    if (friends.length > 0) return;
    const t = setTimeout(() => setInitialLoading(false), 1400);
    return () => clearTimeout(t);
  }, [friends.length]);

  const [suggestedBuddiesRaw, setSuggestedBuddies] = useState(null);
  const [optOutMatchmaker, setOptOutMatchmaker] = useState(() => {
    try { return localStorage.getItem("pgp2.opt-out-matchmaker") === "true"; } catch { return false; }
  });

  const toggleOptOut = () => {
    setOptOutMatchmaker(prev => {
      const next = !prev;
      try { localStorage.setItem("pgp2.opt-out-matchmaker", next ? "true" : "false"); } catch {}
      if (userId) {
        import("../lib/supabase.js").then(({ supabase }) => {
          supabase.from("profiles").select("courses").eq("user_id", userId).single().then(({data}) => {
             if (data?.courses) {
                const updatedCourses = { ...data.courses, _hide_from_matchmaker: next };
                supabase.from("profiles").update({ courses: updatedCourses }).eq("user_id", userId).then();
             }
          });
        });
      }
      return next;
    });
  };

  // Matchmaker results only apply while eligible — derived, not reset via effect
  const suggestedBuddies = (!userId || !enrolled || optOutMatchmaker) ? [] : suggestedBuddiesRaw;

  useEffect(() => {
    if (!userId || !enrolled || optOutMatchmaker) return;
    
    async function fetchMatches() {
      const myCourseKeys = Object.keys(enrolled).filter(k => !k.startsWith("_"));
      if (myCourseKeys.length === 0) {
        setSuggestedBuddies([]);
        return;
      }
      
      const { supabase } = await import("../lib/supabase.js");
      // No `name` column exists on profiles — display names live in courses._name
      const [{ data, error }, devGhostIds] = await Promise.all([
        supabase.from("profiles").select("user_id, courses").neq("user_id", userId),
        fetchDevGhostIds(supabase),
      ]);

      if (error || !data) {
        if (error) console.error("[matchmaker] fetch failed:", error.message);
        return;
      }

      const friendCloudIds = new Set(friends.map(f => f.cloudId).filter(Boolean));

      const matches = data.map(profile => {
        if (devGhostIds.has(profile.user_id)) return null; // Pre-cutover dev ghost row
        if (friendCloudIds.has(profile.user_id)) return null; // Already friends
        if (profile.courses?._hide_from_matchmaker) return null; // Opted out

        const theirCourses = Object.keys(profile.courses || {}).filter(k => !k.startsWith("_"));
        if (theirCourses.length === 0) return null;

        const intersection = myCourseKeys.filter(c => theirCourses.includes(c)).length;
        const union = new Set([...myCourseKeys, ...theirCourses]).size;
        const score = union === 0 ? 0 : Math.round((intersection / union) * 100);

        if (score >= 40) {
           return { user_id: profile.user_id, name: profile.courses?._name || "Student", score };
        }
        return null;
      }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 12);
      
      setSuggestedBuddies(matches);
    }
    
    fetchMatches();
  }, [userId, enrolled, friends, optOutMatchmaker]);

  const showToast = (message, type = "success", action = null) => setToast({ message, type, action });

  useEffect(() => {
    if (!userId) return;
    getOrCreateShareCode(userId, userName || "User").then(setMyCode);
  }, [userId, userName]);

  useEffect(() => {
    if (!friends.length) return;
    refreshFriendCoursesFromCloud(friends).then(updated => {
      if (updated) {
        setFriends(updated);
        pushFriendsToCloud(userId, updated);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const myCodeDisplay = codeDisplayPart(myCode);

  // In-app browsers (WhatsApp, Instagram, LinkedIn) often lack or block
  // navigator.clipboard — fall back to the legacy textarea + execCommand path.
  async function copyText(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch { /* fall through to legacy path */ }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { }
    ta.remove();
    return ok;
  }

  async function copyCode() {
    if (!myCode) return;
    const ok = await copyText(myCode);
    showToast(ok ? "Code copied!" : "Failed to copy", ok ? "success" : "error");
  }

  async function copyLink() {
    if (!myCode) return;
    const ok = await copyText(buildShareUrl(myCode));
    showToast(ok ? "Link copied!" : "Failed to copy", ok ? "success" : "error");
  }

  // codeOverride lets other UI (e.g. the group builder) reuse this flow with its
  // own input. Guarded by typeof because onClick passes an event object.
  // Returns true when the request/add succeeded.
  async function handleAddFriend(codeOverride) {
    setAddError("");
    let input = (typeof codeOverride === "string" ? codeOverride : addCode).trim();
    if (!input) return false;

    if (input.startsWith("http")) {
      try {
        const url = new URL(input);
        const fParam = url.searchParams.get("f");
        if (fParam) input = fParam;
      } catch (e) { }
    }

    setIsAdding(true);
    const decoded = await decodeSchedule(input);
    setIsAdding(false);

    if (!decoded) {
      setAddError("Invalid link or code. Ask your friend to share their invite link again.");
      return false;
    }

    if (decoded.id && friends.some(f => f.cloudId === decoded.id)) {
      setAddError("You're already friends with this person.");
      return false;
    }

    if (decoded.id && myCode) {
      const alreadySent = await hasPendingFriendRequest(userId, decoded.id);
      if (alreadySent) {
        setAddError(`Request already sent to ${decoded.name}. Waiting for them to accept.`);
        setIsAdding(false);
        return false;
      }
      // Cloud user: send a friend request — they must accept before either side is added
      await sendFriendPing(decoded.id, userId, userName, { type: "friend_request", fromCode: myCode });
      setAddCode("");
      showToast(`Friend request sent to ${decoded.name}!`, "success");
      return true;
    } else {
      // Local/offline code: no request flow possible, add immediately
      const updated = saveFriend(decoded.name, decoded.courses, decoded.id);
      setFriends(updated);
      pushFriendsToCloud(userId, updated);
      setAddCode("");
      showToast(`Added ${decoded.name}!`, "success");
      if (decoded.id) sendFriendPing(decoded.id, userId, userName);
      return true;
    }
  }

  function handleRemoveFriend(id) {
    const friend = friends.find(f => f.id === id);
    const updated = removeFriendFromStore(id);
    setFriends(updated);
    pushFriendsToCloud(userId, updated);
    if (friend?.cloudId) {
      deletePingsBetween(userId, friend.cloudId).then(() => {
        sendFriendPing(friend.cloudId, userId, userName, { type: "friend_removed" });
      });
    }
  }

  function handleToggleFavourite(e, f) {
    e.stopPropagation();
    const updated = updateFriend(f.id, { isFavourite: !f.isFavourite });
    setFriends(updated);
    pushFriendsToCloud(userId, updated);
  }

  async function handleRefreshFriend(id) {
    setSyncingFriendId(id);
    // "all" refreshes every cloud friend; a specific id refreshes just that friend
    const only = id === "all"
      ? null
      : [friends.find(f => f.id === id)?.cloudId].filter(Boolean);
    const updated = await refreshFriendCoursesFromCloud(friends, only);
    setSyncingFriendId(null);
    if (updated) {
      setFriends(updated);
      pushFriendsToCloud(userId, updated);
      showToast("Schedule refreshed!", "success");
    } else {
      showToast("Already up to date", "info");
    }
  }

  function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    const updated = createGroup(newGroupName.trim());
    setGroups(updated);
    pushGroupsToCloud(userId, updated);
    setNewGroupName("");
    setShowNewGroup(false);
    showToast("Group created! Add friends and they'll see it automatically.", "success");
  }

  async function handleRemoveGroup(id, isReceived = false) {
    const group = groups.find(g => g.id === id);
    if (!group) return;

    // Cancel any existing pending delete first
    if (pendingDelete) clearTimeout(pendingDelete.timeoutId);

    // Optimistic hide — don't touch localStorage yet
    setGroups(prev => prev.filter(g => g.id !== id));
    setExpandedGroup(prev => prev === id ? null : prev);

    const commitDelete = async () => {
      const updated = removeGroupFromStore(id);
      pushGroupsToCloud(userId, updated);
      if (!isReceived && (group.visibility === "shared" || group.visibility === "global") && group.cloudMemberIds?.length) {
        await unshareGroupFromMembers(id, group.cloudMemberIds, userId);
      }
      setPendingDelete(null);
    };

    const timeoutId = setTimeout(commitDelete, 8000);
    setPendingDelete({ id, timeoutId });

    showToast(isReceived ? "Left group" : "Group deleted", "info", {
      label: "Undo",
      onClick: () => {
        clearTimeout(timeoutId);
        setPendingDelete(null);
        setGroups(loadGroups()); // restore from localStorage (not yet deleted)
      },
    });
  }

  async function handleToggleFriendInGroup(groupId, friendId) {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const members = group.memberIds || [];
    const next = members.includes(friendId)
      ? members.filter(m => m !== friendId)
      : [...members, friendId];
    let updated = updateGroup(groupId, { memberIds: next });
    setGroups(updated);

    if (group.visibility === "shared" || group.visibility === "global") {
      await unshareGroupFromMembers(groupId, group.cloudMemberIds, userId);
      const updatedGroup = updated.find(g => g.id === groupId);
      const targetFriends = group.visibility === "global"
        ? friends
        : friends.filter(f => (updatedGroup.memberIds || []).includes(f.id));
      const { cloudMemberIds } = await shareGroupWithMembers(userId, userName, updatedGroup, targetFriends);
      updated = updateGroup(groupId, { cloudMemberIds });
      setGroups(updated);
    }
    pushGroupsToCloud(userId, updated);
  }

  async function handleSetGroupPrivacy(group, newPrivacy) {
    const oldPrivacy = group.visibility || "private";
    if (oldPrivacy === newPrivacy) return;

    // Optimistic: update local state immediately so the UI feels instant
    const optimistic = updateGroup(group.id, { visibility: newPrivacy });
    setGroups(optimistic);
    setSharingGroupId(group.id);

    if ((oldPrivacy === "shared" || oldPrivacy === "global") && group.cloudMemberIds?.length) {
      await unshareGroupFromMembers(group.id, group.cloudMemberIds, userId);
    }

    if (newPrivacy === "private") {
      const updated = updateGroup(group.id, { visibility: "private", cloudMemberIds: [] });
      setGroups(updated);
      pushGroupsToCloud(userId, updated);
      showToast("Group is now private", "info");
    } else if (newPrivacy === "shared") {
      const targetFriends = friends.filter(f => (group.memberIds || []).includes(f.id));
      const cloudCount = targetFriends.filter(f => f.cloudId).length;
      if (!cloudCount) {
        showToast("No group members have accounts yet", "warning");
        // Revert optimistic since we can't actually share
        const reverted = updateGroup(group.id, { visibility: oldPrivacy });
        setGroups(reverted);
        setSharingGroupId(null);
        return;
      }
      const { cloudMemberIds } = await shareGroupWithMembers(userId, userName, group, targetFriends);
      const updated = updateGroup(group.id, { visibility: "shared", cloudMemberIds });
      setGroups(updated);
      pushGroupsToCloud(userId, updated);
      showToast(`Visible to ${cloudCount} member${cloudCount !== 1 ? "s" : ""}`, "success");
    } else if (newPrivacy === "global") {
      const cloudCount = friends.filter(f => f.cloudId).length;
      if (!cloudCount) {
        showToast("None of your friends have accounts yet", "warning");
        const reverted = updateGroup(group.id, { visibility: oldPrivacy });
        setGroups(reverted);
        setSharingGroupId(null);
        return;
      }
      const { cloudMemberIds } = await shareGroupWithMembers(userId, userName, group, friends);
      const updated = updateGroup(group.id, { visibility: "global", cloudMemberIds });
      setGroups(updated);
      pushGroupsToCloud(userId, updated);
      showToast(`Shared with all ${cloudCount} friend${cloudCount !== 1 ? "s" : ""}`, "success");
    }
    setSharingGroupId(null);
  }

  const courseCount = enrolled ? Object.keys(enrolled).length : 0;

  function getFriendStatusNow(friend) {
    if (!allClasses || !now) return null;
    const todayISO = ymdFP(now);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const inClass = allClasses.some(c => {
      if (c.date !== todayISO || (c.type !== "class" && c.type !== "exam") || !c.code) return false;
      const sec = friend.courses?.[c.code];
      return sec !== undefined && (c.section === "Single" || c.section === sec) &&
        toMinFP(c.start) <= nowMin && nowMin < toMinFP(c.end);
    });
    return inClass ? "busy" : "free";
  }

  const sortedFriends = [...friends].sort((a, b) => {
    if (a.isFavourite !== b.isFavourite) return a.isFavourite ? -1 : 1;
    if (a.isFavourite && b.isFavourite) {
      const aOrder = a.favOrder !== undefined ? a.favOrder : 9999;
      const bOrder = b.favOrder !== undefined ? b.favOrder : 9999;
      if (aOrder !== bOrder) return aOrder - bOrder;
    }
    return a.name.localeCompare(b.name);
  });
  const visibleFriends = sortedFriends.slice(0, 4);

  const [showAllFriendsModal, setShowAllFriendsModal] = useState(false);
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [showAllGroupsModal, setShowAllGroupsModal] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [showAllBuddiesModal, setShowAllBuddiesModal] = useState(false);

  // Student directory ("find people") modal — lists everyone using the app
  const [showDirectory, setShowDirectory] = useState(false);
  const [directory, setDirectory] = useState(null); // null = not fetched yet
  const [dirSearch, setDirSearch] = useState("");
  const [requestedIds, setRequestedIds] = useState(() => new Set());

  useEffect(() => {
    const isModalOpen = showAllFriendsModal || showAllGroupsModal || showAllBuddiesModal || showDirectory;
    if (isModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showAllFriendsModal, showAllGroupsModal, showAllBuddiesModal, showDirectory]);

  async function openDirectory() {
    setShowDirectory(true);
    if (directory !== null) return; // fetched once per visit
    const { supabase } = await import("../lib/supabase.js");
    const [{ data, error }, devGhostIds] = await Promise.all([
      supabase.from("profiles").select("user_id, courses").neq("user_id", userId),
      fetchDevGhostIds(supabase),
    ]);
    if (error || !data) {
      setDirectory([]);
      showToast("Couldn't load students", "error");
      return;
    }
    const myCourseKeys = Object.keys(enrolled || {}).filter(k => !k.startsWith("_"));
    const list = data
      .filter(p => !devGhostIds.has(p.user_id)) // pre-cutover dev ghost rows
      .filter(p => !p.courses?._hide_from_matchmaker) // respect discovery opt-out
      .map(p => {
        const theirs = Object.keys(p.courses || {}).filter(k => !k.startsWith("_"));
        if (!p.courses?._name && theirs.length === 0) return null; // skip empty shell profiles
        return {
          user_id: p.user_id,
          name: p.courses?._name || "Student",
          shared: myCourseKeys.filter(c => theirs.includes(c)).length,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.shared - a.shared || a.name.localeCompare(b.name));
    setDirectory(list);
  }

  async function handleDirectoryAdd(person) {
    if (!myCode) { showToast("Wait for code generation", "info"); return; }
    const alreadySent = await hasPendingFriendRequest(userId, person.user_id);
    if (alreadySent) {
      setRequestedIds(prev => new Set([...prev, person.user_id]));
      showToast("Request already sent", "info");
      return;
    }
    await sendFriendPing(person.user_id, userId, userName, { type: "friend_request", fromCode: myCode });
    setRequestedIds(prev => new Set([...prev, person.user_id]));
    showToast(`Request sent to ${person.name}!`, "success");
  }

  // Manual "add friends to a group" builder inside the Study Buddies section
  const [manualGroupOpen, setManualGroupOpen] = useState(false);
  const [manualGroupId, setManualGroupId] = useState(null);
  const [manualNewName, setManualNewName] = useState("");
  const [manualAddCode, setManualAddCode] = useState("");

  async function handleManualAddFriend() {
    const ok = await handleAddFriend(manualAddCode);
    if (ok) setManualAddCode("");
  }

  function handleManualCreateGroup() {
    if (!manualNewName.trim()) return;
    const updated = createGroup(manualNewName.trim());
    setGroups(updated);
    pushGroupsToCloud(userId, updated);
    setManualGroupId(updated[updated.length - 1].id);
    setManualNewName("");
    showToast("Group created", "success");
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const activeIdx = friends.findIndex(f => f.id === active.id);
      const overIdx = friends.findIndex(f => f.id === over.id);
      if (activeIdx !== -1 && overIdx !== -1) {
        const sortedFavs = sortedFriends.filter(f => f.isFavourite);
        const oldIndex = sortedFavs.findIndex(f => f.id === active.id);
        const newIndex = sortedFavs.findIndex(f => f.id === over.id);
        const newFavs = arrayMove(sortedFavs, oldIndex, newIndex);
        
        const updated = friends.map(f => {
          if (f.isFavourite) {
            const index = newFavs.findIndex(nf => nf.id === f.id);
            return { ...f, favOrder: index };
          }
          return f;
        });
        
        writeFriends(updated);
        setFriends(updated);
        pushFriendsToCloud(userId, updated);
      }
    }
  };

  const renderFriendCard = (f, isCompact = false) => {
    const fCourseCount = Object.keys(f.courses || {}).length;
    const [c1, c2] = avatarGradient(f.name);
    const status = getFriendStatusNow(f);
    return (
      <div key={f.id} className={`fr-friend-card ${isCompact ? "compact" : ""} ${f.isFavourite && !isCompact ? "favourite-glow" : ""}`} style={{ '--accent': c1 }}>
        <div className="fr-friend-avatar" style={{ background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`, boxShadow: `0 4px 16px ${c1}66` }}>
          {f.name[0]?.toUpperCase()}
        </div>
        <div className="fr-friend-info">
          <span className="fr-friend-name">{f.name}</span>
          <div className="fr-friend-meta-row">
            <span className="fr-friend-meta">{fCourseCount} course{fCourseCount !== 1 ? "s" : ""}</span>
          </div>
          {status && (
            <span className={`fr-friend-status fr-friend-status-${status}`}>
              <span className="fr-friend-status-dot" />
              {status === "free" ? "Free now" : "In class"}
            </span>
          )}
        </div>
        <div className="fr-friend-actions">
          <button 
            className="fr-btn fr-btn-compare" 
            onClick={() => onCompare(f)}
            style={{
              '--btn-bg': `${c1}1A`,
              '--btn-color': c1,
              '--btn-border': `${c1}40`,
              '--btn-bg-hover': `${c1}26`,
              '--btn-border-hover': `${c1}80`
            }}
          >
            Compare <ArrowRight size={13} />
          </button>
          <div className="fr-friend-icon-group">
          <button
            className={`fr-btn fr-btn-icon ${f.isFavourite ? 'favourite-active' : ''}`}
            onClick={(e) => handleToggleFavourite(e, f)}
            aria-label={f.isFavourite ? "Remove from favourites" : "Add to favourites"}
            title={f.isFavourite ? "Remove from favourites" : "Add to favourites"}
          >
            <Star size={14} fill={f.isFavourite ? "currentColor" : "none"} style={{ color: f.isFavourite ? "#FBBF24" : "var(--muted)" }} />
          </button>
          {f.cloudId && (
            <button
              className="fr-btn fr-btn-icon"
              onClick={() => handleRefreshFriend(f.id)}
              disabled={syncingFriendId === f.id}
              aria-label="Sync friend's schedule"
              title="Sync latest schedule"
            >
              <RefreshCw size={14} className={syncingFriendId === f.id ? "spin-icon" : ""} />
            </button>
          )}
          <button className="fr-btn fr-btn-icon fr-btn-delete" onClick={() => handleRemoveFriend(f.id)} aria-label="Remove friend">
            <Trash2 size={14} />
          </button>
          </div>
        </div>
      </div>
    );
  };

  const renderGroupCard = (group, isCompact = false) => {
    const memberCount = (group.memberIds || []).length;
    const isExpanded = expandedGroup === group.id && !isCompact; // don't expand in compact mode

    const displayMembers = group.isReceived
      ? (group.cloudMemberIds || [])
          .filter(cid => cid !== userId)
          .map(cid => friends.find(f => f.cloudId === cid))
          .filter(Boolean)
      : friends.filter(f => (group.memberIds || []).includes(f.id));

    const displayCount = group.isReceived ? displayMembers.length : memberCount;

    return (
      <div key={group.id} className={`fr-group-card ${group.isReceived ? "fr-group-received" : ""} ${isCompact ? "compact" : ""}`}>
        <div className="fr-group-head" onClick={() => !isCompact && setExpandedGroup(isExpanded ? null : group.id)}>
          <div className="fr-group-info">
            <span className="fr-group-name">{group.name}</span>
            <span className="fr-group-meta">
              {group.isReceived
                ? <span className="fr-group-shared-badge"><Globe size={11} /> Shared by {group.ownerName}</span>
                : `${memberCount} member${memberCount !== 1 ? "s" : ""}`
              }
            </span>
          </div>
          {displayCount > 0 && (
            <div className="fr-group-member-preview">
              {displayMembers.slice(0, 4).map((f, fi) => {
                const [c1] = avatarGradient(f.name);
                return (
                  <div key={f.id} className="fr-group-avatar-dot" style={{ background: c1, zIndex: 10 - fi }}>
                    {f.name[0]?.toUpperCase()}
                  </div>
                );
              })}
              {displayCount > 4 && (
                <div className="fr-group-avatar-dot fr-group-avatar-more">+{displayCount - 4}</div>
              )}
            </div>
          )}
          <div className="fr-group-actions">
            {(memberCount >= 1 || group.isReceived) && (
              <button className="fr-btn fr-btn-compare" onClick={e => { e.stopPropagation(); onGroupCompare(group); }}>
                Compare <ArrowRight size={13} />
              </button>
            )}
            {!group.isReceived && !isCompact && (
              <span className={`fr-privacy-badge fr-privacy-badge-${group.visibility || "private"}`}>
                {group.visibility === "global" ? <Globe size={11} /> : group.visibility === "shared" ? <Users size={11} /> : <Lock size={11} />}
                {group.visibility === "global" ? "Global" : group.visibility === "shared" ? "Members" : "Private"}
              </span>
            )}
            {!isCompact && (isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
          </div>
        </div>
        {isExpanded && !isCompact && (
          <div className="fr-group-body">
            {group.isReceived ? (
              <>
                <p className="fr-group-body-label">Members in this group:</p>
                {displayMembers.length === 0 ? (
                  <p className="fr-empty">Add the group members as friends to see them here.</p>
                ) : (
                  <div className="fr-group-members">
                    {displayMembers.map(f => (
                      <div key={f.id} className="fr-member-chip in" style={{ cursor: "default" }}>
                        <span className="fr-member-initial">{f.name[0]}</span>
                        {f.name}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
                  {confirmDeleteId === group.id ? (
                    <div className="fr-confirm-row" onClick={e => e.stopPropagation()}>
                      <span className="fr-confirm-label">Leave group?</span>
                      <button className="fr-btn fr-btn-danger fr-btn-small" onClick={() => { setConfirmDeleteId(null); handleRemoveGroup(group.id, true); }}>Yes</button>
                      <button className="fr-btn fr-btn-small" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button className="fr-btn fr-btn-danger fr-btn-small" onClick={e => { e.stopPropagation(); setConfirmDeleteId(group.id); }}>
                      <X size={14} /> Leave group
                    </button>
                  )}
                </div>
                
                <GroupChat group={group} userId={userId} userName={userName} />
              </>
            ) : (
              <>
                <div className="fr-privacy-row">
                  <span className="fr-privacy-label">Privacy</span>
                  <div className="fr-privacy-picker">
                    {[
                      { key: "private", Icon: Lock,  label: "Private",  desc: "Only you" },
                      { key: "shared",  Icon: Users, label: "Members",  desc: "Group members" },
                      { key: "global",  Icon: Globe, label: "Global",   desc: "All friends" },
                    ].map(({ key, Icon, label, desc }) => (
                      <button
                        key={key}
                        className={`fr-privacy-opt fr-privacy-opt-${key} ${(group.visibility || "private") === key ? "on" : ""}`}
                        onClick={() => handleSetGroupPrivacy(group, key)}
                        disabled={sharingGroupId === group.id}
                        title={desc}
                      >
                        {sharingGroupId === group.id && (group.visibility || "private") !== key
                          ? <RefreshCw size={12} className="spin-icon" />
                          : <Icon size={12} />
                        }
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="fr-group-body-label">Tap friends to add/remove from this group:</p>
                {friends.length === 0 ? (
                  <div className="fr-empty-inline">
                    <UserPlus size={18} strokeWidth={1.5} />
                    <span>Add friends first, then build your group.</span>
                  </div>
                ) : (
                  <div className="fr-group-members">
                    {friends.map(f => {
                      const inGroup = (group.memberIds || []).includes(f.id);
                      return (
                        <button
                          key={f.id}
                          className={`fr-member-chip ${inGroup ? "in" : ""}`}
                          onClick={() => handleToggleFriendInGroup(group.id, f.id)}
                        >
                          <span className="fr-member-initial">{f.name[0]}</span>
                          {f.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                  <button className="fr-btn fr-btn-primary" style={{ padding: "6px 12px", fontSize: 12 }} onClick={e => { e.stopPropagation(); setExpandedGroup(null); showToast("Changes saved", "success"); }}>
                    <Check size={13} strokeWidth={2.8} /> Done
                  </button>
                  {confirmDeleteId === group.id ? (
                    <div className="fr-confirm-row" onClick={e => e.stopPropagation()}>
                      <span className="fr-confirm-label">Delete group?</span>
                      <button className="fr-btn fr-btn-danger fr-btn-small" onClick={() => { setConfirmDeleteId(null); handleRemoveGroup(group.id); }}>Yes</button>
                      <button className="fr-btn fr-btn-small" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button className="fr-btn fr-btn-danger fr-btn-small" onClick={e => { e.stopPropagation(); setConfirmDeleteId(group.id); }}>
                      <Trash2 size={14} /> Delete group
                    </button>
                  )}
                </div>
                
                {(group.visibility === "shared" || group.visibility === "global") && (
                  <GroupChat group={group} userId={userId} userName={userName} />
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderBuddyCard = (match, isCompact = false) => {
    const [c1, c2] = avatarGradient(match.name);
    const score = match.score || 0;
    const compatLabel = score >= 70 ? "Excellent compatibility"
                      : score >= 55 ? "Good compatibility"
                      : score >= 35 ? "Moderate compatibility"
                      : "Low compatibility";
    return (
      <div key={match.user_id} className={`fr-friend-card fr-buddy ${isCompact ? "compact" : ""}`}
        style={{ '--buddy-c1': c1, '--buddy-c2': c2 }}>
        <div className="fr-buddy-avatar-wrap">
          <div className="fr-friend-avatar" style={{ background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)` }}>
            {match.name[0]?.toUpperCase() || "?"}
          </div>
          <span className="fr-buddy-dot" style={{ background: c1 }} />
        </div>
        <div className="fr-friend-info">
          <div className="fr-buddy-header">
            <span className="fr-friend-name">{match.name || "Student"}</span>
            <span className="fr-buddy-match">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                <polyline points="17 6 23 6 23 12"/>
              </svg>
              {score}% <span className="fr-buddy-match-text">match</span>
            </span>
          </div>
          {!isCompact && <span className="fr-buddy-compat">{compatLabel}</span>}
        </div>
        <div className="fr-buddy-divider" />
        <div className="fr-friend-actions">
          <button className="fr-btn fr-buddy-add-btn" style={{ background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)` }}
            onClick={async () => {
              if (!myCode) { showToast("Wait for code generation", "info"); return; }
              const alreadySent = await hasPendingFriendRequest(userId, match.user_id);
              if (alreadySent) { showToast("Request already sent", "info"); return; }
              await sendFriendPing(match.user_id, userId, userName, { type: "friend_request", fromCode: myCode });
              showToast(`Request sent to ${match.name}!`, "success");
              setSuggestedBuddies(prev => prev.filter(p => p.user_id !== match.user_id));
            }}>
            <UserPlus size={14} /> Add
          </button>
        </div>
      </div>
    );
  };

  const filteredFriendsForModal = sortedFriends.filter(f => f.name.toLowerCase().includes(friendSearchQuery.toLowerCase()));
  const groupedFriends = {};
  filteredFriendsForModal.forEach(f => {
    const letter = f.isFavourite ? '★ Favourites' : (f.name[0]?.toUpperCase() || '#');
    if (!groupedFriends[letter]) groupedFriends[letter] = [];
    groupedFriends[letter].push(f);
  });
  const alphabet = ["★", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];
  const activeLetters = Object.keys(groupedFriends).sort((a, b) => {
    if (a === '★ Favourites') return -1;
    if (b === '★ Favourites') return 1;
    return a.localeCompare(b);
  });

  const filteredGroupsForModal = groups.filter(g => g.name.toLowerCase().includes(groupSearchQuery.toLowerCase()));
  const sortedGroups = [...filteredGroupsForModal].sort((a, b) => a.name.localeCompare(b.name));
  const groupedGroups = {};
  sortedGroups.forEach(g => {
    const letter = g.name[0]?.toUpperCase() || '#';
    if (!groupedGroups[letter]) groupedGroups[letter] = [];
    groupedGroups[letter].push(g);
  });
  const activeGroupLetters = Object.keys(groupedGroups).sort();

  return (
    <div className="fr-page">
      {toast && <Toast message={toast.message} type={toast.type} action={toast.action} onDone={() => setToast(null)} />}

      {showAllFriendsModal && (
        <div className="fr-modal-backdrop" onClick={() => setShowAllFriendsModal(false)}>
          <div className="fr-friends-modal" onClick={e => e.stopPropagation()}>
            <div className="fr-friends-modal-head">
              <div className="fr-friends-modal-title-row">
                <h2 className="fr-friends-modal-title">All Friends</h2>
                <button className="fr-modal-close" onClick={() => setShowAllFriendsModal(false)}>
                  <X size={18} />
                </button>
              </div>
              <input
                type="text"
                className="fr-friends-modal-search"
                placeholder="Search friends..."
                value={friendSearchQuery}
                onChange={e => setFriendSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
            
            <div className="fr-friends-modal-body" id="fr-modal-scroll-body">
              {activeLetters.length === 0 ? (
                <p className="fr-empty">No friends found.</p>
              ) : (
                activeLetters.map(letter => (
                  <div key={letter} className="fr-friends-modal-group" id={`fr-group-${letter}`}>
                    <h4 className="fr-friends-modal-letter">{letter}</h4>
                    <div className="fr-friend-list">
                      {letter === '★ Favourites' ? (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                          <SortableContext items={groupedFriends[letter].map(f => f.id)} strategy={verticalListSortingStrategy}>
                            {groupedFriends[letter].map(f => <SortableFriendItem key={f.id} f={f} renderFriendCard={renderFriendCard} isCompact={true} />)}
                          </SortableContext>
                        </DndContext>
                      ) : (
                        groupedFriends[letter].map(f => renderFriendCard(f, true))
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="fr-az-scroller">
              {alphabet.map(letter => {
                const groupKey = letter === '★' ? '★ Favourites' : letter;
                const isActive = activeLetters.includes(groupKey);
                return (
                  <div 
                    key={letter} 
                    className={`fr-az-letter ${isActive ? 'active' : ''}`}
                    style={{ opacity: isActive ? 1 : 0.4, cursor: isActive ? 'pointer' : 'default', fontSize: letter === '★' ? 14 : undefined }}
                    onClick={() => {
                      if (isActive) {
                        const el = document.getElementById(`fr-group-${groupKey}`);
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Groups Modal ── */}
      {showAllGroupsModal && (
        <div className="fr-modal-backdrop" onClick={() => setShowAllGroupsModal(false)}>
          <div className="fr-friends-modal" onClick={e => e.stopPropagation()}>
            <div className="fr-friends-modal-head">
              <div className="fr-friends-modal-title-row">
                <h2 className="fr-friends-modal-title">All Groups</h2>
                <button className="fr-modal-close" onClick={() => setShowAllGroupsModal(false)}>
                  <X size={18} />
                </button>
              </div>
              <input
                type="text"
                className="fr-friends-modal-search"
                placeholder="Search groups..."
                value={groupSearchQuery}
                onChange={e => setGroupSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
            <div className="fr-friends-modal-body" id="fr-modal-scroll-body-groups">
              {activeGroupLetters.length === 0 ? (
                <p className="fr-empty">No groups found.</p>
              ) : (
                activeGroupLetters.map(letter => (
                  <div key={letter} className="fr-friends-modal-group" id={`fr-group-letter-${letter}`}>
                    <h4 className="fr-friends-modal-letter">{letter}</h4>
                    <div className="fr-group-list">
                      {groupedGroups[letter].map(g => renderGroupCard(g, true))}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="fr-az-scroller">
              {alphabet.map(letter => {
                const isActive = activeGroupLetters.includes(letter);
                return (
                  <div 
                    key={letter} 
                    className={`fr-az-letter ${isActive ? 'active' : ''}`}
                    style={{ opacity: isActive ? 1 : 0.4, cursor: isActive ? 'pointer' : 'default' }}
                    onClick={() => {
                      if (isActive) {
                        const el = document.getElementById(`fr-group-letter-${letter}`);
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Student Directory Modal (find people) ── */}
      {showDirectory && (
        <div className="fr-modal-backdrop" onClick={() => setShowDirectory(false)}>
          <div className="fr-friends-modal" onClick={e => e.stopPropagation()}>
            <div className="fr-friends-modal-head">
              <div className="fr-friends-modal-title-row">
                <h2 className="fr-friends-modal-title">Find Students</h2>
                <button className="fr-modal-close" onClick={() => setShowDirectory(false)}>
                  <X size={18} />
                </button>
              </div>
              <input
                type="text"
                className="fr-friends-modal-search"
                placeholder="Search students..."
                value={dirSearch}
                onChange={e => setDirSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="fr-friends-modal-body">
              {directory === null ? (
                <SkeletonText lines={4} />
              ) : (() => {
                const friendIds = new Set(friends.map(f => f.cloudId).filter(Boolean));
                const visible = directory.filter(p => p.name.toLowerCase().includes(dirSearch.toLowerCase()));
                if (!visible.length) return <p className="fr-empty">No students found.</p>;
                return (
                  <div className="fr-friend-list">
                    {visible.map(p => {
                      const isFriend = friendIds.has(p.user_id);
                      const isSent = requestedIds.has(p.user_id);
                      const [c1, c2] = avatarGradient(p.name);
                      return (
                        <div key={p.user_id} className="fr-friend-card fr-buddy compact" style={{ "--accent": c1 }}>
                          <div className="fr-friend-avatar" style={{ background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)` }}>
                            {p.name[0]?.toUpperCase() || "?"}
                          </div>
                          <div className="fr-friend-info">
                            <span className="fr-friend-name">{p.name}</span>
                            <div className="fr-friend-meta-row">
                              <span className="fr-friend-meta">
                                {p.shared > 0 ? `${p.shared} shared course${p.shared !== 1 ? "s" : ""}` : "No shared courses"}
                              </span>
                            </div>
                          </div>
                          <div className="fr-friend-actions">
                            {isFriend ? (
                              <span className="fr-dir-state fr-dir-friends"><Check size={12} strokeWidth={3} /> Friends</span>
                            ) : isSent ? (
                              <span className="fr-dir-state fr-dir-sent">Sent</span>
                            ) : (
                              <button className="fr-btn fr-btn-primary" onClick={() => handleDirectoryAdd(p)}>
                                <UserPlus size={13} /> Add
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Suggested Buddies Modal ── */}
      {showAllBuddiesModal && (
        <div className="fr-modal-backdrop" onClick={() => setShowAllBuddiesModal(false)}>
          <div className="fr-friends-modal" onClick={e => e.stopPropagation()}>
            <div className="fr-friends-modal-head">
              <div className="fr-friends-modal-title-row">
                <h2 className="fr-friends-modal-title">Suggested Buddies</h2>
                <button className="fr-modal-close" onClick={() => setShowAllBuddiesModal(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="fr-friends-modal-body" style={{ paddingRight: 24 }}>
              <div className="fr-friend-list">
                {suggestedBuddies.map(match => renderBuddyCard(match, true))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="fr-page-hdr">
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h2 className="fr-page-hdr-title">Social</h2>
          {(friends.length > 0 || groups.length > 0) && (
            <span style={{ fontSize: 14, color: "var(--muted)", fontWeight: 500 }}>
              {friends.length} friend{friends.length !== 1 ? 's' : ''} · {groups.length} group{groups.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {friends.length > 0 && (
            <button
              className="fr-btn fr-btn-secondary fr-btn-small"
              onClick={() => handleRefreshFriend("all")}
              disabled={!!syncingFriendId}
            >
              <RefreshCw size={14} className={syncingFriendId ? "spin-icon" : ""} />
              <span className="desk-only">Sync all</span>
            </button>
          )}
        </div>
      </div>

      <div className="fr-layout">
      <div className="fr-left-col">
      {/* ── Groups ── */}
      <section className="fr-groups-section fr-sec-groups">
        <div className="fr-section-header">
          <h3 className="fr-section-title"><Users size={15} /> Groups</h3>
          <button className="fr-btn fr-btn-secondary fr-btn-small" style={{ borderRadius: 20 }} onClick={() => setShowNewGroup(s => !s)}>
            {showNewGroup ? <X size={13} /> : <Plus size={13} />}
            {showNewGroup ? "Cancel" : "New Group"}
          </button>
        </div>

        {showNewGroup && (
          <div className="fr-new-group">
            <input
              className="fr-add-input"
              type="text"
              placeholder="Group name (e.g., Finance Gang)"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreateGroup()}
              autoFocus
            />
            <button className="fr-btn fr-btn-primary fr-btn-add" onClick={handleCreateGroup} disabled={!newGroupName.trim()}>
              Create
            </button>
          </div>
        )}

        {groups.length === 0 && !showNewGroup ? (
          <div className="fr-empty-state fr-empty-state-sm">
            <Users size={36} strokeWidth={1.2} />
            <p>No groups yet</p>
            <span>Compare schedules with multiple friends at once.</span>
            <button className="fr-btn fr-btn-primary fr-empty-cta" onClick={() => setShowNewGroup(true)}>
              <Plus size={14} /> Create your first group
            </button>
          </div>
        ) : (
          <div className="fr-group-list">
            {groups.slice(0, 4).map(group => renderGroupCard(group, false))}
          </div>
        )}

        {groups.length > 4 && (
          <button 
            className="fr-btn fr-btn-secondary" 
            style={{ width: "100%", marginTop: 16, justifyContent: "center", padding: "12px", background: "transparent", border: "1px dashed rgba(0,0,0,0.15)" }} 
            onClick={() => setShowAllGroupsModal(true)}
          >
            Show all {groups.length} groups
          </button>
        )}
      </section>

      {/* ── Saved Friends ── */}
      <section className="fr-friends-section fr-sec-friends">
        <div className="fr-section-header">
          <h3 className="fr-section-title">
            Saved Friends
            {friends.length > 0 && <span style={{ fontSize: 11, background: "rgba(0,0,0,0.05)", padding: "2px 8px", borderRadius: 10, color: "var(--muted)", fontWeight: 600 }}>{friends.length}</span>}
          </h3>
          <button className="fr-btn fr-btn-icon" onClick={openDirectory} title="Find students">
            <UserPlus size={15} />
          </button>
        </div>
        {initialLoading && friends.length === 0 ? (
          <div className="fr-friend-list">
            <FriendSkeleton />
            <FriendSkeleton />
            <FriendSkeleton />
          </div>
        ) : friends.length === 0 ? (
          <div className="fr-empty-state">
            <Users size={40} strokeWidth={1.2} />
            <p>No friends added yet</p>
            <span>Share your code with classmates and paste theirs above to compare schedules.</span>
            <button
              className="fr-btn fr-btn-primary fr-empty-cta"
              onClick={openDirectory}
            >
              <UserPlus size={14} /> Find classmates
            </button>
          </div>
        ) : (
          <div className="fr-friend-list">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={visibleFriends.filter(f => f.isFavourite).map(f => f.id)} strategy={verticalListSortingStrategy}>
                {visibleFriends.map(f => 
                  f.isFavourite 
                    ? <SortableFriendItem key={f.id} f={f} renderFriendCard={renderFriendCard} isCompact={false} />
                    : renderFriendCard(f, false)
                )}
              </SortableContext>
            </DndContext>
          </div>
        )}
        
        {sortedFriends.length > 4 && (
          <button
            className="fr-btn fr-btn-secondary fr-show-all-btn"
            onClick={() => setShowAllFriendsModal(true)}
          >
            Show all {sortedFriends.length} friends
          </button>
        )}
      </section>

      </div>{/* /fr-left-col */}
      <div className="fr-right-col">
      
      {/* ── Share & Connect ── */}
      <section className="fr-share-card fr-sec-share" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="fr-share-head" style={{ marginBottom: 0 }}>
          <h2>Share & Connect</h2>
          <span className="fr-share-sub">{courseCount} courses enrolled</span>
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {isGenerating ? (
            <p className="fr-share-empty">Generating secure share code...</p>
          ) : myCode ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="fr-code-display" style={{ margin: 0 }}>
                <span className="fr-code-text">{myCodeDisplay}</span>
              </div>
              <div className="fr-share-actions" style={{ display: "flex", flexDirection: "row", gap: "8px", flexWrap: "nowrap" }}>
                <button className="fr-btn fr-btn-primary" onClick={copyCode} style={{ flex: 1, justifyContent: "center", padding: "10px 4px", fontSize: "13px", whiteSpace: "nowrap", minWidth: 0 }}>
                  <Copy size={16} style={{ flexShrink: 0 }} /> <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>Copy Code</span>
                </button>
                <button className="fr-btn fr-btn-secondary" onClick={copyLink} style={{ flex: 1, justifyContent: "center", padding: "10px 4px", fontSize: "13px", background: "#fff", border: "1px solid rgba(0,0,0,0.1)", color: "#000", whiteSpace: "nowrap", minWidth: 0 }}>
                  <Link2 size={16} style={{ flexShrink: 0 }} /> <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>Copy Link</span>
                </button>
              </div>
              <p className="fr-share-note" style={{ fontSize: "12px", color: "var(--muted)", textAlign: "center", margin: 0 }}>
                Your friend can enter this code manually or open your invite link.
              </p>
            </div>
          ) : (
            <p className="fr-share-empty">Complete your course setup first to share your schedule.</p>
          )}

          <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "4px 0" }} />

          <div className="fr-add-section-inner" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
              <UserPlus size={14} /> Add a Friend
            </h3>
            <div className="fr-add-row" style={{ display: "flex", gap: "8px" }}>
              <input
                className="fr-add-input"
                type="text"
                placeholder="Paste friend's invite link here..."
                value={addCode}
                onChange={e => { setAddCode(e.target.value); setAddError(""); }}
                onKeyDown={e => e.key === "Enter" && handleAddFriend()}
                style={{ flex: 1, margin: 0 }}
              />
              <button className="fr-btn fr-btn-primary fr-btn-add" onClick={handleAddFriend} disabled={!addCode.trim() || isAdding} style={{ margin: 0 }}>
                {isAdding ? "..." : "Add"}
              </button>
            </div>
            {addError && <p className="fr-add-error" style={{ margin: 0 }}>{addError}</p>}
          </div>
        </div>
      </section>

      {/* ── Leave Planner entry (desktop only) ── */}
      {onOpenLeave && (
        <button
          type="button"
          className="fr-leave-cta desktop-only"
          onClick={onOpenLeave}
        >
          <span className="fr-leave-cta-icon"><CalendarOff size={18} /></span>
          <span className="fr-leave-cta-text">
            <span className="fr-leave-cta-title">Leave Planner</span>
            <span className="fr-leave-cta-sub">See what you&rsquo;ll miss before you go</span>
          </span>
          <ChevronRight size={18} className="fr-leave-cta-chev" />
        </button>
      )}

      {/* ── Suggested Study Buddies ── */}
      <section className="fr-friends-section fr-sec-buddies" style={{ marginBottom: 24 }}>
        <div className="fr-section-header">
           <h3 className="fr-section-title">Suggested Study Buddies</h3>
           <label className="fr-optout-label">
             <input type="checkbox" checked={optOutMatchmaker} onChange={toggleOptOut} />
             Opt Out
           </label>
        </div>
        {!optOutMatchmaker && suggestedBuddies && suggestedBuddies.length > 0 && (
          <div className="fr-friend-list" style={{ marginTop: 12 }}>
            {suggestedBuddies.slice(0, 3).map(match => renderBuddyCard(match, false))}
          </div>
        )}
        
        {!optOutMatchmaker && suggestedBuddies && suggestedBuddies.length > 3 && (
          <button
            className="fr-btn fr-btn-secondary fr-show-all-btn"
            onClick={() => setShowAllBuddiesModal(true)}
          >
            Show all {suggestedBuddies.length} buddies
          </button>
        )}
        {optOutMatchmaker && (
           <div className="fr-empty-state" style={{ padding: "16px", minHeight: "auto", background: "rgba(0,0,0,0.02)" }}>
              <span style={{ fontSize: 13 }}>You are hidden from the matchmaker.</span>
           </div>
        )}
        {!optOutMatchmaker && (!suggestedBuddies || suggestedBuddies.length === 0) && (
           <div className="fr-empty-state" style={{ padding: "16px", minHeight: "auto", background: "rgba(0,0,0,0.02)" }}>
              <span style={{ fontSize: 13 }}>No high-match buddies found right now.</span>
           </div>
        )}

        {/* Manual group builder — works regardless of matchmaker results */}
        <button
          className="fr-btn fr-btn-secondary fr-manual-group-toggle"
          onClick={() => { setManualGroupOpen(o => !o); if (manualGroupOpen) setManualGroupId(null); }}
        >
          <Users size={14} />
          {manualGroupOpen ? "Close" : "Add friends to a group"}
          {manualGroupOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {manualGroupOpen && (
          <div className="fr-manual-group-panel">
            {/* Step 1: pick or create a group */}
            <div className="fr-mg-step">
              <span className="fr-mg-step-num">1</span>
              <span className="fr-mg-step-label">Pick a group</span>
            </div>
            {groups.filter(g => !g.isReceived).length > 0 && (
              <div className="fr-group-members">
                {groups.filter(g => !g.isReceived).map(g => (
                  <button
                    key={g.id}
                    className={`fr-member-chip ${manualGroupId === g.id ? "in" : ""}`}
                    onClick={() => setManualGroupId(manualGroupId === g.id ? null : g.id)}
                  >
                    <Users size={12} /> {g.name}
                    <span className="fr-mg-chip-count">{(g.memberIds || []).length}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="fr-new-group" style={{ marginTop: 8 }}>
              <input
                className="fr-add-input"
                type="text"
                placeholder={groups.filter(g => !g.isReceived).length ? "Or create a new group…" : "Name your group (e.g. Finance Gang)…"}
                value={manualNewName}
                onChange={e => setManualNewName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleManualCreateGroup()}
              />
              <button className="fr-btn fr-btn-primary fr-btn-add" onClick={handleManualCreateGroup} disabled={!manualNewName.trim()}>
                Create
              </button>
            </div>

            {/* Step 2: members — only once a group is chosen */}
            {manualGroupId && (
              <>
                <div className="fr-mg-divider" />
                <div className="fr-mg-step">
                  <span className="fr-mg-step-num">2</span>
                  <span className="fr-mg-step-label">Tap friends to add or remove</span>
                </div>
                {friends.length > 0 && (
                  <div className="fr-group-members">
                    {friends.map(f => {
                      const grp = groups.find(g => g.id === manualGroupId);
                      const inGroup = (grp?.memberIds || []).includes(f.id);
                      return (
                        <button
                          key={f.id}
                          className={`fr-member-chip ${inGroup ? "in" : ""}`}
                          onClick={() => handleToggleFriendInGroup(manualGroupId, f.id)}
                        >
                          <span className="fr-member-initial">{f.name[0]}</span>
                          {f.name}
                          {inGroup && <Check size={12} strokeWidth={3} />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Add someone who isn't a friend yet */}
                <p className="fr-mg-hint">
                  {friends.length === 0
                    ? "No friends yet — paste an invite link to add your first:"
                    : "Missing someone? Paste their invite link:"}
                </p>
                <div className="fr-add-row" style={{ display: "flex", gap: 8 }}>
                  <input
                    className="fr-add-input"
                    type="text"
                    placeholder="Paste a friend's invite link…"
                    value={manualAddCode}
                    onChange={e => { setManualAddCode(e.target.value); setAddError(""); }}
                    onKeyDown={e => e.key === "Enter" && handleManualAddFriend()}
                    style={{ flex: 1, margin: 0 }}
                  />
                  <button
                    className="fr-btn fr-btn-primary fr-btn-add"
                    onClick={handleManualAddFriend}
                    disabled={!manualAddCode.trim() || isAdding}
                    style={{ margin: 0 }}
                  >
                    {isAdding ? "..." : "Add"}
                  </button>
                </div>
                {addError && manualAddCode && <p className="fr-add-error" style={{ margin: "6px 0 0" }}>{addError}</p>}

                <div className="fr-mg-footer">
                  <span className="fr-mg-count">
                    {(groups.find(g => g.id === manualGroupId)?.memberIds || []).length} member{(groups.find(g => g.id === manualGroupId)?.memberIds || []).length !== 1 ? "s" : ""}
                  </span>
                  {confirmDeleteId === manualGroupId ? (
                    <div className="fr-confirm-row">
                      <span className="fr-confirm-label">Delete group?</span>
                      <button
                        className="fr-btn fr-btn-danger fr-btn-small"
                        onClick={() => {
                          const id = manualGroupId;
                          setConfirmDeleteId(null);
                          setManualGroupId(null);
                          handleRemoveGroup(id);
                        }}
                      >
                        Yes
                      </button>
                      <button className="fr-btn fr-btn-small" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="fr-btn fr-btn-danger fr-btn-small"
                        onClick={() => setConfirmDeleteId(manualGroupId)}
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                      <button
                        className="fr-btn fr-btn-primary fr-btn-small"
                        onClick={() => { setManualGroupOpen(false); setManualGroupId(null); showToast("Group updated", "success"); }}
                      >
                        <Check size={13} strokeWidth={2.8} /> Done
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </section>


      </div>{/* /fr-right-col */}
      </div>{/* /fr-layout */}
    </div>
  );
}

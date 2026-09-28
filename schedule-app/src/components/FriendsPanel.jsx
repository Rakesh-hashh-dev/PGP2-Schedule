import { useState, useEffect } from "react";
import "../styles/friends.css";
import { Copy, Link2, UserPlus, Users, Trash2, ArrowRight, Plus, X, Check, ChevronDown, ChevronUp, ChevronRight, RefreshCw, Globe, Lock, CheckCircle, AlertCircle, Info, AlertTriangle, Star, CalendarOff, Smile, BarChart3, CalendarPlus, BellRing, Coffee, BookOpen, Utensils, Dumbbell, Moon, MessageSquare, Pencil, Search, LayoutDashboard, GripVertical } from "lucide-react";
import { SkeletonText, EmptyState } from "./ui.jsx";
import MeetupsStrip from "./Meetups.jsx";
import { fetchMyNudges, scheduleNudge, cancelNudge } from "../lib/nudges.js";

import {
  decodeSchedule, codeDisplayPart, buildShareUrl,
  saveFriend, removeFriend as removeFriendFromStore, updateFriend, writeFriends,
  loadGroups, createGroup, removeGroup as removeGroupFromStore, updateGroup,
  getOrCreateShareCode, pushFriendsToCloud, pushGroupsToCloud,
  refreshFriendCoursesFromCloud, sendFriendPing, hasPendingFriendRequest, deletePingsBetween,
  shareGroupWithMembers, unshareGroupFromMembers,
  sendGroupChatMessage, fetchGroupChatMessages, deleteGroupChatMessage, editGroupChatMessage,
  sendSocialNotification,
  avatarGradient,
} from "../lib/friends.js";
import { createPoll, POLL_MARKER } from "../lib/polls.js";
import { filterSocialFriends, SOCIAL_VIEW_ITEMS } from "../lib/socialWorkspace.js";
import { fmtTime12 } from "../lib/datetime.js";
import PollCard, { PollComposer } from "./PollCard.jsx";
import { groupInvite, groupInviteUrl } from "../lib/groupInvites.js";

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

function IncomingRequestItem({ item, onAccept, onDecline, variant = "row" }) {
  return (
    <div className={variant === "card" ? "fr-request-row" : "fr-incoming-row"}>
      <div className="fr-incoming-avatar">{(item.name || "?")[0].toUpperCase()}</div>
      <span className="fr-incoming-name">{item.name || "Student"}</span>
      <div className="fr-incoming-actions">
        <button
          className="fr-incoming-btn fr-incoming-accept"
          onClick={e => { e.stopPropagation(); onAccept?.(item); }}
          title="Accept"
          aria-label={`Accept ${item.name || "student"}`}
        >
          <Check size={12} strokeWidth={2.8} />
        </button>
        <button
          className="fr-incoming-btn fr-incoming-decline"
          onClick={e => { e.stopPropagation(); onDecline?.(item); }}
          title="Decline"
          aria-label={`Decline ${item.name || "student"}`}
        >
          <X size={12} strokeWidth={2.8} />
        </button>
      </div>
    </div>
  );
}

import {
  STATUS_PRESETS, STATUS_DURATIONS, statusUntil,
  fmtStatusUntil, loadMyStatus, setMyStatus,
  fetchFriendPresence, isAwayNow, fmtAwayEnd,
} from "../lib/status.js";

const STATUS_ICONS = {
  chai: Coffee,
  library: BookOpen,
  mess: Utensils,
  sports: Dumbbell,
  resting: Moon,
};

function StatusIcon({ id, size = 14, className = "" }) {
  const Icon = STATUS_ICONS[id] || MessageSquare;
  return <Icon size={size} className={className} />;
}

function StatusModal({ current, onSave, onClose }) {
  const [presetId, setPresetId] = useState(current?.id || null);
  const [customText, setCustomText] = useState(current && !current.id ? current.text : "");
  const [durationIdx, setDurationIdx] = useState(1); // default 1 hr

  const preset = STATUS_PRESETS.find(p => p.id === presetId) || null;
  const text = preset ? preset.text : customText.trim();
  const canSet = !!text;

  const handleSet = () => {
    if (!canSet) return;
    onSave({
      id: preset?.id || null,
      emoji: preset?.emoji || "💬",
      text,
      until: statusUntil(STATUS_DURATIONS[durationIdx].mins),
    });
  };

  return (
    <div className="fr-modal-backdrop" onClick={onClose}>
      <div className="fr-status-modal" onClick={e => e.stopPropagation()}>
        <div className="fr-friends-modal-title-row">
          <h2 className="fr-friends-modal-title">Set a status</h2>
          <button className="fr-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="fr-status-presets">
          {STATUS_PRESETS.map(p => (
            <button
              key={p.id}
              className={`fr-status-preset ${presetId === p.id ? "is-active" : ""}`}
              onClick={() => { setPresetId(prev => prev === p.id ? null : p.id); setCustomText(""); }}
            >
              <span className="fr-status-preset-emoji" style={{ display: 'inline-flex', verticalAlign: '-3px' }}><StatusIcon id={p.id} size={15} /></span> {p.text}
            </button>
          ))}
        </div>
        <input
          className="fr-add-input"
          type="text"
          placeholder="Or write your own…"
          maxLength={40}
          value={customText}
          onChange={e => { setCustomText(e.target.value); if (e.target.value) setPresetId(null); }}
          onKeyDown={e => e.key === "Enter" && handleSet()}
        />
        <div className="fr-status-durations">
          <span className="fr-status-durations-label">Clear after</span>
          {STATUS_DURATIONS.map((d, i) => (
            <button
              key={d.label}
              className={`fr-status-duration ${durationIdx === i ? "is-active" : ""}`}
              onClick={() => setDurationIdx(i)}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="fr-status-modal-foot">
          {current && (
            <button className="fr-btn fr-btn-secondary fr-btn-small" onClick={() => onSave(null)}>
              Clear status
            </button>
          )}
          <button className="fr-btn fr-btn-primary" style={{ marginLeft: "auto" }} onClick={handleSet} disabled={!canSet}>
            <Check size={14} /> Set status
          </button>
        </div>
      </div>
    </div>
  );
}

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableFriendItem({ f, renderFriendCard, isCompact }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: f.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : 1, position: 'relative' };
  return (
    <div ref={setNodeRef} style={style}>
      {renderFriendCard(f, isCompact, { attributes, listeners, setActivatorNodeRef })}
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
  const [showPollComposer, setShowPollComposer] = useState(false);
  const [pollBusy, setPollBusy] = useState(false);
  const [editingMsg, setEditingMsg] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let channel;
    async function load() {
      setLoading(true);
      const msgs = await fetchGroupChatMessages(group.id);
      setMessages(msgs);
      setLoading(false);

      const { supabase } = await import("../lib/supabase.js");
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
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_messages', filter: `group_id=eq.${group.id}` }, payload => {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'group_messages', filter: `group_id=eq.${group.id}` }, payload => {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, text: payload.new.text } : m));
        })
        .subscribe();
    }
    load();
    return () => { if (channel) channel.unsubscribe(); };
  }, [group.id]);

  async function handleSend(e) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    const txt = text.trim();
    setText("");
    setSending(true);
    try {
      if (editingMsg) {
        if (txt !== editingMsg.text) await editGroupChatMessage(editingMsg.id, userId, txt);
        setEditingMsg(null);
      } else {
        await sendGroupChatMessage(group.id, userId, userName, txt);
      }
    } finally {
      setSending(false);
    }
  }

  async function handleDeleteMsg(msgId) {
    setDeletingId(msgId);
    const ok = await deleteGroupChatMessage(msgId, userId);
    if (ok) setMessages(prev => prev.filter(m => m.id !== msgId));
    setDeletingId(null);
  }

  async function handleCreatePoll({ question, options, multi, closesAt }) {
    setPollBusy(true);
    const poll = await createPoll({ scope: "group", groupId: group.id, userId, userName, question, options, multi, closesAt });
    setPollBusy(false);
    if (!poll) return;
    setShowPollComposer(false);
    await sendGroupChatMessage(group.id, userId, userName, `${POLL_MARKER}${poll.id}`);
    for (const memberId of new Set([...(group.cloudMemberIds || []), ...(group.inviteMembers || []).map(m => m.userId)])) {
      if (memberId === userId) continue;
      sendSocialNotification(memberId, "group_poll", { fromId: userId, fromName: userName, group: group.name, pollId: poll.id });
    }
  }

  return (
    <div className="fr-chat-box">
      <p className="fr-group-body-label">Group Chat</p>
      <div className="fr-chat-msgs">
         {loading ? <SkeletonText lines={3} /> : messages.length === 0 ? <div className="fr-empty">No messages yet. Say hi!</div> : messages.map(m => {
           const isMine = m.from_id === userId;
           const canDelete = isMine;
           return m.text.startsWith(POLL_MARKER) ? (
             <div key={m.id} style={{ display: "flex", gap: 8, marginBottom: 12, flexDirection: isMine ? "row-reverse" : "row" }}>
               <div className="fr-group-avatar-dot" style={{ background: avatarGradient(m.name)[0], flexShrink: 0 }}>{m.name[0]?.toUpperCase()}</div>
               <PollCard pollId={m.text.slice(POLL_MARKER.length)} userId={userId} userName={userName} />
             </div>
           ) : (
             <div
               key={m.id}
               className="fr-chat-msg-row"
               style={{ flexDirection: isMine ? "row-reverse" : "row" }}
             >
               <div className="fr-group-avatar-dot" style={{ background: avatarGradient(m.name)[0], flexShrink: 0 }}>{m.name[0]?.toUpperCase()}</div>
               <div className={`fr-chat-msg-bubble ${isMine ? "fr-chat-msg-mine" : "fr-chat-msg-theirs"}`}>
                 {!isMine && <div className="fr-chat-msg-name">{m.name}</div>}
                 {m.text}
                 {m.id === editingMsg?.id && <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 8, fontStyle: "italic" }}>(Editing)</span>}
               </div>
               {canDelete && (
                 <div style={{ display: "flex", gap: 4 }}>
                   <button
                     className="fr-chat-del-btn"
                     style={{ color: "var(--violet)", background: "rgba(124, 58, 237, 0.12)" }}
                     onClick={() => { setEditingMsg({ id: m.id, text: m.text }); setText(m.text); }}
                     title="Edit message"
                     aria-label="Edit message"
                   >
                     <Pencil size={12} />
                   </button>
                   <button
                     className="fr-chat-del-btn"
                     onClick={() => handleDeleteMsg(m.id)}
                     disabled={deletingId === m.id}
                     title="Delete message"
                     aria-label="Delete message"
                   >
                     <Trash2 size={12} />
                   </button>
                 </div>
               )}
             </div>
           );
         })}
      </div>
      {showPollComposer && (
        <div style={{ marginBottom: 8 }}>
          <PollComposer onSubmit={handleCreatePoll} onCancel={() => setShowPollComposer(false)} busy={pollBusy} />
        </div>
      )}
      <form onSubmit={handleSend} className="fr-chat-form">
         <button type="button" className="fr-btn fr-btn-secondary" title="Start a poll" aria-label="Start a poll" onClick={() => setShowPollComposer(o => !o)} style={{ borderRadius: 20, padding: "0 12px" }}>
            <BarChart3 size={15} />
         </button>
         <input type="text" className="fr-chat-input" placeholder={editingMsg ? "Edit message..." : "Message group..."} value={text} onChange={e => setText(e.target.value)} />
         {editingMsg ? (
           <button type="button" className="fr-btn fr-btn-secondary" onClick={() => { setEditingMsg(null); setText(""); }} style={{ borderRadius: 20, padding: "0 12px" }}>Cancel</button>
         ) : null}
         <button type="submit" className="fr-btn fr-btn-primary" style={{ borderRadius: 20, padding: "0 16px" }} disabled={sending} aria-busy={sending}>{sending ? "Sending…" : editingMsg ? "Save" : "Send"}</button>
      </form>
    </div>
  );
}

function toMinFP(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function ymdFP(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
import { getPetByKey } from "./greetingPets.jsx";
import PetHat from "./PetHat.jsx";
import PetNeckwear from "./PetNeckwear.jsx";
import { titleLabel } from "../lib/pet.js";
import { fetchFriendPets } from "../lib/petStorage.js";

export default function FriendsPanel({
  userId, userName, enrolled, friends, setFriends,
  groups, setGroups, allClasses, now, onCompare, onGroupCompare, onOpenLeave,
  statusEnabled = true, meetupsEnabled = true, nudgeEnabled = true, awayEnabled = true,
  petsEnabled = true,
  planDraft = null, onPlanDraftConsumed,
  friendNotifItems = [], onAcceptFriend, onDeclineFriend,
  groupInviteToken = null, onGroupInviteConsumed,
}) {
  const [addCode, setAddCode] = useState("");
  const [addError, setAddError] = useState("");
  const [toast, setToast] = useState(null); // { message, type, action? }
  const [pendingDelete, setPendingDelete] = useState(null); // { id, timeoutId }
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [socialView, setSocialView] = useState("overview");
  const [friendFilter, setFriendFilter] = useState("all");
  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const [showConnectModal, setShowConnectModal] = useState(false);

  const [myCode, setMyCode] = useState(null);
  const isGenerating = !!userId && !myCode; // code still being fetched/created
  const [isAdding, setIsAdding] = useState(false);
  const [syncingFriendId, setSyncingFriendId] = useState(null);
  const [sharingGroupId, setSharingGroupId] = useState(null);
  const [inviteLinks, setInviteLinks] = useState({});
  const [groupRequests, setGroupRequests] = useState({});
  const ownedGroupIds = groups.filter(group => !group.isReceived).map(group => group.id).join("|");
  useEffect(() => {
    if (!userId || !ownedGroupIds) return;
    let live = true;
    Promise.all(ownedGroupIds.split("|").map(async groupId => {
      try { return [groupId, await groupInvite("list", { groupId })]; }
      catch { return [groupId, []]; }
    })).then(entries => { if (live) setGroupRequests(prev => ({ ...prev, ...Object.fromEntries(entries) })); });
    return () => { live = false; };
  }, [userId, ownedGroupIds]);
  const [joinPreview, setJoinPreview] = useState(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState("");
  useEffect(() => {
    if (!userId || !groupInviteToken) return;
    let live = true;
    groupInvite("preview", { token: groupInviteToken })
      .then(preview => { if (live) { setInviteError(""); setJoinPreview(preview); setSocialView("groups"); } })
      .catch(error => { if (live) { setInviteError(error.message || "Could not open invite"); setJoinPreview({ invalid: true }); } });
    return () => { live = false; };
  }, [userId, groupInviteToken]);

  async function openGroupMembers(group) {
    setSocialView("groups");
    setExpandedGroup(group.id);
    if (group.isReceived) return;
    try {
      const requests = await groupInvite("list", { groupId: group.id });
      setGroupRequests(prev => ({ ...prev, [group.id]: requests || [] }));
    } catch { /* Invite database may not be installed yet. */ }
  }

  async function createGroupLink(group) {
    setInviteBusy(true);
    try {
      const invite = await groupInvite("create", { groupId: group.id });
      setInviteLinks(prev => ({ ...prev, [group.id]: invite.token }));
      const copied = await copyText(groupInviteUrl(invite.token));
      showToast(copied ? "Group invite link copied" : "Invite link ready; copy it below", copied ? "success" : "info");
    } catch (error) {
      showToast(error.code === "PGRST202" ? "Group invites need the database migration first" : (error.message || "Could not create invite link"), "error");
    } finally { setInviteBusy(false); }
  }

  async function reviewGroupRequest(group, request, approve) {
    setInviteBusy(true);
    try {
      const result = await groupInvite(approve ? "approve" : "decline", { groupId: group.id, requesterId: request.userId });
      setGroupRequests(prev => ({ ...prev, [group.id]: (prev[group.id] || []).map(r => r.userId === request.userId ? { ...r, status: result.status } : r) }));
      if (approve) {
        const inviteMembers = [...(group.inviteMembers || []), { userId: result.userId, name: result.name }];
        setGroups(updateGroup(group.id, { inviteMembers }));
      }
      showToast(approve ? `${request.name} joined the group` : "Request declined", "success");
    } catch (error) { showToast(error.message || "Could not review request", "error"); }
    finally { setInviteBusy(false); }
  }

  async function requestGroupJoin() {
    if (!groupInviteToken) return;
    setInviteBusy(true);
    try {
      const preview = await groupInvite("request", { token: groupInviteToken });
      setJoinPreview(preview);
      showToast(preview.status === "approved" ? "You're already a member" : "Request sent to the group owner", "success");
    } catch (error) { setInviteError(error.message || "Could not request to join"); }
    finally { setInviteBusy(false); }
  }
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
        if (isAwayNow(profile.courses?._away)) return null; // Off campus right now

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

  const [myStatus, setMyStatusState] = useState(() => loadMyStatus());
  const [showStatusModal, setShowStatusModal] = useState(false);

  const handleSaveStatus = (status) => {
    setMyStatusState(status);
    setShowStatusModal(false);
    setMyStatus(userId, status); // localStorage + cloud, fire-and-forget
    showToast(status ? "Status set — friends can see it now" : "Status cleared", "success");
  };

  // Friends' statuses come from a fresh fetch, not the local friends cache —
  // the cache strips `_` keys and can be minutes stale, too old for a 30-min
  // status. Keyed by cloudId; expired entries drop out at render time.
  const [friendStatuses, setFriendStatuses] = useState({});
  const friendCloudKey = friends.map(f => f.cloudId).filter(Boolean).sort().join(",");
  useEffect(() => {
    // No clearing branch needed: renders gate on statusEnabled, and a fetch
    // replaces the whole map whenever the friend list changes.
    if ((!statusEnabled && !awayEnabled) || !friendCloudKey) return;
    let alive = true;
    fetchFriendPresence(friendCloudKey.split(",")).then(map => { if (alive) setFriendStatuses(map); });
    return () => { alive = false; };
  }, [statusEnabled, awayEnabled, friendCloudKey]);

  // Friends' companions. Same batched-by-cloudId shape as presence above, but
  // through the definer-side RPC — pet_state itself is self-only, and the RPC
  // returns the pet, its level and what it is wearing, and nothing else (no XP,
  // no ledger, no timestamps).
  const [friendPets, setFriendPets] = useState({});
  useEffect(() => {
    if (!petsEnabled || !friendCloudKey) return undefined;
    let alive = true;
    fetchFriendPets(friendCloudKey.split(",")).then(map => { if (alive) setFriendPets(map); });
    return () => { alive = false; };
  }, [petsEnabled, friendCloudKey]);

  // "Ping me when free" (Phase C): pending nudges keyed by the friend's id
  const [myNudges, setMyNudges] = useState({});
  useEffect(() => {
    if (!nudgeEnabled || !userId) return;
    fetchMyNudges(userId).then(setMyNudges);
  }, [nudgeEnabled, userId]);

  const handleToggleNudge = async (f, endHHMM) => {
    const key = f.cloudId || f.id;
    const existing = myNudges[key];
    if (existing) {
      await cancelNudge(existing.id);
      setMyNudges(prev => { const next = { ...prev }; delete next[key]; return next; });
      showToast("Free-time nudge cancelled", "info");
      return;
    }
    const [h, m] = endHHMM.split(":").map(Number);
    const fireAt = new Date(now);
    fireAt.setHours(h, m, 0, 0);
    const row = await scheduleNudge(userId, f, fireAt.toISOString());
    if (row) {
      setMyNudges(prev => ({ ...prev, [key]: row }));
      showToast(`We'll nudge you around ${fmtStatusUntil(row.fire_at)} when ${f.name.split(" ")[0]} is free`, "success");
    } else {
      showToast("Couldn't schedule the nudge", "error");
    }
  };

  // Plan drafts from a group card (CompareView drafts arrive via planDraft prop)
  const [groupPlanDraft, setGroupPlanDraft] = useState(null);
  const openGroupPlan = (group) => {
    const memberCloudIds = group.isReceived
      ? (group.cloudMemberIds || []).filter(cid => cid !== userId)
      : [...(group.memberIds || [])
          .map(id => friends.find(f => f.id === id)?.cloudId)
          .filter(Boolean), ...(group.inviteMembers || []).map(m => m.userId)];
    setGroupPlanDraft({
      title: group.name,
      groupId: group.id,
      groupName: group.name,
      memberCloudIds,
    });
  };

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
      try { await groupInvite(isReceived ? "leave" : "close", { groupId: id }); }
      catch (error) { if (error.code !== "PGRST202") console.warn("[group] invite cleanup failed:", error.message); }
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

  // { state: "busy", end: "HH:MM" } | { state: "free" } | null
  function getFriendStatusNow(friend) {
    if (!allClasses || !now) return null;
    const todayISO = ymdFP(now);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const current = allClasses.find(c => {
      if (c.date !== todayISO || (c.type !== "class" && c.type !== "exam") || !c.code) return false;
      const sec = friend.courses?.[c.code];
      return sec !== undefined && (c.section === "Single" || c.section === sec) &&
        toMinFP(c.start) <= nowMin && nowMin < toMinFP(c.end);
    });
    return current ? { state: "busy", end: current.end } : { state: "free" };
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
  const freeNowFriends = sortedFriends.filter(friend => getFriendStatusNow(friend)?.state === "free");
  const incomingRequests = friendNotifItems?.filter(item => item.kind === "friend_request") || [];
  const filteredWorkspaceFriends = filterSocialFriends(sortedFriends, {
    query: workspaceSearch,
    filter: friendFilter,
    getStatus: getFriendStatusNow,
  });

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
    const isModalOpen = showAllFriendsModal || showAllGroupsModal || showAllBuddiesModal || showDirectory || showConnectModal;
    if (isModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showAllFriendsModal, showAllGroupsModal, showAllBuddiesModal, showDirectory, showConnectModal]);

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

  const renderFriendCard = (f, isCompact = false, dragHandle = null) => {
    const fCourseCount = Object.keys(f.courses || {}).length;
    const [c1, c2] = avatarGradient(f.name);
    const status = getFriendStatusNow(f);
    const presence = f.cloudId ? friendStatuses[f.cloudId] : null;
    const selfStatus = statusEnabled ? presence?.status || null : null;
    const away = awayEnabled && isAwayNow(presence?.away) ? presence.away : null;
    const theirPet = petsEnabled && f.cloudId ? friendPets[f.cloudId] : null;
    return (
      <div key={f.id} className={`fr-friend-card ${isCompact ? "compact" : ""} ${f.isFavourite && !isCompact ? "favourite-glow" : ""}`} style={{ '--accent': c1 }}>
        <div className="fr-friend-avatar" style={{ background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`, boxShadow: `0 4px 16px ${c1}66` }}>
          {f.imageUrl ? <img src={f.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : f.name[0]?.toUpperCase()}
        </div>
        <div className="fr-friend-info">
          <span className="fr-friend-name">{f.name}</span>
          <div className="fr-friend-meta-row">
            <span className="fr-friend-meta">{fCourseCount} course{fCourseCount !== 1 ? "s" : ""}</span>
            {theirPet && (
              <span className="fr-friend-pet" title={`${theirPet.name || getPetByKey(theirPet.key).label} · Level ${theirPet.level}${theirPet.title ? ` · ${titleLabel(theirPet.title) || ""}` : ""}`}>
                {/* data-motion="off": a friends list can hold dozens of these,
                    and idle-animating every one is a real cost for decoration. */}
                <span
                  className="dg-pet fr-friend-pet-art"
                  data-pet={theirPet.key}
                  data-motion="off"
                  data-coat={theirPet.coat || undefined}
                  data-neck={theirPet.neck || undefined}
                  aria-hidden="true"
                >
                  {(() => { const P = getPetByKey(theirPet.key).Svg; return <P />; })()}
                  <PetHat hat={theirPet.hat || null} />
                  <PetNeckwear neck={theirPet.neck || null} />
                </span>
                {theirPet.name || getPetByKey(theirPet.key).label} · Lv {theirPet.level}
              </span>
            )}
          </div>
          {away && (
            <span className="fr-friend-status fr-friend-away">
              <CalendarOff size={11} /> Away till {fmtAwayEnd(away.to)}
            </span>
          )}
          {!away && status && (
            <span className={`fr-friend-status fr-friend-status-${status.state}`}>
              <span className="fr-friend-status-dot" />
              {status.state === "free" ? "Free now" : `In class till ${status.end ? fmtTime12(status.end) : "?"}`}
              {nudgeEnabled && status.state === "busy" && status.end && (
                <button
                  className={`fr-nudge-btn ${myNudges[f.cloudId || f.id] ? "is-active" : ""}`}
                  title={myNudges[f.cloudId || f.id] ? "Cancel the free-time nudge" : "Notify me when they're free"}
                  onClick={() => handleToggleNudge(f, status.end)}
                >
                  <BellRing size={11} />
                </button>
              )}
            </span>
          )}
          {selfStatus && (
            <span className="fr-friend-selfstatus" title={`till ${fmtStatusUntil(selfStatus.until)}`}>
              <span className="fr-friend-selfstatus-emoji" style={{ display: 'inline-flex', verticalAlign: '-3px' }}><StatusIcon id={selfStatus.id} size={13} /></span>
              {selfStatus.text}
              <span className="fr-friend-selfstatus-till">· till {fmtStatusUntil(selfStatus.until)}</span>
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
          {dragHandle && (
            <button
              ref={dragHandle.setActivatorNodeRef}
              className="fr-btn fr-btn-icon fr-drag-handle"
              type="button"
              aria-label={`Reorder ${f.name}`}
              title="Drag to reorder favourite"
              {...dragHandle.attributes}
              {...dragHandle.listeners}
            >
              <GripVertical size={14} />
            </button>
          )}
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
    const selectedFriends = friends.filter(f => (group.memberIds || []).includes(f.id));
    const inviteOnlyMembers = (group.inviteMembers || []).filter(member => !selectedFriends.some(f => f.cloudId === member.userId));
    const memberCount = selectedFriends.length + inviteOnlyMembers.length;
    const isExpanded = expandedGroup === group.id && !isCompact; // don't expand in compact mode
    const pendingCount = (groupRequests[group.id] || []).filter(request => request.status === "pending").length;

    const displayMembers = group.isReceived
      ? (group.cloudMemberIds || [])
          .filter(cid => cid !== userId)
          .map(cid => friends.find(f => f.cloudId === cid) || { id: cid, name: cid === group.ownerId ? group.ownerName || "Owner" : "Member" })
      : [...selectedFriends, ...inviteOnlyMembers.map(member => ({ id: member.userId, name: member.name || "Member" }))];

    const displayCount = displayMembers.length;

    return (
      <div key={group.id} className={`fr-group-card ${group.isReceived ? "fr-group-received" : ""} ${isCompact ? "compact" : ""}`}>
        <div className="fr-group-head">
          <button type="button" className="fr-group-summary" aria-expanded={!isCompact ? isExpanded : undefined}
            onClick={() => { if (isCompact) openGroupMembers(group); else if (isExpanded) setExpandedGroup(null); else openGroupMembers(group); }}>
            <span className="fr-group-emblem"><Users size={19} strokeWidth={2} /></span>
            <span className="fr-group-info">
              <span className="fr-group-name">{group.name}</span>
              <span className="fr-group-meta">
                {group.isReceived ? `Shared by ${group.ownerName || "a classmate"}` : `${memberCount} member${memberCount !== 1 ? "s" : ""}`}
              </span>
            </span>
            <span className="fr-group-summary-end">
              {displayCount > 0 && <span className="fr-group-member-preview" aria-label={`${displayCount} visible group members`}>
                {displayMembers.slice(0, 3).map((f, fi) => {
                  const [c1] = avatarGradient(f.name);
                  return <span key={f.id} className="fr-group-avatar-dot" style={{ background: c1, zIndex: 10 - fi }} title={f.name}>
                    {f.imageUrl ? <img src={f.imageUrl} alt="" /> : f.name[0]?.toUpperCase()}
                  </span>;
                })}
                {displayCount > 3 && <span className="fr-group-avatar-dot fr-group-avatar-more">+{displayCount - 3}</span>}
              </span>}
              {!isCompact && (isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
              {isCompact && <ChevronRight size={16} />}
            </span>
          </button>
          <div className="fr-group-card-footer">
            <div className="fr-group-card-tags">
              {!group.isReceived && <span className={`fr-privacy-badge fr-privacy-badge-${group.visibility || "private"}`}>
                {group.visibility === "global" ? <Globe size={11} /> : group.visibility === "shared" ? <Users size={11} /> : <Lock size={11} />}
                {group.visibility === "global" ? "Global" : group.visibility === "shared" ? "Members" : "Private"}
              </span>}
              {group.isReceived && <span className="fr-group-shared-badge"><Globe size={11} /> Joined</span>}
              {pendingCount > 0 && <span className="fr-group-pending-badge">{pendingCount} pending</span>}
            </div>
            <div className="fr-group-actions">
              {!group.isReceived && <button type="button" className="fr-btn fr-btn-small fr-group-add-members" onClick={() => openGroupMembers(group)}>
                <UserPlus size={13} /> Add members
              </button>}
              {!group.isReceived && <button type="button" className="fr-btn fr-btn-small fr-group-share-link" disabled={inviteBusy} onClick={() => createGroupLink(group)}>
                <Link2 size={13} /> Invite link
              </button>}
              {(memberCount >= 1 || group.isReceived) && <button type="button" className="fr-btn fr-btn-compare" onClick={() => onGroupCompare(group)}>
                Compare <ArrowRight size={13} />
              </button>}
            </div>
          </div>
        </div>
        {isExpanded && !isCompact && (
          <div className="fr-group-body">
            {group.isReceived ? (
              <>
                <p className="fr-group-body-label">Members in this group:</p>
                {displayMembers.length === 0 ? (
                  <EmptyState compact icon={Users} sub="Add the group members as friends to see them here." />
                ) : (
                  <div className="fr-group-members">
                    {displayMembers.map(f => (
                      <div key={f.id} className="fr-member-chip in" style={{ cursor: "default", overflow: 'hidden' }}>
                        {f.imageUrl ? <img src={f.imageUrl} alt="" className="fr-member-initial" style={{ width: 24, height: 24, padding: 0, objectFit: 'cover' }} /> : <span className="fr-member-initial">{f.name[0]}</span>}
                        {f.name}
                      </div>
                    ))}
                  </div>
                )}
                <div className="fr-group-body-footer" style={{ justifyContent: "flex-end" }}>
                  {meetupsEnabled && <button type="button" className="fr-btn fr-btn-small" onClick={() => openGroupPlan(group)}><CalendarPlus size={14} /> Plan together</button>}
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
                  <div className="fr-privacy-row-top">
                    <span className="fr-privacy-label">Privacy</span>
                    <div className="fr-privacy-picker" role="radiogroup" aria-label="Group privacy">
                      {[
                        { key: "private", Icon: Lock,  label: "Private",  desc: "Only you" },
                        { key: "shared",  Icon: Users, label: "Members",  desc: "Group members" },
                        { key: "global",  Icon: Globe, label: "Global",   desc: "All friends" },
                      ].map(({ key, Icon, label, desc }) => (
                        <button
                          key={key}
                          type="button"
                          className={`fr-privacy-opt fr-privacy-opt-${key} ${(group.visibility || "private") === key ? "on" : ""}`}
                          onClick={() => handleSetGroupPrivacy(group, key)}
                          disabled={sharingGroupId === group.id}
                          title={desc}
                          role="radio"
                          aria-checked={(group.visibility || "private") === key}
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
                  <div className="fr-privacy-hint">
                    {(group.visibility || "private") === "private" && (
                      <>
                        <Lock size={12} style={{ flexShrink: 0, opacity: 0.8 }} />
                        <span><strong>Private</strong> — only visible to you on your schedule.</span>
                      </>
                    )}
                    {(group.visibility || "private") === "shared" && (
                      <>
                        <Users size={12} style={{ flexShrink: 0, opacity: 0.8 }} />
                        <span><strong>Members</strong> — shared with group members. Enables live schedule compare & group chat.</span>
                      </>
                    )}
                    {(group.visibility || "private") === "global" && (
                      <>
                        <Globe size={12} style={{ flexShrink: 0, opacity: 0.8 }} />
                        <span><strong>Global</strong> — visible to all your friends on Campus.</span>
                      </>
                    )}
                  </div>
                </div>
                <p className="fr-group-body-label">Tap friends to add or remove them. Choose Members above to share the group with selected friends:</p>
                {friends.length === 0 ? (
                  <EmptyState compact icon={UserPlus} sub="No friends yet. Share an invite link below to add classmates." />
                ) : (
                  <div className="fr-group-members">
                    {friends.map(f => {
                      const inGroup = (group.memberIds || []).includes(f.id);
                      return (
                        <button
                          key={f.id}
                          type="button"
                          className={`fr-member-chip ${inGroup ? "in" : ""}`}
                          onClick={() => handleToggleFriendInGroup(group.id, f.id)}
                          title={inGroup ? `Remove ${f.name} from group` : `Add ${f.name} to group`}
                        >
                          {f.imageUrl ? (
                            <img src={f.imageUrl} alt="" className="fr-member-initial" style={{ width: 24, height: 24, padding: 0, objectFit: 'cover' }} />
                          ) : (
                            <span className="fr-member-initial">{f.name[0]?.toUpperCase()}</span>
                          )}
                          <span>{f.name}</span>
                          {inGroup && <Check size={12} strokeWidth={2.8} className="fr-member-check" />}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="fr-group-invite-box">
                  <strong>Invite classmates by link</strong>
                  <p>Anyone with the link can request to join. You approve each request.</p>
                  <div className="fr-group-invite-actions">
                    <button className="fr-btn fr-btn-secondary fr-btn-small" disabled={inviteBusy} onClick={() => createGroupLink(group)}>
                      <Link2 size={13} /> {inviteLinks[group.id] ? "Copy invite link" : "Create invite link"}
                    </button>
                    {inviteLinks[group.id] && <input className="fr-add-input" readOnly aria-label="Group invite link" value={groupInviteUrl(inviteLinks[group.id])} onFocus={e => e.target.select()} />}
                    <button className="fr-btn fr-btn-small" onClick={() => openGroupMembers(group)}><RefreshCw size={13} /> Check requests</button>
                  </div>
                  {(group.inviteMembers || []).length > 0 && <p>Joined by link: {(group.inviteMembers || []).map(m => m.name).join(", ")}</p>}
                  {(groupRequests[group.id] || []).filter(r => r.status === "pending").map(request => (
                    <div className="fr-group-request" key={request.userId}>
                      <span>{request.name} wants to join</span>
                      <button className="fr-btn fr-btn-primary fr-btn-small" disabled={inviteBusy} onClick={() => reviewGroupRequest(group, request, true)}>Approve</button>
                      <button className="fr-btn fr-btn-small" disabled={inviteBusy} onClick={() => reviewGroupRequest(group, request, false)}>Decline</button>
                    </div>
                  ))}
                </div>
                <div className="fr-group-body-footer">
                  {meetupsEnabled && memberCount >= 1 && <button type="button" className="fr-btn fr-btn-small" onClick={() => openGroupPlan(group)}><CalendarPlus size={14} /> Plan together</button>}
                  <button className="fr-btn fr-btn-primary" style={{ padding: "6px 14px", fontSize: 12.5 }} onClick={e => { e.stopPropagation(); setExpandedGroup(null); showToast("Changes saved", "success"); }}>
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
                      <Trash2 size={13} /> Delete group
                    </button>
                  )}
                </div>
                
                {(group.visibility === "shared" || group.visibility === "global" || (group.inviteMembers || []).length > 0) && (
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

      {/* ── Status Modal ── */}
      {showStatusModal && (
        <StatusModal current={myStatus} onSave={handleSaveStatus} onClose={() => setShowStatusModal(false)} />
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

      {/* ── Add people sheet ── */}
      {showConnectModal && (
        <div className="fr-modal-backdrop" onClick={() => setShowConnectModal(false)}>
          <div className="fr-connect-modal" role="dialog" aria-modal="true" aria-labelledby="fr-connect-title" onClick={e => e.stopPropagation()}>
            <div className="fr-connect-head">
              <div>
                <span className="fr-eyebrow">Grow your circle</span>
                <h2 id="fr-connect-title">Add people</h2>
                <p>Find classmates, share your invite, or paste a friend&rsquo;s code.</p>
              </div>
              <button className="fr-modal-close" onClick={() => setShowConnectModal(false)} aria-label="Close add people">
                <X size={18} />
              </button>
            </div>

            <button className="fr-connect-directory" onClick={() => { setShowConnectModal(false); openDirectory(); }}>
              <span className="fr-connect-icon"><Search size={18} /></span>
              <span><strong>Find classmates</strong><small>Browse students and see shared courses</small></span>
              <ChevronRight size={18} />
            </button>

            <div className="fr-connect-grid">
              <div className="fr-connect-panel">
                <span className="fr-connect-label">Your invite</span>
                {isGenerating ? (
                  <p className="fr-share-empty">Generating secure share code...</p>
                ) : myCode ? (
                  <>
                    <div className="fr-code-display"><span className="fr-code-text">{myCodeDisplay}</span></div>
                    <div className="fr-share-actions">
                      <button className="fr-btn fr-btn-primary" onClick={copyCode}><Copy size={15} /> Copy code</button>
                      <button className="fr-btn fr-btn-secondary" onClick={copyLink}><Link2 size={15} /> Copy link</button>
                    </div>
                  </>
                ) : (
                  <p className="fr-share-empty">Complete your course setup first to share your schedule.</p>
                )}
              </div>
              <div className="fr-connect-panel">
                <span className="fr-connect-label">Have an invite?</span>
                <p className="fr-connect-help">Paste a code or invite link to add someone directly.</p>
                <div className="fr-add-row">
                  <input
                    className="fr-add-input"
                    type="text"
                    aria-label="Friend invite code or link"
                    placeholder="Paste code or invite link"
                    value={addCode}
                    onChange={e => { setAddCode(e.target.value); setAddError(""); }}
                    onKeyDown={e => e.key === "Enter" && handleAddFriend()}
                    autoFocus
                  />
                  <button className="fr-btn fr-btn-primary fr-btn-add" onClick={handleAddFriend} disabled={!addCode.trim() || isAdding}>
                    {isAdding ? "Adding…" : "Add"}
                  </button>
                </div>
                {addError && <p className="fr-add-error">{addError}</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Header ── */}
      <header className="fr-workspace-head">
        <div className="fr-workspace-copy">
          <span className="fr-eyebrow">Campus connections</span>
          <h1>Social</h1>
          <p>See who&rsquo;s free, compare schedules, and keep your study circles moving.</p>
          <div className="fr-workspace-metrics" aria-label="Social summary">
            <span><strong>{friends.length}</strong> friends</span>
            <span><strong>{groups.length}</strong> groups</span>
            <span className="is-live"><i /> <strong>{freeNowFriends.length}</strong> free now</span>
          </div>
        </div>
        <div className="fr-workspace-actions">
          <button className="fr-btn fr-btn-primary fr-add-people-btn" onClick={() => setShowConnectModal(true)}>
            <UserPlus size={16} /> Add people
          </button>
          {statusEnabled && (
            <button
              className={`fr-btn fr-btn-secondary fr-btn-small fr-status-chip ${myStatus ? "has-status" : ""}`}
              onClick={() => setShowStatusModal(true)}
              title={myStatus ? `${myStatus.text} · till ${fmtStatusUntil(myStatus.until)}` : "Set a status your friends can see"}
            >
              {myStatus
                ? <><span className="fr-status-chip-emoji"><StatusIcon id={myStatus.id} size={14} /></span><span>{myStatus.text}</span></>
                : <><Smile size={14} /><span>Set status</span></>}
            </button>
          )}
          {friends.length > 0 && (
            <button
              className="fr-btn fr-btn-secondary fr-btn-small"
              onClick={() => handleRefreshFriend("all")}
              disabled={!!syncingFriendId}
              aria-label="Sync all friends"
            >
              <RefreshCw size={14} className={syncingFriendId ? "spin-icon" : ""} />
              <span>Sync all</span>
            </button>
          )}
        </div>
      </header>

      <nav className="fr-view-tabs" aria-label="Social sections">
        {SOCIAL_VIEW_ITEMS.map(({ id, label }) => {
          const Icon = id === "overview" ? LayoutDashboard : id === "friends" ? UserPlus : Users;
          const count = id === "friends" ? friends.length : id === "groups" ? groups.length : null;
          return (
          <button
            key={id}
            type="button"
            className={socialView === id ? "is-active" : ""}
            aria-current={socialView === id ? "page" : undefined}
            onClick={() => setSocialView(id)}
          >
            <Icon size={15} /> {label}{typeof count === "number" && <span>{count}</span>}
          </button>
          );
        })}
      </nav>

      {/* ── Plans (meetups) ── */}
      {socialView === "overview" && meetupsEnabled && (
        <MeetupsStrip
          userId={userId}
          userName={userName}
          friends={friends}
          draft={planDraft || groupPlanDraft}
          onDraftConsumed={() => { setGroupPlanDraft(null); onPlanDraftConsumed?.(); }}
          showToast={showToast}
        />
      )}

      {socialView === "overview" && (
        <div className="fr-overview-grid fr-tab-pane">
          {incomingRequests.length > 0 && (
            <section className="fr-overview-card fr-requests-card">
              <div className="fr-overview-card-head">
                <div><span className="fr-card-kicker">Requests</span><h2>People waiting to connect</h2></div>
                <span className="fr-count-badge">{incomingRequests.length}</span>
              </div>
              <div className="fr-request-list">
                {incomingRequests.map(item => (
                  <IncomingRequestItem
                    key={item.id}
                    item={item}
                    onAccept={onAcceptFriend}
                    onDecline={onDeclineFriend}
                    variant="card"
                  />
                ))}
              </div>
            </section>
          )}

          <section className="fr-overview-card fr-free-card">
            <div className="fr-overview-card-head">
              <div><span className="fr-card-kicker fr-live-kicker"><i /> Available now</span><h2>Friends you can catch up with</h2></div>
              <button className="fr-text-button" onClick={() => { setFriendFilter("free"); setSocialView("friends"); }}>View all <ArrowRight size={13} /></button>
            </div>
            {freeNowFriends.length > 0 ? (
              <div className="fr-people-preview">
                {freeNowFriends.slice(0, 3).map(friend => renderFriendCard(friend, true))}
              </div>
            ) : (
              <div className="fr-quiet-empty"><Coffee size={20} /><span>No friends are showing as free right now.</span></div>
            )}
          </section>

          <section className="fr-overview-card fr-circle-card">
            <div className="fr-overview-card-head">
              <div><span className="fr-card-kicker">Study circles</span><h2>Your groups</h2></div>
              <button className="fr-text-button" onClick={() => setSocialView("groups")}>View all <ArrowRight size={13} /></button>
            </div>
            {groups.length > 0 ? (
              <div className="fr-overview-groups">
                {groups.slice(0, 3).map(group => renderGroupCard(group, true))}
              </div>
            ) : (
              <div className="fr-quiet-empty"><Users size={20} /><span>Create a group to compare several schedules together.</span></div>
            )}
          </section>

          {onOpenLeave && (
            <button type="button" className="fr-overview-card fr-leave-card" onClick={onOpenLeave}>
              <span className="fr-leave-cta-icon"><CalendarOff size={19} /></span>
              <span><strong>Planning time away?</strong><small>Check what you&rsquo;ll miss before you go.</small></span>
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      )}

      <div className="fr-layout">
      <div className="fr-left-col">

      {/* ── Groups ── */}
      {socialView === "groups" && (
      <section className="fr-groups-section fr-sec-groups">
        {joinPreview && <div className="fr-group-invite-box fr-group-join-preview">
          {joinPreview.invalid ? <p>{inviteError}</p> : <>
            <strong>Join {joinPreview.groupName}</strong>
            <p>Study circle by {joinPreview.ownerName}. The owner approves join requests.</p>
            {joinPreview.status === "new" && <button className="fr-btn fr-btn-primary fr-btn-small" disabled={inviteBusy} onClick={requestGroupJoin}>Request to join</button>}
            {joinPreview.status === "pending" && <p>Request pending approval</p>}
            {joinPreview.status === "approved" && <p>You are a member. Refresh to see the group if it is not listed yet.</p>}
            {joinPreview.status === "owner" && <p>This is your group.</p>}
            {joinPreview.status === "declined" && <button className="fr-btn fr-btn-primary fr-btn-small" disabled={inviteBusy} onClick={requestGroupJoin}>Request again</button>}
            {inviteError && <p role="alert">{inviteError}</p>}
          </>}
          <button className="fr-btn fr-btn-small" onClick={() => { setJoinPreview(null); onGroupInviteConsumed?.(); }}>Dismiss</button>
        </div>}
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
          <EmptyState
            icon={Users}
            title="No groups yet"
            sub="Compare schedules with multiple friends at once."
            action={
              <button className="fr-btn fr-btn-primary fr-empty-cta" onClick={() => setShowNewGroup(true)}>
                <Plus size={14} /> Create your first group
              </button>
            }
          />
        ) : (
          <div className="fr-group-list">
            {groups.map(group => renderGroupCard(group, false))}
          </div>
        )}

      </section>
      )}

      {/* ── Incoming Requests ── */}
      {socialView === "friends" && incomingRequests.length > 0 && (
        <div className="fr-incoming-requests">
          <div className="fr-incoming-label"><UserPlus size={12} /> Incoming Requests</div>
          {incomingRequests.map(item => (
            <div key={item.id} className="fr-incoming-row">
              <div className="fr-incoming-avatar">{(item.name || "?")[0].toUpperCase()}</div>
              <span className="fr-incoming-name">{item.name}</span>
              <div className="fr-incoming-actions">
                <button className="fr-incoming-btn fr-incoming-accept" onClick={e => { e.stopPropagation(); onAcceptFriend?.(item); }} title="Accept">
                  <Check size={12} strokeWidth={2.8} />
                </button>
                <button className="fr-incoming-btn fr-incoming-decline" onClick={e => { e.stopPropagation(); onDeclineFriend?.(item); }} title="Decline">
                  <X size={12} strokeWidth={2.8} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Saved Friends ── */}
      {socialView === "friends" && (
      <section className="fr-friends-section fr-sec-friends">
        <div className="fr-section-header">
          <h3 className="fr-section-title">
            Your friends
            {friends.length > 0 && <span style={{ fontSize: 11, background: "rgba(0,0,0,0.05)", padding: "2px 8px", borderRadius: 10, color: "var(--muted)", fontWeight: 600 }}>{friends.length}</span>}
          </h3>
          <button className="fr-btn fr-btn-secondary fr-btn-small" onClick={() => setShowConnectModal(true)}>
            <UserPlus size={14} /> Add people
          </button>
        </div>
        {friends.length > 0 && (
          <div className="fr-friend-tools">
            <label className="fr-friend-search">
              <Search size={15} />
              <input value={workspaceSearch} onChange={e => setWorkspaceSearch(e.target.value)} placeholder="Search friends" aria-label="Search friends" />
            </label>
            <div className="fr-filter-row" aria-label="Filter friends">
              {[
                ["all", "All"], ["free", "Free now"], ["busy", "Busy"], ["favourites", "Favourites"],
              ].map(([id, label]) => (
                <button key={id} type="button" className={friendFilter === id ? "is-active" : ""} onClick={() => setFriendFilter(id)}>{label}</button>
              ))}
            </div>
          </div>
        )}
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
            <span>Find classmates or share your invite to start comparing schedules.</span>
            <button
              className="fr-btn fr-btn-primary fr-empty-cta"
              onClick={openDirectory}
            >
              <UserPlus size={14} /> Find classmates
            </button>
          </div>
        ) : filteredWorkspaceFriends.length === 0 ? (
          <div className="fr-quiet-empty fr-filter-empty"><Search size={20} /><span>No friends match this view.</span></div>
        ) : (
          <div className="fr-friend-list">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={filteredWorkspaceFriends.filter(f => f.isFavourite).map(f => f.id)} strategy={verticalListSortingStrategy}>
                {filteredWorkspaceFriends.map(f =>
                  f.isFavourite 
                    ? <SortableFriendItem key={f.id} f={f} renderFriendCard={renderFriendCard} isCompact={false} />
                    : renderFriendCard(f, false)
                )}
              </SortableContext>
            </DndContext>
          </div>
        )}
        
      </section>
      )}

      </div>{/* /fr-left-col */}
      <div className="fr-right-col">

      {/* ── Suggested Study Buddies ── */}
      {socialView === "friends" && (
      <section className="fr-friends-section fr-sec-buddies fr-tab-pane" style={{ marginBottom: 24 }}>
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
      )}


      </div>{/* /fr-right-col */}
      </div>{/* /fr-layout */}
    </div>
  );
}

import { useState, useEffect } from "react";
import { Copy, Link2, UserPlus, Users, Trash2, ArrowRight, Plus, X, ChevronDown, ChevronUp, RefreshCw, Bell, Globe, Lock, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

const AVATAR_PALETTE = [
  ["#7C3AED", "#A855F7"],
  ["#2563EB", "#60A5FA"],
  ["#0D9488", "#2DD4BF"],
  ["#DC2626", "#FB7185"],
  ["#D97706", "#FBBF24"],
  ["#4338CA", "#818CF8"],
];
function avatarGradient(name) {
  const idx = [...(name || "?")].reduce((h, c) => h + c.charCodeAt(0), 0) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx];
}
import {
  decodeSchedule, codeDisplayPart, buildShareUrl,
  saveFriend, removeFriend as removeFriendFromStore,
  loadGroups, createGroup, removeGroup as removeGroupFromStore, updateGroup,
  getOrCreateShareCode, pushFriendsToCloud, pushGroupsToCloud,
  refreshFriendCoursesFromCloud, sendFriendPing,
  shareGroupWithMembers, unshareGroupFromMembers,
} from "../lib/friends.js";

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

function toMinFP(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function ymdFP(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function FriendsPanel({
  userId, userName, enrolled, legend, friends, setFriends,
  groups, setGroups, myClasses, allClasses, now, onCompare, onGroupCompare,
  notifications = [], onDismissNotifs, onMarkRead, onMarkAllRead,
}) {
  const [addCode, setAddCode] = useState("");
  const [addError, setAddError] = useState("");
  const [toast, setToast] = useState(null); // { message, type, action? }
  const [pendingDelete, setPendingDelete] = useState(null); // { id, timeoutId }
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [addToGroupId, setAddToGroupId] = useState(null);

  const [notifOpen, setNotifOpen] = useState(false);
  const [myCode, setMyCode] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [syncingFriendId, setSyncingFriendId] = useState(null);
  const [sharingGroupId, setSharingGroupId] = useState(null);
  // Show skeleton only when no local friends and still might be syncing from cloud
  const [initialLoading, setInitialLoading] = useState(friends.length === 0);
  useEffect(() => {
    if (friends.length > 0) { setInitialLoading(false); return; }
    const t = setTimeout(() => setInitialLoading(false), 1400);
    return () => clearTimeout(t);
  }, [friends.length]);

  const showToast = (message, type = "success", action = null) => setToast({ message, type, action });

  useEffect(() => {
    if (!userId) return;
    setIsGenerating(true);
    getOrCreateShareCode(userId, userName || "User").then(code => {
      setMyCode(code);
      setIsGenerating(false);
    });
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

  function copyCode() {
    if (!myCode) return;
    navigator.clipboard.writeText(myCode).then(() => {
      showToast("Code copied!", "success");
    }).catch(() => showToast("Failed to copy", "error"));
  }

  function copyLink() {
    if (!myCode) return;
    navigator.clipboard.writeText(buildShareUrl(myCode)).then(() => {
      showToast("Link copied!", "success");
    }).catch(() => showToast("Failed to copy", "error"));
  }

  async function handleAddFriend() {
    setAddError("");
    let input = addCode.trim();
    if (!input) return;

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
      return;
    }

    if (decoded.id && friends.some(f => f.cloudId === decoded.id)) {
      setAddError("You're already friends with this person.");
      return;
    }

    if (decoded.id && myCode) {
      // Cloud user: send a friend request — they must accept before either side is added
      await sendFriendPing(decoded.id, userId, userName, { type: "friend_request", fromCode: myCode });
      setAddCode("");
      showToast(`Friend request sent to ${decoded.name}!`, "success");
    } else {
      // Local/offline code: no request flow possible, add immediately
      const updated = saveFriend(decoded.name, decoded.courses, decoded.id);
      setFriends(updated);
      pushFriendsToCloud(userId, updated);
      setAddCode("");
      showToast(`Added ${decoded.name}!`, "success");
      if (decoded.id) sendFriendPing(decoded.id, userId, userName);
    }
  }

  async function handleAcceptRequest(item) {
    if (!item.meta?.fromCode) { showToast("Request data missing", "error"); return; }
    const decoded = await decodeSchedule(item.meta.fromCode);
    if (!decoded) { showToast("Could not fetch friend's schedule", "error"); return; }
    const updated = saveFriend(decoded.name, decoded.courses, decoded.id);
    setFriends(updated);
    pushFriendsToCloud(userId, updated);
    if (myCode) {
      await sendFriendPing(item.fromId, userId, userName, { type: "friend_accepted", fromCode: myCode });
    }
    showToast(`You're now friends with ${decoded.name}!`, "success");
    onDismissNotifs?.();
    setNotifOpen(false);
  }

  function handleDeclineRequest(item) {
    onDismissNotifs?.();
    setNotifOpen(false);
  }

  function handleRemoveFriend(id) {
    const updated = removeFriendFromStore(id);
    setFriends(updated);
    pushFriendsToCloud(userId, updated);
  }

  async function handleRefreshFriend(id) {
    setSyncingFriendId(id);
    const updated = await refreshFriendCoursesFromCloud(friends);
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

  return (
    <div className="fr-page">
      {toast && <Toast message={toast.message} type={toast.type} action={toast.action} onDone={() => setToast(null)} />}

      {/* ── Page Header + Bell ── */}
      <div className="fr-page-hdr">
        <h2 className="fr-page-hdr-title">Friends</h2>
        <div className="fr-bell-wrap">
          <button
            className={`fr-bell-btn${notifOpen ? " open" : ""}`}
            onClick={() => setNotifOpen(o => !o)}
            aria-label="Friend notifications"
          >
            <Bell size={17} />
            {notifications.some(n => !n.isRead) && <span className="fr-bell-dot" />}
          </button>
          {notifOpen && (
            <>
            <div className="notif-backdrop" onClick={() => setNotifOpen(false)} />
            <div className="fr-bell-panel">
              <div className="fr-bell-panel-head">
                <span className="fr-bell-panel-title">Notifications</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {notifications.some(n => !n.isRead)
                    ? <button className="rc-mark-all" onClick={() => { onMarkAllRead?.(); }}>Mark all read</button>
                    : <span className="rc-all-read">All caught up</span>
                  }
                  <button className="fr-btn-icon" onClick={() => setNotifOpen(false)} aria-label="Close"><X size={13} /></button>
                </div>
              </div>
              {notifications.length === 0 ? (
                <p className="fr-bell-empty">No new notifications</p>
              ) : (
                notifications.map(item => (
                  <div
                    key={item.id}
                    className={`fr-ping-card${item.isRead ? " fr-ping-read" : ""}`}
                    onClick={() => item.kind !== "friend_request" && onMarkRead?.(item.pingId)}
                    style={{ cursor: item.kind !== "friend_request" ? "pointer" : "default" }}
                  >
                    <div className="fr-ping-avatar">{(item.name || "?")[0].toUpperCase()}</div>
                    <div className="fr-ping-text">
                      <span className="fr-ping-name">{item.text}</span>
                      {item.kind === "friend_request" && (
                        <div className="fr-ping-actions">
                          <button className="fr-btn fr-btn-primary fr-btn-small" onClick={e => { e.stopPropagation(); handleAcceptRequest(item); }}>Accept</button>
                          <button className="fr-btn fr-btn-small" onClick={e => { e.stopPropagation(); handleDeclineRequest(item); }}>Decline</button>
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flex: "none" }}>
                      <span className="fr-ping-time">{timeAgo(item.ts)}</span>
                      {item.isRead && <span className="rc-read-check">✓</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
            </>
          )}
        </div>
      </div>

      <div className="fr-layout">
      <div className="fr-left-col">
      {/* ── Share Your Schedule ── */}
      <section className="fr-share-card">
        <div className="fr-share-head">
          <h2>Share Your Schedule</h2>
          <span className="fr-share-sub">{courseCount} courses enrolled</span>
        </div>
        {isGenerating ? (
          <p className="fr-share-empty">Generating secure share code...</p>
        ) : myCode ? (
          <>
            <div className="fr-code-display">
              <span className="fr-code-text">{myCodeDisplay}</span>
            </div>
            <div className="fr-share-actions" style={{ marginTop: 12 }}>
              <button className="fr-btn fr-btn-primary" onClick={copyCode} style={{ flex: 1, justifyContent: "center", padding: "10px", fontSize: "14px" }}>
                <Copy size={16} /> Copy Code
              </button>
              <button className="fr-btn fr-btn-secondary" onClick={copyLink} style={{ flex: 1, justifyContent: "center", padding: "10px", fontSize: "14px" }}>
                <Link2 size={16} /> Copy Link
              </button>
            </div>
            <p className="fr-share-note" style={{ fontSize: "12px", color: "var(--muted)", marginTop: "12px", textAlign: "center" }}>
              Your friend can enter this code manually or open your invite link.
            </p>
          </>
        ) : (
          <p className="fr-share-empty">Complete your course setup first to share your schedule.</p>
        )}
      </section>

      {/* ── Add a Friend ── */}
      <section className="fr-add-section">
        <h3 className="fr-section-title"><UserPlus size={15} /> Add a Friend</h3>
        <div className="fr-add-row">
          <input
            className="fr-add-input"
            type="text"
            placeholder="Paste friend's invite link here..."
            value={addCode}
            onChange={e => { setAddCode(e.target.value); setAddError(""); }}
            onKeyDown={e => e.key === "Enter" && handleAddFriend()}
          />
          <button className="fr-btn fr-btn-primary fr-btn-add" onClick={handleAddFriend} disabled={!addCode.trim() || isAdding}>
            {isAdding ? "Searching..." : "Add"}
          </button>
        </div>
        {addError && <p className="fr-add-error">{addError}</p>}
      </section>

      {/* ── Groups ── */}
      <section className="fr-groups-section">
        <div className="fr-section-header">
          <h3 className="fr-section-title"><Users size={15} /> Groups</h3>
          <button className="fr-btn fr-btn-small" onClick={() => setShowNewGroup(s => !s)}>
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
            {groups.map(group => {
              const memberCount = (group.memberIds || []).length;
              const isExpanded = expandedGroup === group.id;

              const displayMembers = group.isReceived
                ? (group.cloudMemberIds || [])
                    .filter(cid => cid !== userId)
                    .map(cid => friends.find(f => f.cloudId === cid))
                    .filter(Boolean)
                : friends.filter(f => (group.memberIds || []).includes(f.id));

              const displayCount = group.isReceived ? displayMembers.length : memberCount;

              return (
                <div key={group.id} className={`fr-group-card ${group.isReceived ? "fr-group-received" : ""}`}>
                  <div className="fr-group-head" onClick={() => setExpandedGroup(isExpanded ? null : group.id)}>
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
                      {!group.isReceived && (
                        <span className={`fr-privacy-badge fr-privacy-badge-${group.visibility || "private"}`}>
                          {group.visibility === "global" ? <Globe size={11} /> : group.visibility === "shared" ? <Users size={11} /> : <Lock size={11} />}
                          {group.visibility === "global" ? "Global" : group.visibility === "shared" ? "Members" : "Private"}
                        </span>
                      )}
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                  {isExpanded && (
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
                          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
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
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      </div>{/* /fr-left-col */}
      <div className="fr-right-col">
      {/* ── Saved Friends ── */}
      <section className="fr-friends-section">
        <h3 className="fr-section-title">Saved Friends</h3>
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
              onClick={() => document.querySelector(".fr-add-input")?.focus()}
            >
              <UserPlus size={14} /> Add your first friend
            </button>
          </div>
        ) : (
          <div className="fr-friend-list">
            {friends.map(f => {
              const fCourseCount = Object.keys(f.courses || {}).length;
              const [c1, c2] = avatarGradient(f.name);
              const status = getFriendStatusNow(f);
              return (
                <div key={f.id} className="fr-friend-card" style={{ '--accent': c1 }}>
                  <div className="fr-friend-avatar" style={{ background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`, boxShadow: `0 4px 10px ${c1}40` }}>
                    {f.name[0]?.toUpperCase()}
                  </div>
                  <div className="fr-friend-info">
                    <span className="fr-friend-name">{f.name}</span>
                    <div className="fr-friend-meta-row">
                      <span className="fr-friend-meta">{fCourseCount} course{fCourseCount !== 1 ? "s" : ""}</span>
                      {status && (
                        <span className={`fr-friend-status fr-friend-status-${status}`}>
                          <span className="fr-friend-status-dot" />
                          {status === "free" ? "Free now" : "In class"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="fr-friend-actions">
                    <button className="fr-btn fr-btn-compare" onClick={() => onCompare(f)}>
                      Compare <ArrowRight size={13} />
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
              );
            })}
          </div>
        )}
      </section>
      </div>{/* /fr-right-col */}
      </div>{/* /fr-layout */}
    </div>
  );
}

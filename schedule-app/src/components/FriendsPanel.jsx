import { useState, useEffect } from "react";
import { Copy, Link2, UserPlus, Users, Trash2, ArrowRight, Plus, X, ChevronDown, ChevronUp, RefreshCw, Bell, Globe, Lock } from "lucide-react";

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
  refreshFriendCoursesFromCloud, sendFriendPing, fetchAndClearFriendPings,
  shareGroupWithMembers, unshareGroupFromMembers,
} from "../lib/friends.js";

function Toast({ message, onDone }) {
  return (
    <div className="fr-toast" onAnimationEnd={onDone}>
      <span className="fr-toast-text">{message}</span>
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
}) {
  const [addCode, setAddCode] = useState("");
  const [addError, setAddError] = useState("");
  const [toast, setToast] = useState(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [addToGroupId, setAddToGroupId] = useState(null);

  const [myCode, setMyCode] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [syncingFriendId, setSyncingFriendId] = useState(null);
  const [sharingGroupId, setSharingGroupId] = useState(null);
  const [pings, setPings] = useState([]);

  // Generate the user's shareable code asynchronously
  useEffect(() => {
    if (!userId) return;
    setIsGenerating(true);
    getOrCreateShareCode(userId, userName || "User").then(code => {
      setMyCode(code);
      setIsGenerating(false);
    });
  }, [userId, userName]);

  // Fetch pings (who added you) on panel open
  useEffect(() => {
    if (!userId) return;
    fetchAndClearFriendPings(userId).then(data => {
      if (data.length) setPings(data);
    });
  }, [userId]);

  // Silently refresh all cloud-linked friends' courses on panel open
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
      setToast("Code copied!");
    }).catch(() => setToast("Failed to copy"));
  }

  function copyLink() {
    if (!myCode) return;
    navigator.clipboard.writeText(buildShareUrl(myCode)).then(() => {
      setToast("Link copied!");
    }).catch(() => setToast("Failed to copy"));
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
    const updated = saveFriend(decoded.name, decoded.courses, decoded.id);
    setFriends(updated);
    pushFriendsToCloud(userId, updated);
    setAddCode("");
    setToast(`Added ${decoded.name}!`);
    if (decoded.id) sendFriendPing(decoded.id, userId, userName);
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
      setToast("Schedule refreshed!");
    } else {
      setToast("Already up to date");
    }
  }

  function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    const updated = createGroup(newGroupName.trim());
    setGroups(updated);
    pushGroupsToCloud(userId, updated);
    setNewGroupName("");
    setShowNewGroup(false);
    setToast("Group created!");
  }

  async function handleRemoveGroup(id, isReceived = false) {
    if (!isReceived) {
      const group = groups.find(g => g.id === id);
      if ((group?.visibility === "shared" || group?.visibility === "global") && group.cloudMemberIds?.length) {
        await unshareGroupFromMembers(id, group.cloudMemberIds, userId);
      }
    }
    const updated = removeGroupFromStore(id);
    setGroups(updated);
    pushGroupsToCloud(userId, updated);
    setToast(isReceived ? "Left group" : "Group deleted");
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
    setSharingGroupId(group.id);

    if ((oldPrivacy === "shared" || oldPrivacy === "global") && group.cloudMemberIds?.length) {
      await unshareGroupFromMembers(group.id, group.cloudMemberIds, userId);
    }

    if (newPrivacy === "private") {
      const updated = updateGroup(group.id, { visibility: "private", cloudMemberIds: [] });
      setGroups(updated);
      pushGroupsToCloud(userId, updated);
      setToast("Group is now private");
    } else if (newPrivacy === "shared") {
      const targetFriends = friends.filter(f => (group.memberIds || []).includes(f.id));
      const cloudCount = targetFriends.filter(f => f.cloudId).length;
      if (!cloudCount) {
        setToast("No group members have accounts yet");
        setSharingGroupId(null);
        return;
      }
      const { cloudMemberIds } = await shareGroupWithMembers(userId, userName, group, targetFriends);
      const updated = updateGroup(group.id, { visibility: "shared", cloudMemberIds });
      setGroups(updated);
      pushGroupsToCloud(userId, updated);
      setToast(`Visible to ${cloudCount} group member${cloudCount !== 1 ? "s" : ""}`);
    } else if (newPrivacy === "global") {
      const cloudCount = friends.filter(f => f.cloudId).length;
      if (!cloudCount) {
        setToast("None of your friends have accounts yet");
        setSharingGroupId(null);
        return;
      }
      const { cloudMemberIds } = await shareGroupWithMembers(userId, userName, group, friends);
      const updated = updateGroup(group.id, { visibility: "global", cloudMemberIds });
      setGroups(updated);
      pushGroupsToCloud(userId, updated);
      setToast(`Visible to all ${cloudCount} friend${cloudCount !== 1 ? "s" : ""}`);
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
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {/* ── Incoming Pings ── */}
      {pings.length > 0 && (
        <section className="fr-pings-section">
          <div className="fr-pings-header">
            <span className="fr-pings-title"><Bell size={14} /> {pings.length} added you</span>
            <button className="fr-btn-icon" onClick={() => setPings([])} aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
          {pings.map((p, i) => (
            <div key={i} className="fr-ping-card">
              <div className="fr-ping-avatar">{(p.from_name || "?")[0].toUpperCase()}</div>
              <div className="fr-ping-text">
                <span className="fr-ping-name">{p.from_name}</span>
                <span className="fr-ping-sub">added you as a friend</span>
              </div>
              <span className="fr-ping-time">{timeAgo(p.created_at)}</span>
            </div>
          ))}
        </section>
      )}

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
          <p className="fr-empty">Create a group to compare schedules with multiple friends at once.</p>
        ) : (
          <div className="fr-group-list">
            {groups.map(group => {
              const memberCount = (group.memberIds || []).length;
              const isExpanded = expandedGroup === group.id;

              // For received groups: resolve members from the user's friends list by cloudId
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
                            <button className="fr-btn fr-btn-danger fr-btn-small" onClick={() => handleRemoveGroup(group.id, true)}>
                              <X size={14} /> Leave group
                            </button>
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
                            <p className="fr-empty">Add friends first, then add them to this group.</p>
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
                            <button className="fr-btn fr-btn-danger fr-btn-small" onClick={() => handleRemoveGroup(group.id)}>
                              <Trash2 size={14} /> Delete group
                            </button>
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
        {friends.length === 0 ? (
          <div className="fr-empty-state">
            <Users size={40} strokeWidth={1.2} />
            <p>No friends added yet</p>
            <span>Share your code with classmates or paste their code above to compare schedules.</span>
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

import { useState, useEffect } from "react";
import { Copy, Link2, UserPlus, Users, Trash2, ArrowRight, Plus, X, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";

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
  refreshFriendCoursesFromCloud,
} from "../lib/friends.js";

function Toast({ message, onDone }) {
  return (
    <div className="fr-toast" onAnimationEnd={onDone}>
      <span className="fr-toast-text">{message}</span>
    </div>
  );
}

export default function FriendsPanel({
  userId, userName, enrolled, legend, friends, setFriends,
  groups, setGroups, onCompare, onGroupCompare,
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

  // Generate the user's shareable code asynchronously
  useEffect(() => {
    if (!userId) return;
    setIsGenerating(true);
    getOrCreateShareCode(userId, userName || "User").then(code => {
      setMyCode(code);
      setIsGenerating(false);
    });
  }, [userId, userName]);

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

  function handleRemoveGroup(id) {
    const updated = removeGroupFromStore(id);
    setGroups(updated);
    pushGroupsToCloud(userId, updated);
  }

  function handleToggleFriendInGroup(groupId, friendId) {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const members = group.memberIds || [];
    const next = members.includes(friendId)
      ? members.filter(m => m !== friendId)
      : [...members, friendId];
    const updated = updateGroup(groupId, { memberIds: next });
    setGroups(updated);
    pushGroupsToCloud(userId, updated);
  }

  const courseCount = enrolled ? Object.keys(enrolled).length : 0;

  return (
    <div className="fr-page">
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

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
              return (
                <div key={group.id} className="fr-group-card">
                  <div className="fr-group-head" onClick={() => setExpandedGroup(isExpanded ? null : group.id)}>
                    <div className="fr-group-info">
                      <span className="fr-group-name">{group.name}</span>
                      <span className="fr-group-meta">{memberCount} member{memberCount !== 1 ? "s" : ""}</span>
                    </div>
                    {memberCount > 0 && (
                      <div className="fr-group-member-preview">
                        {friends.filter(f => (group.memberIds || []).includes(f.id)).slice(0, 4).map((f, fi) => {
                          const [c1] = avatarGradient(f.name);
                          return (
                            <div key={f.id} className="fr-group-avatar-dot" style={{ background: c1, zIndex: 10 - fi }}>
                              {f.name[0]?.toUpperCase()}
                            </div>
                          );
                        })}
                        {memberCount > 4 && (
                          <div className="fr-group-avatar-dot fr-group-avatar-more">+{memberCount - 4}</div>
                        )}
                      </div>
                    )}
                    <div className="fr-group-actions">
                      {memberCount >= 1 && (
                        <button className="fr-btn fr-btn-compare" onClick={e => { e.stopPropagation(); onGroupCompare(group); }}>
                          Compare <ArrowRight size={13} />
                        </button>
                      )}
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="fr-group-body">
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

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
              return (
                <div key={f.id} className="fr-friend-card" style={{ '--accent': c1 }}>
                  <div className="fr-friend-avatar" style={{ background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`, boxShadow: `0 4px 10px ${c1}40` }}>
                    {f.name[0]?.toUpperCase()}
                  </div>
                  <div className="fr-friend-info">
                    <span className="fr-friend-name">{f.name}</span>
                    <span className="fr-friend-meta">{fCourseCount} course{fCourseCount !== 1 ? "s" : ""}</span>
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
    </div>
  );
}

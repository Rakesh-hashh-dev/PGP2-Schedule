import { useState } from "react";
import { Copy, Link2, UserPlus, Users, Trash2, ArrowRight, Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import {
  encodeSchedule, decodeSchedule, codeDisplayPart, buildShareUrl,
  saveFriend, removeFriend as removeFriendFromStore,
  loadGroups, createGroup, removeGroup as removeGroupFromStore, updateGroup,
} from "../lib/friends.js";

function Toast({ message, onDone }) {
  return (
    <div className="fr-toast" onAnimationEnd={onDone}>
      <span className="fr-toast-text">{message}</span>
    </div>
  );
}

export default function FriendsPanel({
  userName, enrolled, legend, friends, setFriends,
  groups, setGroups, onCompare, onGroupCompare,
}) {
  const [addCode, setAddCode] = useState("");
  const [addError, setAddError] = useState("");
  const [toast, setToast] = useState(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [addToGroupId, setAddToGroupId] = useState(null);

  // Generate the user's shareable code
  const myCode = encodeSchedule(userName || "User", enrolled);
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

  function handleAddFriend() {
    setAddError("");
    if (!addCode.trim()) return;
    const decoded = decodeSchedule(addCode.trim());
    if (!decoded) {
      setAddError("Invalid code. Ask your friend to share their code again.");
      return;
    }
    const updated = saveFriend(decoded.name, decoded.courses);
    setFriends(updated);
    setAddCode("");
    setToast(`Added ${decoded.name}!`);
  }

  function handleRemoveFriend(id) {
    const updated = removeFriendFromStore(id);
    setFriends(updated);
  }

  function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    const updated = createGroup(newGroupName.trim());
    setGroups(updated);
    setNewGroupName("");
    setShowNewGroup(false);
    setToast("Group created!");
  }

  function handleRemoveGroup(id) {
    const updated = removeGroupFromStore(id);
    setGroups(updated);
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
        {myCode ? (
          <>
            <div className="fr-code-display">
              <span className="fr-code-text">{myCodeDisplay}</span>
            </div>
            <div className="fr-share-actions">
              <button className="fr-btn fr-btn-primary" onClick={copyCode}>
                <Copy size={14} /> Copy Code
              </button>
              <button className="fr-btn fr-btn-secondary" onClick={copyLink}>
                <Link2 size={14} /> Copy Link
              </button>
            </div>
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
            placeholder="Paste your friend's code here"
            value={addCode}
            onChange={e => { setAddCode(e.target.value); setAddError(""); }}
            onKeyDown={e => e.key === "Enter" && handleAddFriend()}
          />
          <button className="fr-btn fr-btn-primary fr-btn-add" onClick={handleAddFriend} disabled={!addCode.trim()}>
            Add
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
                      <button className="fr-btn fr-btn-danger fr-btn-small" onClick={() => handleRemoveGroup(group.id)}>
                        <Trash2 size={12} /> Delete group
                      </button>
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
              return (
                <div key={f.id} className="fr-friend-card">
                  <div className="fr-friend-avatar">{f.name[0]?.toUpperCase()}</div>
                  <div className="fr-friend-info">
                    <span className="fr-friend-name">{f.name}</span>
                    <span className="fr-friend-meta">{fCourseCount} courses</span>
                  </div>
                  <div className="fr-friend-actions">
                    <button className="fr-btn fr-btn-compare" onClick={() => onCompare(f)}>
                      Compare <ArrowRight size={13} />
                    </button>
                    <button className="fr-btn fr-btn-icon" onClick={() => handleRemoveFriend(f.id)} aria-label="Remove friend">
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

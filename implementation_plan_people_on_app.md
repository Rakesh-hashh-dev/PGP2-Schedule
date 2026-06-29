# User Discovery — "People on App" Popup

Add a **"Show"** button beside "Add a Friend" that opens a popup listing all registered users. Users can send friend requests inline, and the list dynamically reflects their existing friends list.

---

## How the Current Friends System Works

| Concept | Detail |
|---|---|
| **Share code** | Every user gets a unique code (e.g. `RAK-X8M2`) stored in the `share_codes` Supabase table |
| **Add friend** | User pastes a code/link → `decodeSchedule()` fetches the target's profile → `sendFriendPing()` sends a friend request |
| **Accept request** | The target sees a notification → accepts → both sides are linked via `saveFriend()` |
| **Remove friend** | `removeFriendFromStore()` removes locally and sends a `friend_removed` ping to the other user |

The popup will plug into this **exact same** `sendFriendPing` / `decodeSchedule` flow — no new backend tables needed.

---

## Proposed Changes

### `src/lib/friends.js` — [MODIFY]
Add a new exported function:
```js
export async function fetchAllUsers(currentUserId) {
  // Joins share_codes with profiles to get name, user_id, and code for all users
  // Excludes the current user
}
```
This queries:
- `share_codes` → gets all codes + user_ids
- `profiles` → gets `_name` for display
- Filters out `currentUserId`

---

### `src/components/FriendsPanel.jsx` — [MODIFY]

**1. State additions:**
```js
const [showPeoplePopup, setShowPeoplePopup] = useState(false);
const [allUsers, setAllUsers] = useState([]);         // fetched list
const [usersLoading, setUsersLoading] = useState(false);
const [peopleSearch, setPeopleSearch] = useState(""); // search filter
const [requestingId, setRequestingId] = useState(null); // loading state per user
```

**2. Fetch logic:**
- On clicking "Show", call `fetchAllUsers(userId)` and populate `allUsers`
- Each user row computes its status:
  - `"friend"` → their `user_id` matches a `cloudId` in `friends[]`
  - `"requested"` → call `hasPendingFriendRequest(userId, targetUserId)` (or track locally after sending)
  - `"none"` → default, shows "Add" button

**3. UI changes — "Add a Friend" section (`L481–498`):**
- Add a small **"Show"** button beside the `<h3>` title (or beside the input row)
- Clicking opens the `<PeoplePopup>` modal

**4. New `<PeoplePopup>` inline component (or sub-component at bottom of file):**
```
┌─────────────────────────────────────┐
│  👥 People on App         [Search]  │
│  ─────────────────────────────────  │
│  [Avatar] Rakesh Sharma             │
│            Enrolled in 4 courses  [Already Added ✓] │
│                                     │
│  [Avatar] John Doe                  │
│            Enrolled in 3 courses  [Add →]           │
│                                     │
│  [Avatar] Jane Smith                │
│            Enrolled in 5 courses  [Request Sent]    │
└─────────────────────────────────────┘
```

**Button states:**
| State | Button |
|---|---|
| Not a friend | `Add →` (green) — clicking calls `sendFriendPing` |
| Request pending | `Request Sent` (grey, disabled) |
| Already a friend | `✓ Added` (muted, disabled) — clicking could trigger remove |

**If removed from friends list**, the user reappears in the popup with `Add →` state (since `friends[]` is the source of truth).

---

## Data Flow

```
Click "Show"
  → fetchAllUsers(userId)             [lib/friends.js — new function]
      → supabase: share_codes + profiles
  → renders popup with user list
  
Click "Add" on a user
  → hasPendingFriendRequest(...)      [existing — to check state]
  → sendFriendPing(targetId, ...)     [existing — reused]
  → locally mark as "requested"
  
Friend removed (from main list)
  → friends[] updates via setFriends
  → popup re-computes status — user shows "Add →" again
```

---

## Supabase Requirements

> [!IMPORTANT]
> The `share_codes` table must be **publicly readable** (RLS policy: `SELECT` for authenticated users) for the user list query to work. Double check this is already enabled — if not, a quick policy needs to be added in Supabase.

No new tables required.

---

## Open Questions

> [!NOTE]
> 1. **Privacy**: Should all registered users be discoverable, or only those who have opted in? (e.g. a "discoverable" toggle in profile settings)
> 2. **Name display**: The `_name` field in `profiles.courses` is used as the display name. Is this reliable for all users?
> 3. **Pagination**: There are currently ~69 users. A simple list is fine now, but should we add pagination at ~100+ users?

---

## Files to Change

| File | Change Type |
|---|---|
| `src/lib/friends.js` | Add `fetchAllUsers()` function |
| `src/components/FriendsPanel.jsx` | Add "Show" button + popup UI + state + logic |
| `src/styles.css` | Add popup/modal styles (`.fr-people-popup`, `.fr-people-card`, etc.) |

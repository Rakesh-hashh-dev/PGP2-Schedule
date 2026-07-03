# PGP2 Schedule — Project Memory

Live college schedule app for IIM Sambalpur PGP2 2025–27 term (15 Jun – 29 Aug 2026).

## Location
`F:\Web Dev\Antigravity\PGP2 Schedule\schedule-app\`

## Stack
Vite + React 19, `lucide-react`, `papaparse`, Supabase (DB + Realtime), Clerk (auth). No router — single page SPA. Deployed on Vercel.

---

## Supabase Tables

| Table | Key Columns |
|---|---|
| `profiles` | `user_id` (Clerk sub), `courses` (JSONB, includes `_name`), `friends` (JSONB array), `groups` (JSONB array) |
| `friend_pings` | `id`, `target_id`, `from_id`, `from_name` (JSON-encoded), `created_at` |
| `share_codes` | share code → user_id mapping |

## RLS Policies (as of 2026-06-23)
- `profiles`: SELECT open (`true`). INSERT/UPDATE/DELETE scoped to own row via `own_profile` (`jwt sub`).
- Cross-user group writes use `push_group_to_member(target_user_id, new_groups)` RPC (SECURITY DEFINER) — direct `UPDATE true` policy was dropped for security.
- `friend_pings`: SELECT/DELETE via `target_id = jwt sub`, INSERT via `from_id = jwt sub`
- `profiles` REPLICA IDENTITY set to FULL (required for realtime UPDATE filters)
- Both `profiles` and `friend_pings` are in `supabase_realtime` publication

---

## Friends System (`src/lib/friends.js`)

- Friends stored in `profiles.friends` JSONB array, scoped per user
- **Mutual friend request flow:**
  1. A sends `friend_request` ping to B
  2. B sees Accept/Decline in bell
  3. B accepts → decodes A's share code, adds A locally, sends `friend_accepted` ping with B's code
  4. A auto-adds B on receiving the accepted ping (both realtime and on-load)
- Ping `from_name` JSON shapes:
  - `{ name, type: "friend_request", fromCode }` — friend request
  - `{ name, type: "friend_accepted", fromCode }` — accepted
  - `{ name, group: "Group Name" }` — group invite
  - `"Plain string"` — legacy simple ping
- Pings persist **45 days** in Supabase (lazy cleanup on fetch)
- User name stored in `profiles.courses._name`

## Groups System

- Groups stored in `profiles.groups` JSONB array per user
- **Privacy options:**
  - `private` — owner only, nothing pushed to others
  - `shared` — pushed to explicitly added group members
  - `global` — pushed to all friends
- Sharing pushes a received copy (`isReceived: true`) to each member's profile via RPC + sends a bell ping
- Changing members on a shared group: unshares old list, re-shares to new list
- **Group delete has 8s Undo window** — cloud delete commits only after timeout; localStorage not touched until then

---

## Notifications System (`src/App.jsx`)

- **2-day display window:** `friendNotifItems` shows all pings from last 2 days regardless of read state
- **Per-item read tracking:**
  - `pgp2.read-ping-ids` (localStorage) — Set of read ping IDs
  - `pgp2.read-change-keys` (localStorage) — Set of read schedule change keys
- `unreadFriendCount` = items with `isRead: false` → drives red dot on bell
- Both the **main bell** and **Friends tab bell** support:
  - Click individual item → marks as read (dims to 45% opacity + ✓)
  - "Mark all read" button → clears everything
  - "All caught up" message when all read
  - Click outside panel (backdrop) → closes popup
- `friend_request` kind items are NOT click-to-dismiss — require explicit Accept/Decline

## Realtime Subscriptions (`src/App.jsx`)
- `profile-realtime-${userId}` — listens for `UPDATE` on `profiles` → updates groups + friends state live
- `pings-realtime-${userId}` — listens for `INSERT` on `friend_pings` → adds ping to state; if group invite, immediately re-fetches profile to get the new group

---

## Toast (Friends Tab Only)
- Duration: **7 seconds**, then fades out over 0.3s
- Supports optional **action button** (e.g. Undo)
- Group delete shows Undo button — restores from localStorage if clicked within 7s

---

## Key Files

| File | Purpose |
|---|---|
| `src/App.jsx` | Main state, realtime subscriptions, notification logic, mark-read functions |
| `src/lib/friends.js` | Friends/groups/pings CRUD, cloud sync, share code encoding |
| `src/lib/profile.js` | `pushProfile` — stores courses + name in `profiles` table |
| `src/components/FriendsPanel.jsx` | Full Friends UI: bell, groups, share codes, accept/decline |
| `src/components/RecentChanges.jsx` | Schedule change notifications (supports per-item read via `readKeys` prop) |
| `src/styles.css` | All styles: `.fr-ping-read`, `.rc-item-read`, `.fr-toast-action`, etc. |

---

## Useful Supabase Queries

```sql
-- Who added whom as friends (with names)
SELECT 
  p.user_id, p.courses->>'_name' AS student_name,
  f->>'name' AS added_friend_name,
  f->>'cloudId' AS friend_user_id,
  p2.courses->>'_name' AS friend_actual_name,
  f->>'addedAt' AS added_at
FROM profiles p
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.friends, '[]')) AS f
LEFT JOIN profiles p2 ON p2.user_id = (f->>'cloudId')
ORDER BY p.courses->>'_name';

-- Who owns / received which groups
SELECT
  p.user_id, p.courses->>'_name' AS user_name,
  g->>'name' AS group_name,
  g->>'visibility' AS visibility,
  CASE WHEN (g->>'isReceived')::boolean THEN 'received' ELSE 'owner' END AS role,
  g->>'ownerName' AS owner_name
FROM profiles p
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.groups, '[]')) AS g
ORDER BY g->>'name', role;
```

---

## Open Threads
1. **Vercel auto-deploy** — Connect `Rakesh-hashh-dev/PGP2-Schedule` in Vercel dashboard → Root Directory: `schedule-app`
2. **Google login** (parked) — Restrict to `@iimsambalpur.ac.in` via Google OAuth (`@react-oauth/google`, check `hd` claim)
3. **Live CSV feed** — Paste published-CSV URL into `SHEET_CSV_URL` in `lib/sheet.js` line 9
4. **PWA** — `manifest.webmanifest` + service worker for iPhone home screen
5. **Push notifications** — Daily digest + change alerts via Apps Script + Web Push

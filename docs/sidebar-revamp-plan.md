# Sidebar Revamp Plan — Icon-Accent Cards (v2)

> Status: **Parked** — design drafted, not shipped. Revert to original sidebar completed 2026-06-23.
> Resume this when doing the next UX polish pass.

---

## Concept

iOS-Settings-style icon chips per nav item. Each link gets a colored rounded-square background behind its icon, giving the sidebar a modern, app-like feel while keeping the dark theme consistent.

---

## Nav Item Chip Color Map

| Route     | Label         | Chip class     | Color (approx)         |
|-----------|---------------|----------------|------------------------|
| /         | Dashboard     | `chip-sky`     | Sky blue `#7dd3fc`     |
| /schedule | Schedule      | `chip-violet`  | Violet `#c4b5fd`       |
| /timeline | Timeline      | `chip-orange`  | Orange `#fdba74`       |
| /subjects | Subjects      | `chip-green`   | Teal-green `#6ee7b7`   |
| /attend   | Attendance    | `chip-red`     | Red-rose `#fca5a5`     |
| /grades   | Grades        | `chip-amber`   | Amber `#fcd34d`        |
| /peers    | Peers         | `chip-purple`  | Purple `#e9d5ff`       |
| live      | Live          | `chip-live`    | Live-green `#6ee7b7`   |

---

## Key CSS Pieces

### Icon chip (`.sb-ic`)

```css
.sb-ic {
  width: 30px; height: 30px; border-radius: 9px; flex: none;
  display: flex; align-items: center; justify-content: center;
  transition: transform .18s, background .18s, color .18s;
}

/* Color variants */
.chip-sky    .sb-ic { background: rgba(14,165,233,.22);  color: #7dd3fc; }
.chip-violet .sb-ic { background: rgba(109,91,208,.28);  color: #c4b5fd; }
.chip-orange .sb-ic { background: rgba(249,115,22,.22);  color: #fdba74; }
.chip-green  .sb-ic { background: rgba(16,185,129,.22);  color: #6ee7b7; }
.chip-red    .sb-ic { background: rgba(239,68,68,.22);   color: #fca5a5; }
.chip-amber  .sb-ic { background: rgba(245,158,11,.22);  color: #fcd34d; }
.chip-purple .sb-ic { background: rgba(168,85,247,.22);  color: #e9d5ff; }
.chip-live   .sb-ic { background: rgba(31,169,113,.22);  color: #6ee7b7; }

/* Active state: white chip */
.sb-link.on .sb-ic {
  background: rgba(255,255,255,.18); color: #fff;
  transform: scale(1.06);
}
```

### Active link — full gradient pill

```css
.sb-link.on {
  background: linear-gradient(135deg, rgba(109,91,208,.72) 0%, rgba(147,51,234,.5) 100%);
  color: #fff; font-weight: 600;
  box-shadow: 0 0 0 1px rgba(167,139,250,.2), 0 4px 24px rgba(109,91,208,.28), inset 0 1px 0 rgba(255,255,255,.12);
}
```

### JSX structure per link

```jsx
<button className={`sb-link chip-sky${tab === "dashboard" ? " on" : ""}`}
  onMouseEnter={e => showSbTip(e, "Dashboard")}
  onMouseLeave={hideSbTip}
  onClick={() => setTab("dashboard")}>
  <span className="sb-ic"><LayoutDashboard size={16} /></span>
  <span className="sb-link-label">Dashboard</span>
</button>
```

---

## Bottom Section — Utility Row (`.sb-util-row`)

Replaces the vertical `sb-action-group` with a horizontal strip of compact icon buttons.

```css
.sb-util-row {
  display: flex; align-items: center; gap: 4px; padding: 0 2px;
}
.sb-util-btn {
  display: inline-flex; align-items: center; justify-content: center;
  flex: 1; height: 36px; border-radius: 10px;
  border: none; background: rgba(255,255,255,.04);
  color: rgba(255,255,255,.45); cursor: pointer;
  transition: all .16s ease;
}
.sb-util-btn:hover {
  background: rgba(255,255,255,.09); color: rgba(255,255,255,.85);
  transform: translateY(-1px);
}
.sb-util-btn.sb-util-danger:hover { color: #fca5a5; background: rgba(239,68,68,.12); }
.sb-util-btn.sb-util-admin-on { color: var(--live); background: rgba(31,169,113,.1); }
```

Buttons in order: Settings · Refresh · Admin toggle · Sign out · Collapse toggle

**Collapsed state:** `flex-direction: column`, each button `width: 44px; height: 40px`

---

## Profile Card — Gradient Border (`.sb-profile-card`)

Wraps `.sb-avatar-wrap` in a card with an animated gradient border.

```css
.sb-profile-card {
  border-radius: 14px;
  background:
    linear-gradient(rgba(28,15,46,.9), rgba(13,5,24,.9)) padding-box,
    linear-gradient(135deg, rgba(109,91,208,.5), rgba(168,85,247,.25), rgba(109,91,208,.08)) border-box;
  border: 1px solid transparent;
  padding: 2px;
  transition: background .3s;
}
.sb-profile-card:hover {
  background:
    linear-gradient(rgba(28,15,46,.9), rgba(13,5,24,.9)) padding-box,
    linear-gradient(135deg, rgba(109,91,208,.75), rgba(168,85,247,.5), rgba(109,91,208,.2)) border-box;
}
/* Collapsed: strip the card shell */
.sidebar.collapsed .sb-profile-card { background: none; border-color: transparent; padding: 0; }
```

---

## Collapsed State Summary

| Element        | Collapsed behavior                                  |
|----------------|-----------------------------------------------------|
| `.sb-link`     | `justify-content: center; padding: 8px; gap: 0`     |
| `.sb-ic`       | Grows to `36×36px`, `border-radius: 11px`           |
| `.sb-link.on`  | Gradient background + soft glow box-shadow          |
| `.sb-util-row` | Stacks vertically, buttons become `44×40px`         |
| `.sb-profile-card` | No border/padding; avatar only                  |
| Tooltips       | `createPortal` fixed-position `.sb-float-tip` shown |

---

## Implementation Notes

- All tooltip behavior (`.sb-float-tip`, `showSbTip`/`hideSbTip`, `createPortal`) is already in place — no changes needed there.
- The `sbTip` state and helpers are already wired in `App.jsx`.
- When resuming: replace `.sb-action-group` / `.sb-toggle` JSX with `.sb-util-row` + `.sb-util-btn` buttons, and wrap `.sb-avatar-wrap` in `.sb-profile-card`.
- Bottom actions to fit in `.sb-util-row`: Settings (⚙), Refresh (↺), Admin (shield), Sign out (→), Collapse (←/→ arrow).

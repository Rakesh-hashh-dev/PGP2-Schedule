import { useNavView, scrollViewToTop } from "../lib/navView.js";

// One sidebar nav row, rendered from a NAV_ITEMS entry (see lib/navItems.js).
//
// This replaces 17 hand-written blocks that each repeated the same tooltip
// pair and the same select body. The markup below is byte-for-byte what those
// blocks produced, so every existing `.sb-link` rule — including the ~20
// `.sidebar.collapsed .*` overrides and the aurora skin — keeps applying.
//
// Must stay a DIRECT child of `.sb-nav`: the aurora entrance cascade selects
// `.sidebar.sb-aurora .sb-nav > *:nth-child(n)`, so any wrapper element here
// would silently kill the stagger.
//
// Active state comes from the nav store (lib/navView.js), so a click
// re-renders only the two links whose state flips, not the whole sidebar.
// `view` is the fallback for renders outside the app (tests).
export default function SbLink({ item, view, badge, count, onSelect, onIntent, showSbTip, hideSbTip }) {
  const Icon = item.icon;
  const navView = useNavView() ?? view;
  const active = Boolean(item.view) && navView === item.view;
  return (
    <button
      className={`sb-link${active ? " on" : ""}`}
      type="button"
      aria-label={`${item.label}${count > 0 ? `, ${count} unread` : ""}`}
      aria-current={active ? "page" : undefined}
      onFocus={e => { onIntent?.(); showSbTip(e, item.tip || item.label); }}
      onBlur={hideSbTip}
      onMouseEnter={e => { onIntent?.(); showSbTip(e, item.tip || item.label); }}
      onMouseLeave={hideSbTip}
      onPointerDown={() => onIntent?.()}
      onClick={() => { if (active) scrollViewToTop(); onSelect(item); hideSbTip(); }}
    >
      <Icon size={18} strokeWidth={1.85} aria-hidden="true" /><span className="sb-link-label">{item.label}</span>
      {badge && <> <span className="beta-badge">{badge}</span></>}
      {count > 0 && <span className="nav-badge">{count > 9 ? "9+" : count}</span>}
    </button>
  );
}

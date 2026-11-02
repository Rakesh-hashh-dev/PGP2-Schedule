import { it, expect, vi } from 'vitest';
// Exercise the drawer's event routing directly; browser layout is checked separately.
vi.mock('react', async importOriginal => ({ ...(await importOriginal()), useState: initial => [typeof initial === 'function' ? initial() : initial, vi.fn()], useRef: () => ({ current: null }), useLayoutEffect: () => {} }));
vi.mock('../lib/appControls.js', () => ({ useAppControls: () => ({ payload: { navigation: { items: {}, order: [] } } }) }));
import DesktopSidebar from './DesktopSidebar.jsx';
function find(node, type) {
  if (!node || typeof node !== 'object') return null;
  if (node.type === type) return node;
  for (const child of [node.props?.children].flat(Infinity)) { const found = find(child, type); if (found) return found; }
  return null;
}
it('keeps the tablet drawer mounted for the notification bell and its panel actions', () => {
  const close = vi.fn();
  const root = DesktopSidebar({ tabletSidebarOpen: true, tabletControls: true, onCloseTabletSidebar: close, activeQuickLinks: [], renderSbUtilStrip: () => null, renderSbAvatarWrap: () => null, showBadge: () => false });
  const aside = find(root, 'aside');
  expect(aside).toBeTruthy();
  // Browser closest() finds search only for the search button. Other controls
  // must not make the ancestor drawer disappear before their own click fires.
  for (const classes of ['sb-util-btn', 'notif-panel-close', 'bell-chip', 'sb-avatar-btn']) {
    aside.props.onClickCapture({ target: { closest: selector => selector.split(',').some(s => s.trim() === `.${classes}`) ? {} : null } });
  }
  expect(close).not.toHaveBeenCalled();
  aside.props.onClickCapture({ target: { closest: selector => selector.includes('.sb-search-btn') ? {} : null } });
  expect(close).toHaveBeenCalledOnce();
});

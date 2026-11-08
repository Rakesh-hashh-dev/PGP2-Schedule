export const ADMIN_NAVIGATION_EVENT='termflow:admin-navigation-pending';
export function mayLeaveAdmin(target=globalThis.window) {
  if(!target)return true;
  const event=new CustomEvent(ADMIN_NAVIGATION_EVENT,{detail:{pending:[]}});
  target.dispatchEvent(event);
  const pending=[...new Set(event.detail.pending)];
  return !pending.length || target.confirm(`Some admin edits have not been saved (${pending.join(', ')}). Leave and discard those unsaved edits? Saved private drafts remain available.`);
}

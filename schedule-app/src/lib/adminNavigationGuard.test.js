import {expect,it,vi} from 'vitest';
import {ADMIN_NAVIGATION_EVENT,mayLeaveAdmin} from './adminNavigationGuard.js';
it('allows navigation with saved drafts and asks once for unsaved areas',()=>{
  const target=new EventTarget();target.confirm=vi.fn().mockReturnValue(false);
  expect(mayLeaveAdmin(target)).toBe(true);expect(target.confirm).not.toHaveBeenCalled();
  target.addEventListener(ADMIN_NAVIGATION_EVENT,event=>event.detail.pending.push('schedule','private note','schedule'));
  expect(mayLeaveAdmin(target)).toBe(false);expect(target.confirm).toHaveBeenCalledTimes(1);
  expect(target.confirm.mock.calls[0][0]).toContain('schedule, private note');
  target.confirm.mockReturnValue(true);expect(mayLeaveAdmin(target)).toBe(true);
});

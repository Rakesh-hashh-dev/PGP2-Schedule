import { expect, it } from 'vitest';
import { scheduleNoticeCovered } from '../../supabase/functions/_shared/scheduleNoticeCoverage.js';
it('only suppresses a notice when the same user has the identical effective class', () => {
  const source = { code: 'BMD', date: '2026-11-05', section: 'A', start: '17:00', room: 'A' };
  const coverage = [{ user_id: 's', class_date: source.date, effective: { ...source, room: 'B' } }];
  expect(scheduleNoticeCovered(coverage, 's', source, { BMD_A: { room: 'B' } })).toBe(true);
  expect(scheduleNoticeCovered(coverage, 'other', source, { BMD_A: { room: 'B' } })).toBe(false);
  expect(scheduleNoticeCovered(coverage, 's', { ...source, start: '18:00' }, { BMD_A: { room: 'B' } })).toBe(false);
  expect(scheduleNoticeCovered(coverage, 's', source, { BMD_A: { room: 'B' }, 'BMD_A@17:00': { room: 'C' } })).toBe(false);
});

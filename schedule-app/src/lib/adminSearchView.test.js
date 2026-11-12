import { expect, it } from 'vitest';
import { adminSearchRange, buildAdminSearchFilter, adminRecordTime, buildNotificationDiagnosticFilter } from './adminSearchView.js';
it('uses inclusive IST dates, including a single day', () => {
  const result = buildAdminSearchFilter({ dataset: 'audit', from:'2026-11-09', to:'2026-11-09' });
  expect(result.from).toBe('2026-11-08T18:30:00.000Z');
  expect(result.to).toBe('2026-11-09T18:30:00.000Z');
  expect(adminSearchRange(7,new Date('2026-11-08T20:00:00Z'))).toEqual({from:'2026-11-03',to:'2026-11-09'});
});
it('rejects invalid, reversed and excessive ranges before a request', () => {
  for (const [from,to] of [['2026-02-30','2026-03-01'],['2026-11-10','2026-11-09'],['2025-01-01','2026-01-02']]) expect(()=>buildAdminSearchFilter({dataset:'audit',from,to})).toThrow();
});
it('removes filters that do not apply to the selected dataset', () => {
  const base={from:'2026-11-09',to:'2026-11-09',status:'pending',actor:'user_one'};
  expect(buildAdminSearchFilter({...base,dataset:'students'})).toMatchObject({status:'',actor:''});
  expect(buildAdminSearchFilter({...base,dataset:'feedback'})).toMatchObject({status:'pending',actor:''});
  expect(buildAdminSearchFilter({...base,dataset:'versions'})).toMatchObject({status:'',actor:'user_one'});
});
it('recognizes equivalent epoch timestamps as missing activity', () => {
  expect(adminRecordTime('1970-01-01T00:00:00Z')).toBe('No recorded activity');
  expect(adminRecordTime('1970-01-01T00:00:00+00:00')).toBe('No recorded activity');
});
it('enforces the diagnostic retention range and trims type filters', () => {
  expect(buildNotificationDiagnosticFilter({from:'2026-11-09',to:'2026-11-09',type:' class_reminder '})).toMatchObject({type:'class_reminder',start:'2026-11-08T18:30:00.000Z'});
  expect(()=>buildNotificationDiagnosticFilter({from:'2026-07-01',to:'2026-11-09'})).toThrow('90 days');
});

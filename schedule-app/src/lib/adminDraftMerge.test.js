import { expect, it } from 'vitest';
import { mergeAdminDraft,sameAdminDraft,resolveDraftField } from './adminDraftMerge.js';
it('merges disjoint changes and keeps deletions', () => {
  expect(mergeAdminDraft({ a: 1, b: 2 }, { b: 2 }, { a: 1, b: 3 })).toEqual({ value: { b: 3 }, conflicts: [] });
});
it('requires a decision on overlapping edits, deletions and reordered arrays', () => {
  expect(mergeAdminDraft({ room: 'A' }, { room: 'B' }, { room: 'C' }).conflicts[0].path).toBe('room');
  expect(mergeAdminDraft({ x: { a: 1 } }, {}, { x: { a: 2 } }).conflicts).toHaveLength(1);
  expect(mergeAdminDraft({ order: [1, 2] }, { order: [2, 1] }, { order: [1, 3] }).conflicts).toHaveLength(1);
});
it('ignores object key ordering while preserving dotted course identities during conflict resolution',()=>{
  expect(sameAdminDraft({a:1,b:2},{b:2,a:1})).toBe(true);
  const key='END.Term_A@09:00',base={slots:{[key]:{room:'A'}}},local={slots:{[key]:{room:'B'}}},remote={slots:{[key]:{room:'C'}}};
  const merged=mergeAdminDraft(base,local,remote);
  expect(resolveDraftField(merged.value,merged.conflicts[0].keys,'C')).toEqual(remote);
});

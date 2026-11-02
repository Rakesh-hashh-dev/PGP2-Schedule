import { it, expect } from 'vitest';
import { configureNav, navVisible } from './navigationControls.js';
import { itemsForGroup } from './navItems.js';
it('retains Today and composes labels, order and visibility', () => {
  const config = { items: { today: { visible: false }, split: { label: 'Expenses' }, pet: { visible: false } }, order: ['split', 'today', 'pet'] };
  expect(configureNav([{ id: 'today', label: 'Today' }, { id: 'pet', label: 'Companion' }, { id: 'split', label: 'Split' }], config)).toEqual([{ id: 'split', label: 'Expenses' }, { id: 'today', label: 'Today' }]);
  expect(navVisible('admin', config)).toBe(true);
});
it('cannot enable a feature hidden by its existing gate', () => {
  expect(itemsForGroup('track', { enableExams: false }, { items: { exams: { visible: true } } }).some(i => i.id === 'exams')).toBe(false);
});

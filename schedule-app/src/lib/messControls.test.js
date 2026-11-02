import { describe, it, expect } from 'vitest';
import { DEFAULT_CONTROLS, validateControls, normalizeControls } from './controlsSchema.js';
import { resolveMenu, resolveMealTimes, activeNotices, istDate, istMinutes } from './messControls.js';
const base = { 1: { breakfast: ['Toast'], lunch: ['Rice'], snacksW13: ['Chaat'], snacksW24: ['Noodles'], dinner: ['Dal'] } };
const date = new Date('2026-11-02T12:00:00+05:30');
const config = patch => ({ ...structuredClone(DEFAULT_CONTROLS.mess), ...patch });
describe('mess controls', () => {
  it('resolves fallback, feed, weekly and date changes in order', () => {
    const feed = { 1: { lunch: ['Sheet rice'] } };
    expect(resolveMenu(base, feed, date, config({})).lunch).toEqual(['Sheet rice']);
    const c = config({ weekly: { 1: { lunch: ['Admin rice'] } }, dates: { '2026-11-02': { lunch: ['Special rice'] } } });
    expect(resolveMenu(base, feed, date, c).lunch).toEqual(['Special rice']);
    expect(resolveMenu(base, feed, new Date('2026-11-09T12:00:00+05:30'), c).lunch).toEqual(['Admin rice']);
  });
  it('composes breakfast extras once and honors a closed meal', () => {
    expect(resolveMenu(base, null, date, config({}), ['Toast', 'Milk']).breakfast).toEqual(['Toast', 'Milk']);
    expect(resolveMenu(base, null, date, config({ weekly: { 1: { breakfast: [] } } }), ['Milk']).breakfast).toEqual([]);
    expect(resolveMenu(base, null, date, config({ dates: { '2026-11-02': { breakfast: ['Special'] } } }), ['Milk']).breakfast).toEqual(['Special']);
  });
  it('rotates snacks across positive and negative week boundaries', () => {
    expect(resolveMenu(base, null, date, config({})).snacks).toEqual(['Chaat']);
    expect(resolveMenu(base, null, new Date('2026-10-26T12:00:00+05:30'), config({})).snacks).toEqual(['Noodles']);
    expect(resolveMenu(base, null, new Date('2026-10-12T12:00:00+05:30'), config({})).snacks).toEqual(['Noodles']);
  });
  it('uses IST calendar boundaries regardless of browser timezone', () => {
    const midnight = new Date('2026-11-01T18:30:00Z');
    expect(istDate(midnight)).toBe('2026-11-02'); expect(istMinutes(midnight)).toBe(0);
    expect(istDate(new Date(+midnight - 1))).toBe('2026-11-01');
  });
  it('applies temporary timings only on their date', () => {
    const c = config({ timings: { lunch: { start: '12:30', end: '14:30' } }, datedTimings: { '2026-11-02': { lunch: { start: '12:00', end: '14:00' } } } });
    expect(resolveMealTimes(date, c)[1].start).toBe('12:00');
    expect(resolveMealTimes(new Date('2026-11-03T12:00:00+05:30'), c)[1].start).toBe('12:30');
  });
  it('expires notices exactly at end time', () => {
    const c = config({ notices: [{ id: 'n', text: 'Delayed', start: '2026-11-02T06:00:00Z', end: '2026-11-02T07:00:00Z' }] });
    expect(activeNotices(new Date('2026-11-02T06:00:00Z'), c)).toHaveLength(1);
    expect(activeNotices(new Date('2026-11-02T07:00:00Z'), c)).toHaveLength(0);
  });
});
describe('controls validation', () => {
  it.each([
    ['mess', { anchor: '2026-11-03' }], ['mess', { dates: { '2026-02-30': { lunch: [] } } }],
    ['mess', { weekly: { 1: { lunch: [''] } } }], ['mess', { feedUrl: 'https://evil.example/exec' }],
    ['mess', { timings: { lunch: { start: '10:00', end: '12:00' } } }], ['mess', { timings: { lunch: { start: '16:00', end: '14:00' } } }],
    ['mess', { notices: [{ id: 'a', text: 'x', start: '2026-11-02T10:00', end: '2026-11-02T11:00' }] }],
    ['navigation', { items: { today: { visible: false } } }], ['navigation', { order: ['today', 'today'] }],
    ['dashboard', { visible: { timeline: false } }], ['dashboard', { density: 'huge' }],
  ])('rejects malformed %s configuration %#', (section, value) => { expect(() => validateControls(section, value)).toThrow(); });
  it('defaults invalid published sections independently', () => {
    const value = normalizeControls({ navigation: { order: ['today', 'split'] }, mess: { anchor: 'bad' } });
    expect(value.mess.anchor).toBe('2026-10-19'); expect(value.navigation.order).toEqual(['today', 'split']);
  });
});

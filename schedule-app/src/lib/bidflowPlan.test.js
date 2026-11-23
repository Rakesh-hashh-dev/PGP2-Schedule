
import { afterEach, expect, it, vi } from 'vitest';
import { GENERATED_COURSE_PREFIX, availablePlan, bidflowCourseKey, bidflowPlanKey, generateBidFlowCsv, loadBidflowWorkspace, summarizeBidflowPlan, timetableHandoff } from './bidflowPlan.js';
import { normalizeControls, validateControls } from './controlsSchema.js';
import { normalizeCourses, parseCSVText } from './bidflowFeed.js';
import { generateBidFlowPdfHtml } from './bidflowPdf.js';

const first = { code: 'ECOM', term: 'Term IV', credits: 3, name: 'E-commerce', area: 'ISM' };
const second = { code: 'ECOM', term: 'Term V', credits: 1.5, name: 'E-commerce research', area: 'ISM' };
const firstKey = bidflowCourseKey(first, 'IV');
const secondKey = bidflowCourseKey(second, 'IV');
const map = { [firstKey]: first, [secondKey]: second };
afterEach(() => vi.unstubAllGlobals());

it('keeps same-code electives distinct across terms and rejects normalized duplicates', () => {
  expect(validateControls('bidflow', { enabled: true, courses: [first, second] }).courses).toHaveLength(2);
  expect(() => normalizeCourses([first, { ...first, term: '4', code: 'ecom' }])).toThrow(/duplicates/);
  expect(() => validateControls('bidflow', { courses: [first, { ...first, term: '4' }] })).toThrow(/within each term/);
  expect(normalizeControls({}).bidflow).toMatchObject({ enabled: false, courses: [] });
});

it('parses multiline CSV and rejects missing credits without inventing values', () => {
  const [course] = parseCSVText('Code,Name,Credits\r\nECOM,"First\nsecond ""line""",1.5');
  expect(course).toMatchObject({ name: 'First\nsecond "line"', credits: 1.5 });
  expect(() => parseCSVText('Code,Name,Credits\nECOM,E-commerce,')).toThrow(/positive numeric credits/);
});

it('isolates and validates saved plans by account, cohort and planning cycle', () => {
  const config = { cohort: 'PGP2', term: 'Term IV' };
  const key = bidflowPlanKey('student-1', config);
  const plan = { primary: [firstKey, firstKey, 42], backup: [firstKey, secondKey] };
  vi.stubGlobal('localStorage', { getItem: lookup => lookup === key ? JSON.stringify({ plan, saved: [{ id: 'one', name: 'Plan A', plan }] }) : null });
  expect(loadBidflowWorkspace(key)).toMatchObject({ plan: { primary: [firstKey], backup: [secondKey] }, saved: [{ id: 'one' }] });
  expect(loadBidflowWorkspace(bidflowPlanKey('student-2', config)).saved).toEqual([]);
  expect(loadBidflowWorkspace(bidflowPlanKey('student-1', { ...config, term: 'V' })).plan.primary).toEqual([]);
  expect(loadBidflowWorkspace()).toEqual({ plan: { primary: [], backup: [] }, saved: [] });
  expect(availablePlan({ primary: ['unavailable'], backup: [secondKey] }, map)).toEqual({ primary: [], backup: [secondKey] });
});

it('sums primary credits individually by term and area', () => {
  expect(summarizeBidflowPlan({ primary: [firstKey, secondKey], backup: [] }, map)).toEqual({
    credits: 4.5, byTerm: [['Term IV', 3], ['Term V', 1.5]], byArea: [['ISM', 4.5]],
  });
  expect(summarizeBidflowPlan({ primary: [firstKey], backup: [secondKey] }, map).credits).toBe(3);
});

it('hands off the current term and cohort while preserving assigned sections', () => {
  const timetable = { cohort: 'PGP2', term: '5', legend: { ECOM: { credits: '1.5' } }, sectionsByCode: { ECOM: ['A', 'B'] }, picked: { ECOM: 'B' } };
  expect(timetableHandoff([firstKey, secondKey], map, timetable, 'PGP2')).toEqual({ eligible: { ECOM: 'B' }, blocked: [], otherTerm: 1, unavailable: false });
  expect(timetableHandoff([secondKey], map, { ...timetable, picked: {} }, 'PGP2').blocked).toEqual(['ECOM']);
  expect(timetableHandoff([secondKey], map, { ...timetable, legend: { ECOM: { credits: 3 } } }, 'PGP2').eligible).toEqual({});
  expect(timetableHandoff([secondKey], map, timetable, 'PGP1').unavailable).toBe(true);
});

it('preserves punctuation in CSV and renders course details as text in print', () => {
  const special = { [firstKey]: { ...first, name: 'Research "#1"', faculty: '=Faculty & Co' } };
  const plan = { primary: [firstKey], backup: [] };
  expect(generateBidFlowCsv(plan, special)).toContain('"Research ""#1""","Term IV","ISM","3","\'=Faculty & Co"');
  const html = generateBidFlowPdfHtml({ plan, courseMap: special, rulesText: '<b>Rules & notes</b>' });
  expect(html).toContain('Research &quot;#1&quot;');
  expect(html).toContain('&lt;b&gt;Rules &amp; notes&lt;/b&gt;');
});


it('keeps generated catalog IDs out of timetable setup', () => {
  const course = { ...second, code: GENERATED_COURSE_PREFIX + 'ECOM' };
  const id = bidflowCourseKey(course, 'V');
  const timetable = { cohort: 'PGP2', term: 'V', legend: { [course.code]: { credits: 1.5 } }, sectionsByCode: {}, picked: {} };
  expect(timetableHandoff([id], { [id]: course }, timetable, 'PGP2')).toMatchObject({
    eligible: {}, blocked: [course.code],
  });
  const plan = { primary: [id], backup: [] };
  expect(generateBidFlowCsv(plan, { [id]: course })).not.toContain(course.code);
  expect(generateBidFlowPdfHtml({ plan, courseMap: { [id]: course } })).not.toContain(course.code);
});

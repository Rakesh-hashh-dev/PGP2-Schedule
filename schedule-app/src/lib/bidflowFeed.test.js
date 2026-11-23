import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  normalizeArea,
  normalizeGoogleSheetUrl,
  normalizeCourses,
  parseCSVText,
  parseExcelBuffer,
} from './bidflowFeed.js';

describe('bidflowFeed', () => {
  describe('normalizeArea', () => {
    it('normalizes common department names to standard area codes', () => {
      expect(normalizeArea('Finance & Accounting')).toBe('F&A');
      expect(normalizeArea('Marketing')).toBe('MKTG');
      expect(normalizeArea('Operations')).toBe('OPS');
      expect(normalizeArea('Strategy')).toBe('STM');
      expect(normalizeArea('Information Systems')).toBe('ISM');
      expect(normalizeArea('OB & HR')).toBe('OB&HR');
      expect(normalizeArea('')).toBe('Other');
      expect(normalizeArea(null)).toBe('Other');
    });
  });

  describe('normalizeGoogleSheetUrl', () => {
    it('converts standard edit/view Google Sheet URL into direct CSV export link', () => {
      const editUrl = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0';
      const csvUrl = normalizeGoogleSheetUrl(editUrl);
      expect(csvUrl).toBe('https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/export?format=csv&gid=0');
    });

    it('preserves custom gid parameter in Google Sheet URL', () => {
      const editUrl = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?gid=1234567';
      const csvUrl = normalizeGoogleSheetUrl(editUrl);
      expect(csvUrl).toBe('https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/export?format=csv&gid=1234567');
    });

    it('keeps Apps Script URLs unmodified', () => {
      const scriptUrl = 'https://script.google.com/macros/s/AKfycbx_example/exec';
      expect(normalizeGoogleSheetUrl(scriptUrl)).toBe(scriptUrl);
    });
  });

  describe('parseCSVText & normalizeCourses', () => {
    it('normalizes raw row objects directly via normalizeCourses', () => {
      const rawRows = [
        { 'Course Code': 'FIN101', 'Course Name': 'Corporate Finance', Area: 'Finance', Credits: '3.0' },
      ];
      const normalized = normalizeCourses(rawRows);
      expect(normalized).toHaveLength(1);
      expect(normalized[0].code).toBe('FIN101');
      expect(normalized[0].area).toBe('F&A');
      expect(normalized[0].credits).toBe(3);
    });

    it('parses CSV text into normalized course objects', () => {
      const sampleCSV = `Course Code,Course Name,Area,Credits,Faculty,Term
FME,Financial Modeling & Equity Valuation,Finance,3.0,Prof. A. Kumar,Term IV
DM,Digital Marketing,Marketing,3.0,Prof. S. Roy,Term IV
SOM,Service Operations,Operations,1.5,Prof. M. Patel,Term IV`;

      const courses = parseCSVText(sampleCSV);
      expect(courses).toHaveLength(3);

      expect(courses[0]).toEqual({
        code: 'FME',
        name: 'Financial Modeling & Equity Valuation',
        area: 'F&A',
        credits: 3.0,
        faculty: 'Prof. A. Kumar',
        term: 'Term IV',
        slots: null,
        description: '',
      });

      expect(courses[1].area).toBe('MKTG');
      expect(courses[2].credits).toBe(1.5);
      expect(courses[2].area).toBe('OPS');
    });

    it('handles commas enclosed in quotes inside course titles or faculty', () => {
      const quotedCSV = `Code,Name,Area,Credits,Faculty
SLTDM,"Strategy, Leadership & Top Decision Making",Strategy,3.0,"Prof. Roy, Ph.D."`;

      const courses = parseCSVText(quotedCSV);
      expect(courses).toHaveLength(1);
      expect(courses[0].name).toBe('Strategy, Leadership & Top Decision Making');
      expect(courses[0].faculty).toBe('Prof. Roy, Ph.D.');
      expect(courses[0].area).toBe('STM');
    });
  });
});

it('imports term worksheets behind a cover sheet and finds course headers below title rows', async () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Import instructions']]), 'Read me');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Electives for Term V'], [], ['Subject Code', 'Course Title', 'Course Credits'],
    ['DM', 'Digital Marketing', 1.5],
  ]), 'Term V');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Course Code', 'Course Name', 'Credits'], ['DM', 'Marketing Strategies', 3],
  ]), 'Term 6');
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  await expect(parseExcelBuffer(buffer)).resolves.toMatchObject([
    { code: 'DM', name: 'Digital Marketing', credits: 1.5, term: 'Term V' },
    { code: 'DM', name: 'Marketing Strategies', credits: 3, term: 'Term 6' },
  ]);
});

it('reads tab-separated and semicolon-separated elective sheets with common header aliases', () => {
  expect(parseCSVText('Elective Code\tElective Name\tCredit Points\nAI\tAI for Managers\t3 cr')[0]).toMatchObject({ code: 'AI', credits: 3 });
  expect(parseCSVText('Code;Course Title;Credits\nFIN;"Finance; applied";1.5')[0]).toMatchObject({ code: 'FIN', name: 'Finance; applied', credits: 1.5 });
});


it('imports Excel catalogs with course names and credits but no official codes', async () => {
  const headers = ['Sl no.', 'Course Name', 'Faculty', 'Credit', 'Term', 'Visiting/ Internal', 'Area'];
  const first = [1, 'E-Commerce', 'Professor Roy', 3, 'TERM IV', 'Internal & Visiting', 'Marketing'];
  const second = [2, 'Digital Retail', 'Professor Sen', 1.5, 'TERM V', 'Visiting', 'Marketing'];
  function makeWorkbook(rows) {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), 'Course Details');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Faculty', 'Marketing', 'Total']]), 'Faculty Summary');
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  }
  const courses = await parseExcelBuffer(makeWorkbook([first, second]));
  expect(courses).toMatchObject([
    { code: expect.stringMatching(/^BF-CAT-/), name: 'E-Commerce', term: 'TERM IV', credits: 3, facultyType: 'Internal & Visiting' },
    { code: expect.stringMatching(/^BF-CAT-/), name: 'Digital Retail', term: 'TERM V', credits: 1.5, facultyType: 'Visiting' },
  ]);
  expect((await parseExcelBuffer(makeWorkbook([second, first]))).reverse()).toEqual(courses);
});

import ExcelJS from 'exceljs';
import { expect, it } from 'vitest';
import { generateBidFlowCsv } from './bidflowPlan.js';
import { generateBidFlowWorkbook } from './bidflowSpreadsheet.js';

it('exports ranked choices with TermFlow branding, numeric credits and workbook styles', async () => {
  const plan = { primary: ['finance'], backup: ['operations'] };
  const courseMap = {
    finance: { code: 'FIN101', name: 'Investment Banking', term: 'Term IV', area: 'F&A', credits: 3, faculty: 'Prof. Rao', facultyType: 'Visiting' },
    operations: { code: 'BF-CAT-OPERATIONS', name: 'Service Operations', term: 'Term VI', area: 'OPS', credits: 1.5, faculty: '=Faculty', facultyType: 'Internal & Visiting' },
  };

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await generateBidFlowWorkbook({ plan, courseMap, cohort: 'PGP2' }));
  const sheet = workbook.getWorksheet('Elective plan');
  expect(workbook.creator).toBe('TermFlow');
  expect(sheet.getCell('A1').value).toBe('TermFlow  /  BidFlow');
  expect(sheet.getCell('A6').value).toBe(3);
  expect(sheet.getRow(9).values.slice(1)).toEqual(['Primary', 1, 'Term 4', 'Investment Banking', 'F&A', 3, 'Prof. Rao', 'Visiting', 'FIN101']);
  expect(sheet.getRow(10).values.slice(1, 9)).toEqual(['Backup', 1, 'Term 6', 'Service Operations', 'OPS', 1.5, '=Faculty', 'Internal & Visiting']);
  expect(sheet.getCell('I10').value ?? '').toBe('');
  expect(sheet.getCell('A9').fill.fgColor.argb).not.toBe(sheet.getCell('A10').fill.fgColor.argb);
  expect(sheet.getCell('H9').fill.fgColor.argb).toBe('FFF6B26B');
  expect(sheet.getCell('H10').fill.fgColor.argb).toBe('FF409B7A');
  expect(sheet.views[0].ySplit).toBe(8);
  expect(sheet.autoFilter).toBe('A8:I10');

  const csv = generateBidFlowCsv(plan, courseMap);
  expect(csv).toContain('"Backup","1","Term 6","Service Operations","OPS","1.5","\'=Faculty","Internal & Visiting",""');
  expect(csv).not.toContain('BF-CAT-');
});

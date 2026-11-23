import ExcelJS from 'exceljs';
import { BIDFLOW_EXPORT_HEADERS, availablePlan, bidflowExportRows, summarizeBidflowPlan } from './bidflowPlan.js';

export const BIDFLOW_XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const colors = {
  ink: '261740',
  muted: '625B6B',
  brand: '51318B',
  paper: 'FAF8F4',
  white: 'FFFFFF',
  lilac: 'F0EAF7',
  amber: 'F8EACF',
  amberInk: '78490D',
};
const widths = [13, 9, 13, 48, 16, 12, 31, 22, 17];
const termFills = { 'Term 4': 'EDE8F8', 'Term 5': 'DFF1E6', 'Term 6': 'F8EACF' };
const facultyFills = { Visiting: 'F6B26B', 'Internal & Visiting': '409B7A' };
const areaFills = {
  'F&A': 'D9EAD3', GMPPE: '00FFFF', ISM: 'C9DAF8', MKTG: 'E6B8AF',
  'OB&HR': 'EAD1DC', OPS: 'F1C232', STM: 'FFFF00',
  'STM+F&A': '7AD694', 'STM+GMPPE': '7AD694', 'STM+OB&HR': '7AD694',
};

function fill(rgb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + rgb } };
}

function font(rgb, size, bold = false) {
  return { name: 'Aptos', size, bold, color: { argb: 'FF' + rgb } };
}

export async function generateBidFlowWorkbook({ plan, courseMap, cohort, studentName }) {
  const selected = availablePlan(plan, courseMap);
  const { credits } = summarizeBidflowPlan(selected, courseMap);
  const rows = bidflowExportRows(selected, courseMap);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TermFlow';
  workbook.title = 'BidFlow Elective Plan';
  const sheet = workbook.addWorksheet('Elective plan', {
    properties: { tabColor: { argb: 'FF' + colors.brand }, defaultRowHeight: 22 },
    views: [{ state: 'frozen', ySplit: 8, showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '8:8' },
  });
  sheet.columns = widths.map(width => ({ width }));

  function banner(range, value, background, text) {
    sheet.mergeCells(range);
    const cell = sheet.getCell(range.split(':')[0]);
    cell.value = value;
    cell.fill = fill(background);
    cell.font = text;
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
    return cell;
  }

  banner('A1:I1', 'TermFlow  /  BidFlow', colors.brand, font(colors.white, 14, true));
  banner('A2:I2', 'Elective plan', colors.paper, font(colors.ink, 22, true));
  banner('A3:I3', ['IIM Sambalpur', cohort, studentName].filter(Boolean).join('  ·  '), colors.paper, font(colors.muted, 11));
  sheet.getRow(1).height = 28;
  sheet.getRow(2).height = 34;
  sheet.getRow(3).height = 23;
  sheet.getRow(4).height = 10;

  for (const [start, end, label, value] of [
    ['A', 'C', 'Primary credits', credits],
    ['D', 'F', 'Primary choices', selected.primary.length],
    ['G', 'I', 'Backup choices', selected.backup.length],
  ]) {
    const background = start === 'G' ? colors.amber : colors.lilac;
    banner(start + '5:' + end + '5', label, background, font(colors.muted, 10, true));
    const metric = banner(start + '6:' + end + '6', value, background, font(colors.ink, 18, true));
    if (start === 'A') metric.numFmt = '0.0#';
  }
  sheet.getRow(6).height = 27;
  banner('A7:I7', 'Ranks are shown within each choice group. Only primary choices count toward the credit total.', colors.paper, font(colors.muted, 10));

  const heading = sheet.getRow(8);
  heading.values = BIDFLOW_EXPORT_HEADERS;
  heading.height = 25;
  heading.eachCell(cell => {
    cell.fill = fill(colors.ink);
    cell.font = font(colors.white, 10, true);
    cell.alignment = { vertical: 'middle', indent: 1 };
  });

  rows.forEach((values, index) => {
    const row = sheet.addRow(values);
    const [choice, , term, title, area, , faculty, facultyType] = values;
    const backup = choice === 'Backup';
    const choiceFill = backup ? colors.amber : colors.lilac;
    const titleLines = title.split(/\r?\n/).reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 42)), 0);
    const facultyLines = String(faculty || '').split(/\r?\n/).reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 26)), 0);
    row.height = Math.max(24, 14 * Math.max(titleLines, facultyLines) + 8);
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      cell.fill = fill(index % 2 ? colors.paper : colors.white);
      cell.font = font(colors.ink, 11, column === 4 || column === 6);
      cell.alignment = { vertical: 'middle', indent: 1, wrapText: true };
    });
    row.getCell(1).fill = fill(choiceFill);
    row.getCell(1).font = font(backup ? colors.amberInk : colors.brand, 10, true);
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    if (Object.hasOwn(termFills, term)) row.getCell(3).fill = fill(termFills[term]);
    const areaFill = Object.hasOwn(areaFills, area) ? areaFills[area] : null;
    if (areaFill) row.getCell(5).fill = fill(areaFill);
    row.getCell(6).numFmt = '0.0#';
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
    const facultyFill = facultyType === 'Internal' ? areaFill :
      Object.hasOwn(facultyFills, facultyType) ? facultyFills[facultyType] : null;
    if (facultyFill) row.getCell(8).fill = fill(facultyFill);
  });

  if (rows.length) sheet.autoFilter = { from: 'A8', to: 'I' + sheet.rowCount };
  return workbook.xlsx.writeBuffer();
}

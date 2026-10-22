const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const source = readFileSync(process.env.TEST_FEED_SOURCE || resolve(__dirname, '../../google_apps_script.js'), 'utf8');
const parser = vm.createContext({ Date, console });
vm.runInContext(source, parser);

function parse(rows, merges = []) {
  const range = {
    getDisplayValues: () => rows,
    getValues: () => rows,
    getMergedRanges: () => merges.map(([row, col, height, width]) => ({
      getRow: () => row, getColumn: () => col,
      getNumRows: () => height, getNumColumns: () => width,
    })),
  };
  const legend = Object.fromEntries(['DM', 'AOA', 'CRM', 'SDM', 'AAIM', 'GTSDM', 'BOM'].map(code => [code, { name: code }]));
  return parser.parseTimetable({ getSheets: () => [{ getDataRange: () => range }] }, legend);
}

const rows = [
  ['22-Oct', 'Thu', 'Section A', '', 'DM-10', '', 'Lunch Break', '', '', '', ''],
  ['', '', 'Section B', '', '', 'DM-10', '', '', '', '', ''],
  ['', '', 'Single Section', '', '', '', '', '', 'AOA-13', 'AOA-14', ''],
  ['23-Ot', 'Fri', 'Section A', '', '', '', 'Lunch Break', '', 'CRM Extra Session\n5 PM-6 PM', '', 'SDM-Extra Session\n8.30 PM to 9.30 PM'],
  ['', '', 'Section B', '', '', '', '', '', '', 'B', ''],
  ['', '', 'Single Section', '', 'AAIM-10', 'GTSDM-8', '', 'BOM-10', '', '', ''],
];
const merges = [[4, 9, 3, 1], [4, 11, 3, 1]];

test('October 23 typo keeps all five courses on Friday and preserves Thursday sections', () => {
  const classes = parse(rows, merges);
  const friday = classes.filter(c => c.date === '2026-10-23' && c.type === 'class');
  assert.deepEqual(Array.from(friday, c => c.code).sort(), ['AAIM', 'BOM', 'CRM', 'GTSDM', 'SDM']);
  assert.ok(friday.every(c => c.day === 'Fri' && c.section === 'Single'));
  assert.equal(classes.find(c => c.code === 'AAIM').start, '10:00');
  const thursday = classes.filter(c => c.date === '2026-10-22' && c.type === 'class');
  assert.deepEqual(Array.from(thursday, c => `${c.code}:${c.section}:${c.start}`), ['DM:A:10:00', 'DM:B:12:00', 'AOA:Single:16:30', 'AOA:Single:18:30']);
});

test('cell notes override slot times while merged sections remain combined', () => {
  const classes = parse(rows, merges);
  for (const [code, start, end] of [['CRM', '17:00', '18:00'], ['SDM', '20:30', '21:30']]) {
    const item = classes.find(c => c.code === code);
    assert.equal(item.start, start);
    assert.equal(item.end, end);
    assert.equal(item.section, 'Single');
  }
});

test('invalid nonempty dates fail a rebuild rather than inherit October 22', () => {
  const bad = rows.map(row => [...row]);
  bad[3][0] = '23-Unknown';
  assert.throws(() => parse(bad, merges), /Invalid timetable date at row 4/);
});

test('impossible calendar dates also fail', () => {
  assert.equal(parser.parseDate('31-Feb', '31-Feb'), null);
  assert.equal(parser.parseDate('0-Oct', '0-Oct'), null);
  assert.equal(parser.parseDate('29-Feb', '29-Feb'), null);
});

test('blank section rows still inherit their valid date', () => {
  const classes = parse(rows, merges);
  assert.equal(classes.find(c => c.code === 'DM' && c.section === 'B').date, '2026-10-22');
});

test('time ranges support noon, midnight, dotted minutes and en dashes', () => {
  for (const [label, start, end] of [
    ['12 AM - 1 AM', '00:00', '01:00'],
    ['11:30 AM – 1:00 PM', '11:30', '13:00'],
    ['12 PM to 1.30 PM', '12:00', '13:30'],
  ]) {
    const value = parser.parseSessionTimes(label);
    assert.equal(value.start, start);
    assert.equal(value.end, end);
  }
  assert.equal(parser.parseSessionTimes('AOA-13 (Prof. Example)'), null);
  assert.throws(() => parser.parseSessionTimes('13 PM-14 PM'), /Invalid session time/);
  assert.throws(() => parser.parseSessionTimes('6 PM-5 PM'), /Invalid session time range/);
});

test('merged columns retain their end time when no explicit time is written', () => {
  const classes = parse([['24-Oct', 'Sat', 'Single Section', 'AAIM-11 & 12', '', '', '', '', '', '', '']], [[1, 4, 1, 2]]);
  assert.equal(classes[0].start, '08:00');
  assert.equal(classes[0].end, '11:30');
});

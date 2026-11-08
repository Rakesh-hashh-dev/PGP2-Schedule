import { expect, it, vi } from 'vitest';
vi.mock('./supabase', () => ({ supabase: {} }));
import { csvCell } from './adminOperationalSearch.js';
it('neutralizes spreadsheet formulas while preserving commas, quotes and newlines', () => {
  expect(csvCell('=SUM(A1:A2)')).toBe('"\'=SUM(A1:A2)"');
  expect(csvCell('  @command')).toBe('"\'  @command"');
  expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
});

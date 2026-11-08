import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), maybeSingle: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { rpc: mocks.rpc, from: mocks.from } }));
import { loadStudentNote, saveStudentNote } from './adminNotes.js';
beforeEach(() => {
  vi.resetAllMocks();
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
});
it('loads an empty note only after a successful empty private read', async () => {
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  expect(await loadStudentNote('student')).toMatchObject({ body: '', revision: 0 });
  expect(mocks.from).toHaveBeenCalledWith('admin_student_notes');
});
it('does not disguise an unavailable private store as an empty note', async () => {
  mocks.maybeSingle.mockResolvedValue({ error: { message: 'permission denied' } });
  await expect(loadStudentNote('student')).rejects.toThrow('permission denied');
});
it('sends the base revision and accepts a confirmed successor', async () => {
  mocks.rpc.mockResolvedValue({ data: { user_id: 'student', body: 'help', revision: 4 } });
  expect(await saveStudentNote('student', 'help', 3)).toMatchObject({ revision: 4 });
  expect(mocks.rpc).toHaveBeenCalledWith('admin_save_student_note', { p_user_id: 'student', p_body: 'help', p_revision: 3 });
});
it('surfaces concurrent saves and denied writes without claiming success', async () => {
  mocks.rpc.mockResolvedValue({ error: { message: 'Another admin saved this note' } });
  await expect(saveStudentNote('student', 'my edits', 3)).rejects.toThrow('Another admin');
  mocks.rpc.mockResolvedValue({ data: null });
  await expect(saveStudentNote('student', 'my edits', 3)).rejects.toThrow('not confirmed');
});
it('rejects invalid input and mismatched confirmation', async () => {
  await expect(saveStudentNote('student', 'x'.repeat(20001), 0)).rejects.toThrow('20,000');
  expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.rpc.mockResolvedValue({ data: { user_id: 'other', revision: 1 } });
  await expect(saveStudentNote('student', 'help', 0)).rejects.toThrow('not confirmed');
});

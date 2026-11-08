import { describe, expect, it } from 'vitest';
import { classReminderCopy, dailySummaryCopy, scheduleNoticeCopy, socialNotificationCopy, meetupReminderCopy, freeNudgeCopy, notificationTime, notificationDay } from '../../supabase/functions/_shared/notificationCopy.js';

const cls = { code: 'SCA', date: '2026-11-09', start: '14:30', end: '16:00', section: 'A', room: 'C-104', name: 'Supply Chain Analytics' };
describe('notification message accuracy', () => {
  it('uses an absolute start time and leads with room and section', () => {
    const copy = classReminderCopy(cls, cls.date);
    expect(copy.title).toBe('SCA starts at 2:30 PM');
    expect(copy.body.split('\n')[0]).toBe('Room C-104 · Section A');
    expect(copy.body).toContain('Today · 2:30 PM–4:00 PM');
  });
  it('keeps guest sessions identifiable without a countdown', () => {
    expect(classReminderCopy({ ...cls, session: 'Guest lecture' }, cls.date).title).toBe('Guest session: SCA starts at 2:30 PM');
  });
  it.each(['99:30', '14:90', undefined, 'not-a-time'])('does not invent a time from %s', value => {
    expect(notificationTime(value)).toBe('');
    expect(classReminderCopy({ code: 'SCA', start: value }).title).toBe('SCA class reminder');
  });
  it('handles noon, midnight, and IST date boundaries', () => {
    expect(notificationTime('00:00')).toBe('12:00 AM');
    expect(notificationTime('12:05')).toBe('12:05 PM');
    expect(notificationDay('2027-01-01', '2026-12-31')).toBe('Tomorrow');
  });
  it('puts exams and named deadlines before classes', () => {
    const copy = dailySummaryCopy({ classes: [cls], exams: [{ code: 'FIN', start: '09:00', room: 'A1' }], assignments: [{ code: 'SCA', title: 'Case report' }] });
    expect(copy.title).toBe('Today: 1 exam · 1 class');
    expect(copy.body.split('\n')).toEqual(['Exam: FIN at 9:00 AM · Room A1', 'Due today: SCA: Case report', 'First class: SCA at 2:30 PM · Room C-104']);
  });
  it('never sends a holiday greeting when an exam or deadline is recorded', () => {
    for (const commitments of [{ exams: [{ code: 'FIN' }] }, { assignments: [{ code: 'SCA' }] }]) {
      const copy = dailySummaryCopy({ ...commitments, specialDay: { label: 'Republic Day' } });
      expect(copy.title).not.toContain('Happy');
      expect(copy.title).toContain('no classes');
      expect(copy.body).not.toContain('holiday');
    }
  });
  it('bounds clear-day claims to recorded commitments', () => {
    expect(dailySummaryCopy({}).body).toContain('recorded for today');
    expect(dailySummaryCopy({ specialDay: { label: 'Republic Day' } }).title).toBe('Happy Republic Day');
  });
  it('retains room/time/section details before an admin note', () => {
    const copy = scheduleNoticeCopy({ code: cls.code, date: cls.date, before: cls, effective: { ...cls, room: 'C-106', start: '15:00' }, note: 'Please arrive early.', today: '2026-11-08' });
    expect(copy.title).toBe('SCA moved to 3:00 PM');
    expect(copy.body).toBe('Tomorrow · Mon, 9 Nov · 3:00 PM · Section A\n2:30 PM → 3:00 PM\nRoom C-104 → C-106\nPlease arrive early.');
  });
  it('uses original start time for cancellation and keeps the note', () => {
    const copy = scheduleNoticeCopy({ code: 'SCA', date: cls.date, before: cls, effective: { ...cls, start: '15:00', type: 'cancelled' }, note: 'Faculty unavailable.', today: '2026-11-08' });
    expect(copy.title).toBe('SCA cancelled tomorrow');
    expect(copy.body).toContain('Tomorrow · Mon, 9 Nov · 2:30 PM · Section A');
    expect(copy.body).toContain('Faculty unavailable.');
  });
  it('does not fabricate an old room when it is unknown', () => {
    const copy = scheduleNoticeCopy({ code: 'SCA', date: cls.date, effective: cls });
    expect(copy.body).toContain('Room C-104');
    expect(copy.body).not.toContain('→');
  });
  it('uses membership wording and contextual board comments', () => {
    const group = socialNotificationCopy('group_invite', { fromName: 'Aarav', group: 'Study Circle' });
    expect(group.body).toContain('added you');
    expect(group.body).not.toContain('invited');
    expect(socialNotificationCopy('board_comment', { fromName: 'Aarav', group: 'MBA textbooks', preview: 'Available?' })).toEqual({ title: 'New comment on “MBA textbooks”', body: 'Aarav: “Available?”' });
  });
  it('uses fixed IST meetup times and cautious availability wording', () => {
    expect(meetupReminderCopy({ title: 'Study Circle', starts_at: '2026-11-09T11:30:00Z', place: 'Library' })).toEqual({ title: 'Study Circle starts at 5:00 PM', body: 'Library · 9 Nov\nOpen Friends for meetup details.' });
    expect(freeNudgeCopy('Aarav Kumar').title).toBe('Aarav may be free now');
    expect(freeNudgeCopy('').body).toContain('Your friend’s scheduled class');
  });
});

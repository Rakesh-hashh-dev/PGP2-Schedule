// Pure message builders shared by the web app and Edge Functions.
export function notificationTime(value) {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(value || '');
  if (!match || Number(match[1]) > 23) return '';
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`;
}

export function notificationDay(date, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return '';
  const instant = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(instant.getTime())) return '';
  if (date === today) return 'Today';
  if (today && instant.getTime() === Date.parse(`${today}T00:00:00Z`) + 86400000) return 'Tomorrow';
  const weekday = instant.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
  const calendarDate = instant.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${weekday}, ${calendarDate}`;
}

const sectionLabel = section => section && !['Single', 'All'].includes(section) ? `Section ${section}` : '';
const joined = parts => parts.filter(Boolean).join(' · ');
const lines = parts => parts.filter(Boolean).join('\n');

export function classReminderCopy(cls, today) {
  const time = notificationTime(cls.start);
  const guest = (cls.session || '').toLowerCase().includes('guest');
  return {
    title: `${guest ? 'Guest session: ' : ''}${cls.code}${time ? ` starts at ${time}` : ' class reminder'}`,
    body: lines([
      joined([cls.room && `Room ${cls.room}`, sectionLabel(cls.section)]),
      joined([notificationDay(cls.date, today), [time, notificationTime(cls.end)].filter(Boolean).join('–'), cls.name]),
    ]),
  };
}

export function dailySummaryCopy({ classes = [], exams = [], assignments = [], specialDay = null }) {
  const count = classes.length;
  const commitments = exams.length || assignments.length;
  if (!count && !commitments) return {
    title: specialDay ? `Happy ${specialDay.label}` : 'No classes scheduled today',
    body: 'No exams or assignment deadlines recorded for today.\nCheck your timetable for the week ahead.',
  };
  const titleParts = [];
  if (exams.length) titleParts.push(`${exams.length} exam${exams.length === 1 ? '' : 's'}`);
  // Deadlines lead the title when there is no exam to call out.
  else if (assignments.length) titleParts.push(`${assignments.length} deadline${assignments.length === 1 ? '' : 's'}`);
  titleParts.push(count ? `${count} class${count === 1 ? '' : 'es'}` : 'no classes');
  return {
    title: `Today: ${titleParts.join(' · ')}`,
    body: lines([
      ...exams.map(exam => `Exam: ${exam.code}${notificationTime(exam.start) ? ` at ${notificationTime(exam.start)}` : ''}${exam.room ? ` · Room ${exam.room}` : ''}`),
      assignments.length ? `Due today: ${assignments.map(task => task.title ? `${task.code}: ${task.title}` : task.code).join(', ')}` : '',
      ...classes.map((cls, index) => `${index ? 'Next' : 'First class'}: ${cls.code}${notificationTime(cls.start) ? ` at ${notificationTime(cls.start)}` : ''}${cls.room ? ` · Room ${cls.room}` : ''}`),
      !count ? 'No regular classes scheduled.' : '',
    ]),
  };
}

export function scheduleNoticeCopy({ code, date, section, before = {}, effective = {}, note = '', kind = '', today }) {
  const cancelled = effective.type === 'cancelled';
  const time = notificationTime(effective.start);
  const day = notificationDay(date, today);
  const timeChanged = !!before.start && !!time && before.start !== effective.start;
  const roomChanged = !!before.room && !!effective.room && before.room !== effective.room;
  let title = `${code} timetable updated`;
  if (cancelled) title = `${code} cancelled${day ? ` ${day.toLowerCase()}` : ''}`;
  else if (kind === 'added') title = `${code} added to your schedule`;
  else if (timeChanged) title = `${code} moved to ${time}`;
  else if (roomChanged) title = `${code} room changed`;
  else if (before.type === 'cancelled') title = `${code} reinstated`;
  else if (kind === 'moved' && time) title = `${code} rescheduled to ${time}`;
  const originalTime = notificationTime(before.start) || time;
  return {
    title,
    body: lines([
      joined([day, ['Today', 'Tomorrow'].includes(day) ? notificationDay(date) : '', cancelled ? originalTime : time, sectionLabel(effective.section || section), !roomChanged && effective.room ? `Room ${effective.room}` : '']),
      !cancelled && timeChanged ? `${notificationTime(before.start)} → ${time}` : '',
      !cancelled && before.end && effective.end && before.end !== effective.end ? `Ends: ${notificationTime(before.end)} → ${notificationTime(effective.end)}` : '',
      !cancelled && roomChanged ? `Room ${before.room} → ${effective.room}` : '',
      cancelled ? 'This session will not take place. Your timetable is updated.' : '',
      note.trim(),
    ]),
  };
}

export function socialNotificationCopy(type, { fromName = 'Someone', group = '', preview = '' } = {}) {
  const name = fromName || 'Someone';
  const copy = {
    friend_request: { title: 'New friend request', body: `${name} sent you a friend request.\nOpen Friends to review it.` },
    friend_accepted: { title: 'Friend request accepted', body: `${name} accepted your friend request.` },
    group_invite: { title: group ? `Added to ${group}` : 'Added to a group', body: `${name} added you to ${group ? `“${group}”` : 'a group'}.\nOpen Friends to view the group.` },
    friend_removed: { title: 'Friend removed', body: `${name} removed you.` },
    group_poll: { title: group ? `New poll in ${group}` : 'New group poll', body: `${name} started a poll${group ? ` in “${group}”` : ''}.` },
    board_contact: { title: group ? `Interest in “${group}”` : 'Interest in your Campus Board post', body: `${name} is interested in your post.` },
    board_comment: { title: group ? `New comment on “${group}”` : 'New Campus Board comment', body: preview ? `${name}: “${preview}”` : `${name} commented on your post.` },
    board_reply: { title: group ? `Reply on “${group}”` : 'Campus Board reply', body: preview ? `${name}: “${preview}”` : `${name} replied to the post.` },
  };
  return copy[type] || { title: name, body: preview };
}

export function meetupReminderCopy(meetup) {
  const start = new Date(meetup.starts_at);
  const valid = Number.isFinite(start.getTime());
  const time = valid ? start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '';
  const date = valid ? start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) : '';
  return { title: `${meetup.title}${time ? ` starts at ${time}` : ' meetup reminder'}`, body: lines([joined([meetup.place, date]), 'Open Friends for meetup details.']) };
}

export function freeNudgeCopy(name) {
  const full = name?.trim() || 'Your friend';
  return { title: `${full === 'Your friend' ? full : full.split(/\s+/)[0]} may be free now`, body: `${full}’s scheduled class has ended.\nCheck with them before making plans.` };
}

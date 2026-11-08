import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as copy from '../../supabase/functions/_shared/notificationCopy.js';
import * as presentation from '../../supabase/functions/_shared/pushPresentation.ts';
import * as coverage from '../../supabase/functions/_shared/scheduleNoticeCoverage.js';
import * as diwali from '../../supabase/functions/_shared/diwali.js';

// Run the real Edge Function entrypoints with isolated storage/provider doubles.
function database(tables, { failInsert = false } = {}) {
  return {
    tables,
    rpc: async () => ({ data: [], error: null }),
    from(table) {
      let op = 'select', values, single = false;
      const filters = [];
      const query = {
        select: () => query, order: () => query, limit: () => query, or: () => query,
        eq: (key, value) => { filters.push(row => row[key] === value); return query; },
        is: (key, value) => { filters.push(row => (row[key] ?? null) === value); return query; },
        gt: (key, value) => { filters.push(row => row[key] > value); return query; },
        gte: (key, value) => { filters.push(row => row[key] >= value); return query; },
        lt: (key, value) => { filters.push(row => row[key] < value); return query; },
        lte: (key, value) => { filters.push(row => row[key] <= value); return query; },
        in: (key, value) => { filters.push(row => value.includes(row[key])); return query; },
        maybeSingle: () => { single = true; return query; },
        upsert: rows => { op = 'insert'; values = rows; return query; },
        update: row => { op = 'update'; values = row; return query; },
        delete: () => { op = 'delete'; return query; },
        then(resolve, reject) {
          try {
            const all = tables[table] ||= [];
            let selected = all.filter(row => filters.every(filter => filter(row)));
            if (op === 'insert') {
              if (failInsert && table === 'notifications') return Promise.resolve({ data: null, error: { message: 'Inbox unavailable' } }).then(resolve, reject);
              selected = values.filter(row => !all.some(old => old.user_id === row.user_id && old.dedup_key === row.dedup_key));
              selected = selected.map((row, index) => ({ id: `new-${all.length + index}`, ...row }));
              all.push(...selected);
            } else if (op === 'update') selected.forEach(row => Object.assign(row, values));
            else if (op === 'delete') tables[table] = all.filter(row => !selected.includes(row));
            return Promise.resolve({ data: single ? selected[0] || null : selected, error: null }).then(resolve, reject);
          } catch (error) { return Promise.reject(error).then(resolve, reject); }
        },
      };
      return query;
    },
  };
}

async function invoke(name, db, body = {}, { env = {} } = {}) {
  let handler;
  const errors = [];
  const push = { setVapidDetails() {}, sendNotification: vi.fn().mockResolvedValue(undefined) };
  const source = readFileSync(new URL(`../../supabase/functions/${name}/index.ts`, import.meta.url), 'utf8');
  const code = stripTypeScriptTypes(source).replace(/import (.+?) from ["'](.+?)["'];/g, (_match, bindings, id) => `const ${bindings} = require(${JSON.stringify(id)});`);
  vm.runInNewContext(code, {
    exports: {}, module: { exports: {} },
    require(id) {
      if (id.includes('supabase-js')) return { createClient: () => db };
      if (id.includes('web-push')) return push;
      if (id.includes('notificationCopy')) return copy;
      if (id.includes('pushPresentation')) return presentation;
      if (id.includes('scheduleNoticeCoverage')) return coverage;
      if (id.includes('diwali.js')) return diwali;
      throw new Error(`Unexpected import ${id}`);
    },
    Deno: { env: { get: key => ({ PUSH_ADMIN_SECRET: 'test-secret', VAPID_PUBLIC_KEY: 'test-public', VAPID_PRIVATE_KEY: 'test-private', ...env })[key] }, serve: fn => { handler = fn; } },
    Date, Response, Request, URL, URLSearchParams, AbortSignal, crypto: webcrypto,
    fetch: async () => ({ ok: true, json: async () => db.feed }),
    console: { log() {}, error: (...args) => errors.push(args) },
  });
  const response = await handler(new Request('https://local.invalid', { method: 'POST', headers: { 'x-push-key': 'test-secret', 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  expect(errors).toEqual([]);
  return { response, push };
}

afterEach(() => vi.useRealTimers());
describe('notification producers and delivery', () => {
  it('rechecks campaign kill switches before dispatching a queued festive greeting', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-08T06:00:00Z'));
    const db = database({ system_config: [{ id: 'global', flags: { diwali: { greetingPush: false } } }],
      notifications: [{ id: 'festive', user_id: 'student', type: 'festive_greeting', title: 'Happy Diwali', created_at: '2026-11-08T05:55:00Z', data: { campaign: 'diwali:2026-11-08' } }],
      push_subscriptions: [{ user_id: 'student' }], push_prefs: [] });
    const { push } = await invoke('dispatch', db);
    expect(push.sendNotification).not.toHaveBeenCalled();
    expect(db.tables.notifications[0].push_delivery_state).toBe('preference_off');
  });
  it('queues only one festive greeting per subscribed opted-in student across cron runs', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-08T06:00:00Z'));
    const db = database({ schedule_cache: [{ id: 'latest', payload: { CLASSES: [] } }], system_config: [{ id: 'global', flags: {} }],
      profiles: [{ user_id: 'yes', courses: {} }, { user_id: 'no', courses: {} }, { user_id: 'unsubscribed', courses: {} }],
      push_subscriptions: [{ user_id: 'yes' }, { user_id: 'no' }], push_prefs: [{ user_id: 'no', prefs: { festive_greeting: { push: false } } }] });
    await invoke('class-reminders', db); await invoke('class-reminders', db);
    expect(db.tables.notifications).toHaveLength(1);
    expect(db.tables.notifications[0]).toMatchObject({ user_id: 'yes', type: 'festive_greeting', dedup_key: 'festival:diwali:2026-11-08' });
  });
  it('creates accurate late reminders and prioritizes the enrolled exam in the summary', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-09T08:10:00Z')); // 13:40 IST
    const cls = { date: '2026-11-09', code: 'SCA', start: '14:00', end: '15:00', section: 'A', room: 'C-104' };
    const db = database({
      schedule_cache: [{ id: 'latest', payload: { CLASSES: [cls, { ...cls, type: 'exam', start: '09:00' }, { ...cls, type: 'exam', section: 'B' }] } }],
      system_config: [{ id: 'global', flags: {} }],
      profiles: [{ user_id: 'student', courses: { SCA: 'A', _assignments: { SCA: [{ title: 'Report', dueDate: '2026-11-09' }] } } }],
      push_subscriptions: [{ user_id: 'student' }],
      push_prefs: [{ user_id: 'student', lead_minutes: 30, daily_summary: true, summary_time: '13:35' }],
    });
    await invoke('class-reminders', db);
    const rows = db.tables.notifications;
    expect(rows.find(row => row.type === 'class_reminder').title).toBe('SCA starts at 2:00 PM');
    const summary = rows.find(row => row.type === 'daily_summary');
    expect(summary.title).toBe('Today: 1 exam · 1 class');
    expect(summary.body.split('\n').slice(0, 2)).toEqual(['Exam: SCA at 9:00 AM · Room C-104', 'Due today: SCA: Report']);
    await invoke('class-reminders', db);
    expect(db.tables.notifications).toHaveLength(2); // repeated cron does not duplicate
  });

  it('retains fresh nudges on inbox failure and drops old availability nudges', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-09T08:10:00Z'));
    const db = database({
      schedule_cache: [{ id: 'latest', payload: { CLASSES: [] } }], system_config: [{ id: 'global', flags: {} }],
      profiles: [], push_subscriptions: [{ user_id: 'student' }],
      scheduled_nudges: [
        { id: 'old', user_id: 'student', about_name: 'Aarav', fire_at: '2026-11-09T06:00:00Z' },
        { id: 'fresh', user_id: 'student', about_name: 'Aarav', fire_at: '2026-11-09T08:05:00Z' },
      ],
    }, { failInsert: true });
    await invoke('class-reminders', db);
    expect(db.tables.scheduled_nudges.map(row => row.id)).toEqual(['fresh']);
  });

  it('makes legacy digest calls a no-op instead of sending a second morning summary', async () => {
    const db = database({ profiles: [{ user_id: 'student' }] });
    const { response } = await invoke('send-push', db, { mode: 'digest' });
    expect(await response.json()).toMatchObject({ queued: 0 });
    expect(db.tables.notifications).toBeUndefined();
  });

  it('preserves targeted admin broadcasts', async () => {
    const db = database({ profiles: [{ user_id: 'student' }, { user_id: 'other' }] });
    await invoke('send-push', db, { title: 'Placement briefing tomorrow', body: '5:00 PM · Auditorium', target_user_id: 'student' });
    expect(db.tables.notifications.map(row => row.user_id)).toEqual(['student']);
  });

  it('keeps verified session details alongside feed change text without fabricating old values', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-09T08:10:00Z'));
    const db = database({ profiles: [{ user_id: 'student', courses: { SCA: 'A' } }], push_subscriptions: [{ user_id: 'student' }], system_config: [{ id: 'global', flags: {} }] });
    db.feed = {
      CLASSES: [{ code: 'SCA', date: '2026-11-10', start: '15:00', section: 'A', room: 'C-106' }],
      CHANGES: [{ id: 'change-1', code: 'SCA', kind: 'moved', date: '2026-11-10', start: '15:00', text: 'Updated by the academic office.' }],
    };
    await invoke('schedule-diff', db, {}, { env: { FEED_URL: 'https://feed.invalid' } });
    const row = db.tables.notifications[0];
    expect(row.title).toBe('SCA rescheduled to 3:00 PM');
    expect(row.body).toContain('Tomorrow · Tue, 10 Nov · 3:00 PM · Section A · Room C-106');
    expect(row.body).toContain('Updated by the academic office.');
    expect(row.body).not.toContain('→');
  });

  it('never queues provider delivery past class start, honors expiry and preferences', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-09T08:10:00Z'));
    const row = { user_id: 'student', type: 'class_reminder', title: 'SCA starts at 1:42 PM', body: 'Room 4', created_at: '2026-11-09T08:00:00Z', data: { expires_at: '2026-11-09T08:12:00Z', ttl: 1800 } };
    const db = database({
      system_config: [{ id: 'global', flags: {} }],
      notifications: [
        { ...row, id: 'valid' },
        { ...row, id: 'expired', data: { expires_at: '2026-11-09T08:09:00Z' } },
        { ...row, id: 'disabled', type: 'admin_broadcast' },
      ],
      push_subscriptions: [{ user_id: 'student', endpoint: 'test', p256dh: 'test', auth: 'test' }],
      push_prefs: [{ user_id: 'student', prefs: { admin_broadcast: { push: false } }, quiet_start: '13:00', quiet_end: '15:00' }],
    });
    const { push } = await invoke('dispatch', db);
    expect(push.sendNotification).toHaveBeenCalledTimes(1);
    expect(push.sendNotification.mock.calls[0][2].TTL).toBe(120);
    expect(db.tables.notifications.map(row => row.push_delivery_state)).toEqual(['delivered', 'expired', 'preference_off']);
  });

  it('leaves nonurgent messages in-app during quiet hours', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-09T08:10:00Z'));
    const db = database({
      system_config: [{ id: 'global', flags: {} }],
      notifications: [{ id: 'social', user_id: 'student', type: 'group_invite', title: 'Added to Study Circle', created_at: '2026-11-09T08:00:00Z', data: {} }],
      push_subscriptions: [{ user_id: 'student' }], push_prefs: [{ user_id: 'student', quiet_start: '13:00', quiet_end: '15:00' }],
    });
    const { push } = await invoke('dispatch', db);
    expect(push.sendNotification).not.toHaveBeenCalled();
    expect(db.tables.notifications[0].push_delivery_state).toBe('quiet_hours');
  });
});

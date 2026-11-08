// Verified 2026 date: https://www.indiapost.gov.in/holidays-list
// A future year's date must be supplied explicitly; Diwali is not a fixed date.
export const DIWALI_2026 = '2026-11-08';
export function diwaliDecorEnabled(flags = {}) {
  // Preserve the older setting until an explicit independent decor switch is set.
  return (flags?.features?.diwaliDecor ?? flags?.diwali?.enabled ?? true) !== false;
}
export function istDate(now = new Date()) {
  return new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10);
}
export function validFestivalDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
export function diwaliCampaign(now = new Date(), flags = {}) {
  flags ||= {};
  if (!diwaliDecorEnabled(flags)) return null;
  const date = flags.diwali?.date || DIWALI_2026;
  if (!validFestivalDate(date)) return null;
  const today = istDate(now);
  const day = Date.parse(`${date}T00:00:00Z`);
  const start = new Date(day - 86400000).toISOString().slice(0, 10);
  const end = new Date(day + 86400000).toISOString().slice(0, 10);
  if (today < start || today > end) return null;
  return { key: `diwali:${date}`, date, start, end, today, greeting: today < date ? 'A little light for Diwali' : 'Happy Diwali' };
}
export function diwaliGreetingRows({ now = new Date(), flags = {}, profiles = [], prefs = [], subscriptions = [] }) {
  const campaign = diwaliCampaign(now, flags);
  if (!campaign || campaign.today !== campaign.date || flags.diwali?.greetingPush === false) return [];
  const minutes = (now.getTime() / 60000 + 330) % 1440;
  if (minutes < 9 * 60 || minutes >= 22 * 60) return [];
  const subscribed = new Set(subscriptions.map(sub => sub.user_id));
  const preferences = new Map(prefs.map(pref => [pref.user_id, pref]));
  return profiles.filter(profile => subscribed.has(profile.user_id) && preferences.get(profile.user_id)?.prefs?.festive_greeting?.push !== false).map(profile => ({
    user_id: profile.user_id, type: 'festive_greeting',
    title: 'A little light for your day',
    body: 'Happy Diwali! A festive greeting is waiting for you on TermFlow.',
    url: '/?view=today', icon: '/icon-notification.png',
    data: { campaign: campaign.key, urgency: 'normal', ttl: 6 * 3600, expires_at: `${campaign.date}T23:59:00+05:30` },
    dedup_key: `festival:${campaign.key}`,
  }));
}

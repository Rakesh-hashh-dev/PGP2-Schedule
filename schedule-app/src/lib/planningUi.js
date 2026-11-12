import { saveBusyBlock, deleteBusyBlock } from "./socialAvailability.js";

export function planningCircleOptions(friends, groups) {
  return [
    ...friends.filter(friend => friend.cloudId).map(friend => ({ id: `friend:${friend.cloudId}`, label: friend.name })),
    ...groups.map(group => ({ id: `group:${group.id}`, label: group.name })),
  ];
}
export function sharedSlotDraft(slot) {
  const members = new Map((slot.memberCloudIds || []).map((id, index) => [id, slot.names?.[index] || slot.inviteeNames?.[id]]).filter(([id]) => Boolean(id)));
  return { ...slot, source: "shared-time", title: slot.groupName || "Catch-up", duration: slot.durationMin, memberCloudIds: [...members.keys()], inviteeNames: Object.fromEntries([...members].filter(([, name]) => Boolean(name))) };
}
export function groupPlanningSlots(slots) {
  const dates = new Map();
  for (const slot of slots) { if (!dates.has(slot.date)) dates.set(slot.date, []); dates.get(slot.date).push(slot); }
  return [...dates].map(([date, rows]) => ({ date, slots: rows }));
}
export async function mutatePrivateBusyTime({ userId, kind, draft, blockId, save = saveBusyBlock, remove = deleteBusyBlock }) {
  if (kind === "remove") { await remove(userId, blockId); return draft; }
  if (kind !== "add") throw new Error("Choose a valid busy-time action.");
  const start = new Date(draft.start); const end = new Date(draft.end);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) throw new Error("Choose a valid end after the start.");
  await save(userId, start.toISOString(), end.toISOString());
  return { start: "", end: "" };
}

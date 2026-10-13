import { isExamSession } from "./attendance.js";

// Feed mid-terms use type "class"; admin overrides can change an entry's type.
export function scheduleEntryKind(item, override) {
  const type = override?.type === "cancelled"
    ? (override.cancelledType || item.cancelledType || item.type)
    : (override?.type || item.type);
  return type === "class" && isExamSession(item) ? "exam" : type;
}

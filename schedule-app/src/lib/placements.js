export const PLACEMENT_STAGES = ["saved", "applied", "shortlisted", "interview", "offer", "closed"];

const storageKey = (userId) => `pgp2.placements.${userId || "local"}`;

export function loadPlacements(userId) {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(userId)) || "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

export function savePlacements(userId, items) {
  try { localStorage.setItem(storageKey(userId), JSON.stringify(items)); } catch { /* optional local workspace */ }
}

export function createPlacement(input, now = Date.now()) {
  return {
    id: crypto.randomUUID(),
    company: String(input.company || "").trim().slice(0, 80),
    role: String(input.role || "").trim().slice(0, 100),
    stage: PLACEMENT_STAGES.includes(input.stage) ? input.stage : "saved",
    deadline: input.deadline || "",
    link: String(input.link || "").trim().slice(0, 500),
    notes: String(input.notes || "").trim().slice(0, 2000),
    createdAt: now,
    updatedAt: now,
  };
}

export function placementStats(items = [], now = new Date()) {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return {
    active: items.filter((item) => !["offer", "closed"].includes(item.stage)).length,
    interviews: items.filter((item) => item.stage === "interview").length,
    offers: items.filter((item) => item.stage === "offer").length,
    dueSoon: items.filter((item) => item.deadline && item.deadline >= today && item.deadline <= new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString().slice(0, 10)).length,
  };
}

export function filterPlacements(items = [], query = "", stage = "all") {
  const q = query.trim().toLowerCase();
  return items.filter((item) => (stage === "all" || item.stage === stage)
    && (!q || `${item.company} ${item.role} ${item.notes}`.toLowerCase().includes(q)));
}

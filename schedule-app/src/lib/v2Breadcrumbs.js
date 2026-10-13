const SECONDARY_LABELS = {
  planner: "Personal planner", courseHub: "Courses", notifications: "Announcements",
  friends: "Social", board: "Campus Board", split: "Split expenses",
  leave: "Leave planner", pet: "Companion", wrapped: "Term Wrapped", admin: "Admin tools",
};

// Only real, visible parents become actions. Landscape tablets have no More hub.
export function v2BreadcrumbItems({ view, isTablet = false, onOpenMore, detail, onBack }) {
  const label = SECONDARY_LABELS[view];
  if (!label) return [];
  const items = [];
  if (!isTablet && onOpenMore) items.push({ id: "more", label: "More", onSelect: onOpenMore });
  items.push({ id: view, label, onSelect: detail ? onBack : undefined });
  if (detail) items.push({ id: "detail", label: detail });
  return items.length > 1 ? items : [];
}

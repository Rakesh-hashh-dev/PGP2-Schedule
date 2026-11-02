export function navVisible(id, config = {}) { return id === 'today' || config.items?.[id]?.visible !== false; }
export function navLabel(id, fallback, config = {}) { return config.items?.[id]?.label || fallback; }
export function configureNav(items, config = {}) {
  const order = config.order || [];
  return items.filter(item => navVisible(item.id, config)).map(item => ({ ...item, label: navLabel(item.id, item.label, config) })).sort((a, b) => {
    const ai = order.indexOf(a.id), bi = order.indexOf(b.id);
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  });
}

const object = value => value && typeof value === 'object' && !Array.isArray(value);
export function sameAdminDraft(a,b) {
  if(Object.is(a,b))return true;
  if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((value,index)=>sameAdminDraft(value,b[index]));
  if(object(a)&&object(b)){const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&sameAdminDraft(a[key],b[key]));}
  return false;
}
const same=sameAdminDraft;
// Arrays are one field: their ordering can carry meaning and must not be guessed.
export function mergeAdminDraft(base, local, remote, keys = []) {
  if (same(local, base)) return { value: remote, conflicts: [] };
  if (same(remote, base) || same(local, remote)) return { value: local, conflicts: [] };
  if (object(base) && object(local) && object(remote)) {
    const entries = [], conflicts = [];
    for (const key of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])) {
      const merged = mergeAdminDraft(base[key], local[key], remote[key], [...keys, key]);
      if (merged.value !== undefined) entries.push([key, merged.value]);
      conflicts.push(...merged.conflicts);
    }
    return { value: Object.fromEntries(entries), conflicts };
  }
  return { value: local, conflicts: [{ path: keys.join(' / '), keys, base, local, remote }] };
}
export function resolveDraftField(value, keys, replacement) {
  if (keys.length === 0) return structuredClone(replacement);
  const result = structuredClone(value);
  let target = result;
  for (const key of keys.slice(0, -1)) {
    if (!Object.hasOwn(target, key)) Object.defineProperty(target, key, { value: {}, enumerable: true, writable: true, configurable: true });
    target = target[key];
  }
  if (replacement === undefined) delete target[keys.at(-1)];
  else Object.defineProperty(target, keys.at(-1), { value: replacement, enumerable: true, writable: true, configurable: true });
  return result;
}

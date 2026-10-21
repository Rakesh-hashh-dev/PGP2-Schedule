// Habitat choices are cosmetic only, stored in the existing cosmetics JSON.
export const HABITATS = [
  { key: 'garden', label: 'Quiet garden', detail: 'Soft hills and a little room to breathe.' },
  { key: 'study', label: 'Study nook', detail: 'A window seat for your study buddy.' },
  { key: 'observatory', label: 'Star terrace', detail: 'A peaceful corner above the clouds.' },
];
export const HABITAT_LIGHTS = [
  { key: 'auto', label: 'Follow my day' },
  { key: 'day', label: 'Daylight' },
  { key: 'night', label: 'Moonlight' },
];
export const HABITAT_DECOR = [
  { key: 'plant', label: 'Little plant' },
  { key: 'books', label: 'Book stack' },
  { key: 'lantern', label: 'Warm lantern' },
  { key: 'cushion', label: 'Soft cushion' },
];
const sceneKeys = new Set(HABITATS.map(item => item.key));
const lightKeys = new Set(HABITAT_LIGHTS.map(item => item.key));
const decorKeys = new Set(HABITAT_DECOR.map(item => item.key));
export function validHabitat(value) {
  return Boolean(value && typeof value === 'object' && sceneKeys.has(value.scene)
    && lightKeys.has(value.light) && Array.isArray(value.decor)
    && value.decor.length <= decorKeys.size && new Set(value.decor).size === value.decor.length
    && value.decor.every(key => decorKeys.has(key)));
}
export function normalizeHabitat(value) {
  if (validHabitat(value)) return value;
  return {
    scene: sceneKeys.has(value?.scene) ? value.scene : 'garden',
    light: lightKeys.has(value?.light) ? value.light : 'auto',
    decor: Array.isArray(value?.decor)
      ? HABITAT_DECOR.filter(item => value.decor.includes(item.key)).map(item => item.key)
      : ['plant', 'cushion'],
  };
}
/** Local device time, like the schedule. No timezone is persisted into a cosmetic. */
export function habitatLight(value, now) {
  const { light } = normalizeHabitat(value);
  if (light !== 'auto') return light;
  const hour = now instanceof Date ? now.getHours() : NaN;
  return Number.isFinite(hour) && hour >= 6 && hour < 18 ? 'day' : 'night';
}
export function toggleHabitatDecor(value, key) {
  const habitat = normalizeHabitat(value);
  if (!decorKeys.has(key)) return habitat;
  return { ...habitat, decor: habitat.decor.includes(key)
    ? habitat.decor.filter(item => item !== key) : [...habitat.decor, key] };
}

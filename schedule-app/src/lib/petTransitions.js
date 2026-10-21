// Add a short correction over the new CSS action rather than restarting from
// rest. The additive matrix decays while the target animation keeps moving.
export const PET_BLEND_MS = 180;
const PARTS = '.pet-rig-frame,.pet-rig-head,.pet-rig-body,.pet-rig-neck,.pet-rig-feet,.pet-rig-tail,.pet-rig-wing-left,.pet-rig-wing-right,.dg-pet-ear,.dg-pet-paw,.dg-pet-pupils,.dg-pet-vine-leaf';
export function capturePetPose(root) {
  if (!root) return [];
  const parts = [...root.querySelectorAll(PARTS)].map(element => ({ element, transform: getComputedStyle(element).transform }));
  if (root.closest('.pet-habitat')) {
    const bounds=root.getBoundingClientRect();
    parts.push({element:root,position:{x:bounds.x+(globalThis.scrollX || 0),y:bounds.y+(globalThis.scrollY || 0)}});
  }
  return parts;
}
export function blendPetPose(root, snapshots, Matrix = globalThis.DOMMatrix) {
  if (!root || !Matrix) return [];
  return snapshots.flatMap(({ element, transform, position }) => {
    if (!root.contains(element) || !element.animate || getComputedStyle(element).display === 'none') return [];
    try {
      if (position) {
        // Bounding positions also handle the calc(% + px) values produced when
        // an already blended flight is interrupted again.
        const bounds=element.getBoundingClientRect();
        const delta=[position.x-bounds.x-(globalThis.scrollX || 0),position.y-bounds.y-(globalThis.scrollY || 0)];
        if (delta.some(value=>!Number.isFinite(value)) || delta.every(value=>Math.abs(value)<.01)) return [];
        return [element.animate([{translate:`${delta[0]}px ${delta[1]}px`},{translate:'0px 0px'}],{duration:PET_BLEND_MS,easing:'cubic-bezier(.2,.7,.3,1)',composite:'add'})];
      }
      const current = new Matrix(getComputedStyle(element).transform === 'none' ? undefined : getComputedStyle(element).transform);
      const before = new Matrix(transform === 'none' ? undefined : transform);
      const correction = current.inverse().multiply(before);
      if (!Number.isFinite(correction.a) || correction.isIdentity) return [];
      return [element.animate([{ transform: correction.toString() }, { transform: 'none' }], {
        duration: PET_BLEND_MS, easing: 'cubic-bezier(.2,.7,.3,1)', composite: 'add',
      })];
    } catch { return []; } // A detached/noninvertible part falls back to its CSS pose.
  });
}

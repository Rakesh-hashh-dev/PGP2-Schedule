import { afterEach, describe, it, expect, vi } from 'vitest';
import { capturePetPose, blendPetPose, PET_BLEND_MS } from './petTransitions.js';
afterEach(()=>vi.unstubAllGlobals());
function actor() {
 let bounds={x:30,y:50};
 const root={closest:()=>true,querySelectorAll:()=>[],getBoundingClientRect:()=>bounds,animate:vi.fn(()=>({cancel:vi.fn()}))};
 root.contains=element=>element===root;
 vi.stubGlobal('scrollX',0);vi.stubGlobal('scrollY',0);
 // Chromium serializes additive percentage/pixel translations this way.
 vi.stubGlobal('getComputedStyle',()=>({display:'block',translate:'calc(11% + 2.4px) calc(-16% - 1.2px)'}));
 return {root,move:next=>{bounds=next;}};
}
describe('habitat flight interruption',()=>{
 it('preserves a sampled position even during an existing additive blend',()=>{
  const {root,move}=actor();const pose=capturePetPose(root);move({x:45,y:38});
  const corrections=blendPetPose(root,pose,{});
  expect(corrections).toHaveLength(1);
  expect(root.animate).toHaveBeenCalledWith([{translate:'-15px 12px'},{translate:'0px 0px'}],expect.objectContaining({duration:PET_BLEND_MS,composite:'add'}));
 });
 it('does not interpret viewport scrolling as a flight movement',()=>{
  const {root,move}=actor();vi.stubGlobal('scrollY',200);const pose=capturePetPose(root);
  move({x:30,y:25});vi.stubGlobal('scrollY',225);
  expect(blendPetPose(root,pose,{})).toEqual([]);expect(root.animate).not.toHaveBeenCalled();
 });
});

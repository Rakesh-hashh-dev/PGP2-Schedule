import {expect,it,vi} from 'vitest';
vi.mock('./supabase',()=>({supabase:{}}));
import {composePublicationFlags,pendingPublicationChanges,ADMIN_DEFAULT_FLAGS,canonicalJson} from './adminPublicationDomains.js';
it('counts banner edits, removed settings and form-only edits without inventing blank settings',()=>{
  expect(composePublicationFlags({},[],{title:'',desc:'',highlights:[]})).toEqual({});
  expect(composePublicationFlags(ADMIN_DEFAULT_FLAGS,[],{title:'',desc:'',highlights:[]},{})).toEqual({});
  expect(pendingPublicationChanges({enableFriends:true},{},null,null)).toBe(1);
  expect(pendingPublicationChanges({}, {},null,{text:'Changed'})).toBe(1);
  expect(pendingPublicationChanges({},composePublicationFlags({},[],{title:'Update',desc:'',highlights:[]}),null,null)).toBe(1);
});

it('does not trigger a false pending change when object key insertion order differs', () => {
  const original = {
    updatePrompt: { desc: '', title: '', highlights: [] },
  };
  const proposed = {
    updatePrompt: { title: '', desc: '', highlights: [] },
  };
  expect(canonicalJson(original.updatePrompt)).toBe(canonicalJson(proposed.updatePrompt));
  expect(pendingPublicationChanges(original, proposed, null, null)).toBe(0);
});

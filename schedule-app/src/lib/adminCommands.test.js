import { expect,it } from 'vitest';
import { availableAdminCommands,adminCommandDate } from './adminCommands.js';
import { loadAdminWorkspacePrefs,saveAdminWorkspacePrefs } from './adminWorkspacePrefs.js';
it('filters commands by role and never embeds a mutation callback',()=>{
  expect(availableAdminCommands('monitor').some(command=>command.id==='menu-tomorrow')).toBe(false);
  expect(availableAdminCommands('superadmin','tomorrow').map(command=>command.id)).toContain('classes-tomorrow');
  expect(availableAdminCommands(null)).toEqual([]);
  expect(availableAdminCommands('superadmin').every(command=>!command.run)).toBe(true);
  expect(adminCommandDate(1,new Date('2026-11-04T20:00:00Z'))).toBe('2026-11-06');
});
it('scopes saved shortcuts to identity and never stores sensitive filters',()=>{
  const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
  saveAdminWorkspacePrefs('one',{version:1,pins:['reports','bad'],filters:{dataset:'audit',query:'private student name',userId:'s'}},storage);
  expect(loadAdminWorkspacePrefs('one',storage)).toEqual({version:1,pins:['reports'],filters:{dataset:'audit'}});
  expect(loadAdminWorkspacePrefs('two',storage).pins).toEqual([]);
  expect(saveAdminWorkspacePrefs('one',{}, {setItem:()=>{throw new Error('denied');}})).toBe(false);
});

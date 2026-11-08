import {publicationDomain} from './adminPublication.js';
export const ADMIN_DEFAULT_FLAGS={enableFriends:true,enableExams:true,enableAttendance:true,maintenanceMode:false,bannedUsers:[],classOverrides:{},abTests:{},dispatchEnabled:true,greetingPets:{enabled:true,petKey:'cat',motion:true,companion:true,xpRate:1,signatures:true,wardrobe:true,hatsOff:[]}};
export function composePublicationFlags(flags,flashes,prompt,original={}) {
  const result={...flags}; delete result.feedbackFlash;
  for(const [key,value] of Object.entries(ADMIN_DEFAULT_FLAGS)) if(!Object.hasOwn(original||{},key) && JSON.stringify(result[key])===JSON.stringify(value)) delete result[key];
  if(flashes.length || Object.hasOwn(flags,'feedbackFlashes') || Object.hasOwn(flags,'feedbackFlash')) result.feedbackFlashes=flashes;
  if(prompt.title || prompt.desc || prompt.highlights.length || Object.hasOwn(flags,'updatePrompt')) result.updatePrompt=prompt;
  return result;
}
export function pendingPublicationChanges(original,proposed,originalAnnouncement,announcement) {
  if(!original)return 0;
  return [...new Set([...Object.keys(original),...Object.keys(proposed)])].filter(key=>publicationDomain(key) && JSON.stringify(original[key])!==JSON.stringify(proposed[key])).length
    +(JSON.stringify(originalAnnouncement)!==JSON.stringify(announcement)?1:0);
}

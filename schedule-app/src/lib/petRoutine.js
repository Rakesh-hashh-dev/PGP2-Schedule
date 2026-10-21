import { PET_PROFILES } from './petProfiles.js';
import { buddyPlan } from './petBuddy.js';
const MOMENTS=new Set(['celebrating','proud','birthday','festive','reunion','hyped']);
/** Uses the same local device clock and observed timetable as the companion page. */
export function routineFor({now,inClass=false,minsToClass=null,classesToday=0,habitat,favorite,mood}) {
 if(habitat?.routines===false || MOMENTS.has(mood) || !(now instanceof Date) || !Number.isFinite(now.getTime()))return null;
 const decor=Array.isArray(habitat?.decor)?habitat.decor:[];
 const available=(preferred,fallback='sky')=>decor.includes(preferred)?preferred:decor.includes(fallback)?fallback:'sky';
 if(inClass || (Number.isFinite(minsToClass) && minsToClass>=0 && minsToClass<=10))return {key:'study',label:inClass?'Class time':'Class soon',description:inClass?'Settling quietly beside the books.':'Getting comfortable before class.',target:available('books'),mood:'focused'};
 const hour=now.getHours();
 if(hour>=22 || hour<6)return {key:'sleep',label:'Time to rest',description:'A soft place to settle for the night.',target:available('cushion'),mood:'sleepy'};
 if(hour>=18)return {key:'evening',label:'Evening glow',description:'Gathering for a quiet moment by the light.',target:available('lantern',favorite),mood:'cozy'};
 const nextAt=Number.isFinite(minsToClass)?new Date(now.getTime()+minsToClass*60000):null;
 const between=classesToday>0 && minsToClass>10 && nextAt?.toDateString()===now.toDateString();
 return {key:'break',label:between?'Between classes':'Free time',description:'Room for a favourite spot or a familiar hello.',target:decor.includes(favorite)?favorite:null,mood:null};
}
export function routineKey(routine) {return routine ? `${routine.key}:${routine.target || ''}`:'';}
/** Both actors follow one plan; no second automatic buddy clock. */
export function routinePlan(primary,buddy,routine,{familiarity=0,greet=false}={}) {
 if(!routine || !Object.hasOwn(PET_PROFILES,primary))return [];
 buddy=Object.hasOwn(PET_PROFILES,buddy)?buddy:null;
 if(routine.key==='break')return greet && buddy ? buddyPlan(primary,buddy,'greet',familiarity).map(step=>({...step,target:'sky',behavior:'watch',label:'shares a familiar little hello.',routine:'break'})):[];
 const resting=routine.key==='sleep' && routine.target==='cushion';
 const step={target:routine.target,action:resting?'doze':'listen',behavior:resting?'rest':'quiet-visit',routine:routine.key,label:resting?'settles on the cushion for the night.':routine.key==='study'?(routine.target==='books'?'settles quietly beside the books.':'settles into a quiet study spot.'):(routine.target==='lantern'?'takes a quiet seat by the lantern.':'settles into a quiet evening spot.')};
 return [{...step,role:'primary',at:0},...(buddy?[{...step,role:'buddy',at:familiarity>=3?250:550}]:[])];
}

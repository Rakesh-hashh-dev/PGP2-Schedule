import { useId } from 'react';
import PetEyes from './PetEyes.jsx';
import PetExpression from './PetExpression.jsx';
import PetGrowthDetail from './PetGrowthDetail.jsx';

// Midnight moon wolf. Shared rig anchors keep her howl, gaze and wardrobe attached.
export default function Luna() {
 const id='luna'+useId().replace(/\W/g,'');
 const ink='#24273e',fur=`url(#${id}-fur)`,silver=`url(#${id}-silver)`;
 return <svg className="pet-art pet-rig" viewBox="0 0 32 32" aria-hidden="true">
  <defs>
   <radialGradient id={`${id}-fur`} cx="32%" cy="22%" r="85%"><stop stopColor="#8797be"/><stop offset=".5" stopColor="#51638c"/><stop offset="1" stopColor="#303c60"/></radialGradient>
   <linearGradient id={`${id}-silver`} x2=".3" y2="1"><stop stopColor="#fffaf0"/><stop offset="1" stopColor="#cdd9e8"/></linearGradient>
  </defs>
  <ellipse className="dg-pet-ground" cx="16" cy="30.3" rx="8" ry=".8" fill="#24273e" opacity=".13"/>
  <g className="dg-pet-canvas" transform="translate(1 .35) scale(.935)">
   <g className="dg-pet-body pet-rig-frame" data-part="body" data-pet-part="body">
    <g className="dg-pet-tail pet-rig-tail" data-part="tail" data-pet-part="tail">
     <path d="M20 28.4c6 2 11-1.8 10.2-7.1-.3-2.5-1.8-4.7-4.4-6.1.9 3.6-.9 4.5-2.6 6.6-1.2 1.5-2.2 3.3-3.2 6.6Z" fill={fur} stroke={ink} strokeWidth=".9" strokeLinejoin="round"/>
     <path d="M25.8 15.2c2.6 1.4 4.1 3.6 4.4 6.1.1 1.2 0 2.3-.5 3.3l-2.5-1 .4-1.4-1.8-.8 1.2-1.3c.5-1.3-.1-3.5-1.2-4.9Z" fill={silver}/>
     <path d="M23 27.3q3.2.3 4.7-2.2" fill="none" stroke="#aab9d4" strokeWidth=".5" strokeLinecap="round"/>
     <path d="m24.6 22.9 1-.6-.2 1.4m-2 1.3 1-.4-.2 1.1" fill="none" stroke="#97accf" strokeWidth=".36" strokeLinecap="round" strokeLinejoin="round" opacity=".8"/>
    </g>
    <path d="M10.4 22.2q5.6-3.3 11.2 0l.9 5.8q-1 3-6.5 3t-6.5-3Z" fill={fur} stroke={ink} strokeWidth=".9" strokeLinejoin="round"/>
    <path d="m11 22.4 2 1.4 1.3-1.2 1.7 1.8 1.7-1.8 1.3 1.2 2-1.4-.7 4.3-1.9-.3L16 29l-2.4-2.6-1.9.3Z" fill={silver}/>
    <path d="m12.5 24 .8 1.3.7-.4m5.5-.9-.8 1.3-.7-.4m-3.2.8 1.2 1.4 1.2-1.4" fill="none" stroke="#9baec8" strokeWidth=".34" strokeLinecap="round" strokeLinejoin="round" opacity=".7"/>
    <g fill={silver} stroke={ink} strokeWidth=".8"><path d="M10.6 26.8q3.2-1 4 1.7l-.3 1.7h-4q-1.4-1.6.3-3.4Z"/><path d="M21.4 26.8q-3.2-1-4 1.7l.3 1.7h4q1.4-1.6-.3-3.4Z"/></g>
    <path d="M11.5 29v.7m1.4-.7v.7m6.2-.7v.7m1.4-.7v.7" stroke="#7485a2" strokeWidth=".45" strokeLinecap="round"/>
    <g className="dg-pet-head pet-rig-head" data-part="head" data-pet-part="head" style={{'--pet-head-x':'16px','--pet-head-y':'24px'}}>
     <g className="dg-pet-ear dg-pet-ear-left" data-part="ear-left"><path d="M7.1 12 5.9 1.5q4.8 1.6 7.3 7.3Z" fill={fur} stroke={ink} strokeWidth="1" strokeLinejoin="round"/><path d="m8.1 9-.5-4.6q2.4 1.5 3.4 4.3Z" fill="#b8b2d6"/><path d="m6 2 1.8 1-.2 2.3-1.3-1Z" fill={silver}/><path d="m8.2 6 .3 1.6.6-.4" fill="none" stroke="#e4dfec" strokeWidth=".35" strokeLinecap="round" opacity=".8"/></g>
     <g className="dg-pet-ear dg-pet-ear-right" data-part="ear-right"><path d="M18.8 8.8q2.5-5.7 7.3-7.3L24.9 12Z" fill={fur} stroke={ink} strokeWidth="1" strokeLinejoin="round"/><path d="m21 8.7q1-2.8 3.4-4.3L23.9 9Z" fill="#b8b2d6"/><path d="m26 2-1.8 1 .2 2.3 1.3-1Z" fill={silver}/><path d="m23.8 6-.3 1.6-.6-.4" fill="none" stroke="#e4dfec" strokeWidth=".35" strokeLinecap="round" opacity=".8"/></g>
     <path className="dg-pet-face" d="M16 7.5q7.8-.5 9.6 7.1l2.2 1.6-1.9.7 1.5 2-2.6.1.4 1.6-2.5-.2q-2 4-6.7 4.3-4.7-.3-6.7-4.3l-2.5.2.4-1.6-2.6-.1 1.5-2-1.9-.7 2.2-1.6Q8.2 7 16 7.5Z" fill={fur} stroke={ink} strokeWidth="1.05" strokeLinejoin="round"/>
     <path d="M7.6 16.3q1.8-4.1 5.3-2.9l3.1 2.1 3.1-2.1q3.5-1.2 5.3 2.9l-1.9 1.3 1 1.5-2 .3q-1.5 4.4-5.5 4.8-4-.4-5.5-4.8l-2-.3 1-1.5Z" fill={silver}/>
     <path d="m7.8 18.2 1.1.1-.3.7m15.6-.8-1.1.1.3.7M11 20.9l1 .4m9-.4-1 .4" fill="none" stroke="#9cadc5" strokeWidth=".34" strokeLinecap="round" strokeLinejoin="round" opacity=".75"/>
     <path d="m16 8.3 1 2.3-1 1.1-1-1.1Z" fill="#b5c9e2"/>
     <path d="M17.4 9.3a1.5 1.5 0 1 0 .1 2.5 1.4 1.4 0 0 1-.1-2.5Z" fill="#f5d796"/>
     <path d="M9.3 12.7q1.6-.7 3 .1M19.7 12.8q1.4-.8 3-.1" fill="none" stroke="#cbd8ed" strokeWidth=".6" strokeLinecap="round"/>
     <PetEyes pet="luna" left={12.1} right={19.9} y={16.2} rx={1.9} ry={2.05} ink={ink} iris="#81c9da"/>
     <path d="M8.6 19.4h.1m1 .5h.1m12.4 0h.1m1-.5h.1" stroke="#8496b4" strokeWidth=".6" strokeLinecap="round"/>
     <ellipse cx="16" cy="20.4" rx="3.1" ry="2.15" fill="#fffdf6"/>
     <path className="dg-pet-sig dg-pet-sig-new-nose" d="M14.6 18.8q1.4-.6 2.8 0-.1 1.1-1.4 1.5-1.3-.4-1.4-1.5Z" fill={ink}/>
     <path d="m15 18.9.7-.1" stroke="#d5def1" strokeWidth=".3" strokeLinecap="round"/>
     <path className="dg-pet-mouth-base" d="M16 20.3v.6m0 0q-1.1 1-2.1.2m2.1-.2q1.1 1 2.1.2" fill="none" stroke={ink} strokeWidth=".65" strokeLinecap="round"/>
     <PetExpression pet="luna" left={12.1} right={19.9} y={16.2} rx={1.9} ry={2.05} mouthY={21} ink={ink}/>
     <PetGrowthDetail pet="luna"/>
    </g>
    <g className="dg-pet-accessory"><path d="M10.6 24.5q5.4 1.6 10.8 0l.2 1.3q-5.6 1.7-11.2 0Z" fill="#2c3554" stroke={ink} strokeWidth=".45"/><path d="M10.9 25q5.1 1.3 10.2 0" fill="none" stroke="#93a6c8" strokeWidth=".35"/><circle cx="16" cy="26.5" r=".5" fill="none" stroke="#d8b776" strokeWidth=".4"/><path d="M16.8 26.8a1.4 1.4 0 1 0 .2 2.5 1.3 1.3 0 0 1-.2-2.5Z" fill="#f5d796" stroke="#aa844d" strokeWidth=".25"/></g>
   </g>
  </g>
 </svg>;
}

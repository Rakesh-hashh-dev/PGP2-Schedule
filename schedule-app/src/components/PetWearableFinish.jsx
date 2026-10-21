import { Children, cloneElement, isValidElement, useId } from 'react';

const COLOR=/^#[\da-f]{6}$/i;
function channels(color) { return [1,3,5].map(start=>parseInt(color.slice(start,start+2),16)); }
function tone(color,amount) { return '#'+channels(color).map(value=>Math.round(amount>0?value+(255-value)*amount:value*(1+amount)).toString(16).padStart(2,'0')).join(''); }
// Local paint servers preserve each item's palette and geometry. Dark outlines,
// white glints and opacity stay crisp; coloured surfaces gain a lit material.
export default function PetWearableFinish({children}) {
 const id='wear'+useId().replace(/\W/g,'');
 const colors=new Set();
 const eligible=color=>typeof color==='string' && COLOR.test(color) && Math.max(...channels(color))>65 && color.toLowerCase()!=='#ffffff';
 function collect(nodes) {Children.forEach(nodes,node=>{if(!isValidElement(node))return;if(eligible(node.props.fill))colors.add(node.props.fill);collect(node.props.children);});}
 collect(children);
 function paint(nodes) {return Children.map(nodes,node=>!isValidElement(node)?node:cloneElement(node,{...(eligible(node.props.fill)?{fill:`url(#${id}-${node.props.fill.slice(1)})`}:{}),...(node.props.children?{children:paint(node.props.children)}:{})}));}
 return <><defs>{[...colors].map(color=><linearGradient key={color} id={`${id}-${color.slice(1)}`} x1="10%" y1="0%" x2="85%" y2="100%"><stop stopColor={tone(color,.3)}/><stop offset=".4" stopColor={color}/><stop offset="1" stopColor={tone(color,-.18)}/></linearGradient>)}</defs>{paint(children)}</>;
}

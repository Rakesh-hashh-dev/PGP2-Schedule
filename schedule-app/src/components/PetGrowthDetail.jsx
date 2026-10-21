import { PET_PROFILES } from '../lib/petProfiles.js';
// Broad markings follow the owning head and disappear below badge size.
export default function PetGrowthDetail({ pet }) {
  const type = PET_PROFILES[pet]?.growth || 'fur';
  const x = pet === 'pebble' ? 23.7 : pet === 'prickle' ? 19 : 16;
  const y = pet === 'pebble' ? 13 : 11;
  const paths = {
    fur: `M${x-2} ${y}l.9 1m2.2-1-.9 1`,
    feather: `M${x-2} ${y}q2 2.3 4 0m-3 1.5q1 1 2 0`,
    scale: `M${x-2.5} ${y+1}l1.2-1 1.3 1 1.3-1 1.2 1`,
    circuit: `M${x-2.5} ${y}h1.5v1.4h2V${y}h1.5`,
    leaf: `M${x} ${y-1}v3m-2-2 2 1 2-1`,
    spark: `M${x} ${y-1.5}v3m-1.5-1.5h3`,
  };
  return <g className="pet-growth-detail" aria-hidden="true">
    <path className="pet-rig-mature" d={paths[type]} fill="none" stroke={type === 'circuit' ? '#b1f0df' : '#f7d79f'} strokeWidth=".6" strokeLinecap="round" opacity=".8" />
    <g className="pet-rig-baby" fill="#ef9dac" opacity=".3"><ellipse cx={x-5} cy="20" rx=".95" ry=".5" /><ellipse cx={x+5} cy="20" rx=".95" ry=".5" /></g>
  </g>;
}

import { HABITATS, HABITAT_LIGHTS, HABITAT_DECOR, normalizeHabitat, habitatLight, toggleHabitatDecor } from '../lib/petHabitat.js';
import '../styles/pet-habitat.css';

/** A decorative scene behind the existing actors; never intercepts their input. */
export default function PetHabitat({ value, now, motionEnabled = true, children, care, className = '' }) {
  const habitat = normalizeHabitat(value);
  const light = habitatLight(habitat, now);
  return <div className={`pet-identity-art pet-habitat ${className}`} data-scene={habitat.scene} data-light={light} data-habitat-motion={motionEnabled ? 'on' : 'off'} data-care={care || undefined}>
    <svg className="pet-habitat-scenery" viewBox="0 0 240 240" aria-hidden="true" focusable="false">
      <circle className="habitat-sun" cx="181" cy="44" r="16" />
      <g className="habitat-moon"><circle cx="181" cy="44" r="16" /><circle className="habitat-moon-cutout" cx="188" cy="38" r="14" /></g>
      <g className="habitat-stars" fill="currentColor"><path d="m40 31 1.8 5 5 1.8-5 1.8-1.8 5-1.8-5-5-1.8 5-1.8Z" /><circle cx="104" cy="27" r="1.5" /><circle cx="143" cy="61" r="1.5" /><circle cx="207" cy="91" r="1.5" /><circle cx="67" cy="73" r="1" /></g>
      {habitat.scene === 'garden' && <g className="habitat-landscape"><path className="habitat-hill-back" d="M0 166Q51 108 113 159T240 144V240H0Z" /><path className="habitat-hill-front" d="M0 192Q86 147 240 184V240H0Z" /><path className="habitat-path" d="M120 180Q164 194 148 240H87Q135 209 120 180Z" /><g className="habitat-flowers"><path d="M25 183v10m-4-6h8m181-13v10m-4-6h8" /></g></g>}
      {habitat.scene === 'study' && <g className="habitat-room"><path className="habitat-window" d="M31 31h178v133H31Z" /><path className="habitat-window-frame" d="M31 164V31h178v133M120 31v133M31 98h178M21 164h198" /><path className="habitat-floor" d="M0 182h240v58H0Z" /><path className="habitat-floor-line" d="M0 200h240M0 224h240M41 182l-12 58m170-58 12 58" /></g>}
      {habitat.scene === 'observatory' && <g className="habitat-terrace"><path className="habitat-cloud" d="M0 147q15-24 34-8 24-34 48 4 23-11 37 10H0Zm149 1q15-22 30-9 22-29 39 1 16-8 22 8Z" /><path className="habitat-floor" d="M0 185Q120 159 240 185V240H0Z" /><path className="habitat-rail" d="M13 158Q120 137 227 158M20 157v28m200-28v28" /><ellipse className="habitat-orbit" cx="120" cy="215" rx="89" ry="15" /></g>}
      <ellipse className="habitat-ground-shadow" cx="113" cy="208" rx="62" ry="9" />
      {habitat.decor.includes('cushion') && <g className="habitat-cushion"><ellipse cx="112" cy="211" rx="56" ry="11" /><path d="M58 207q54 15 108 0" /></g>}
      {habitat.decor.includes('plant') && <g className="habitat-plant"><path className="habitat-pot" d="m14 187 4 22h17l4-22Z" /><path className="habitat-stem" d="M27 188v-28" /><path className="habitat-leaf" d="M27 177q-20 1-16-16 17-1 16 16Zm0-7q-1-19 17-19 1 17-17 19Z" /></g>}
      {habitat.decor.includes('books') && <g className="habitat-books"><rect x="183" y="204" width="39" height="9" rx="2" /><rect x="188" y="194" width="35" height="9" rx="2" /><path d="M191 197h27m-28 10h26" /></g>}
      {habitat.decor.includes('lantern') && <g className="habitat-lantern"><circle className="habitat-lantern-glow" cx="211" cy="165" r="23" /><path d="M205 151v-5a6 6 0 0 1 12 0v5" /><rect x="202" y="152" width="18" height="26" rx="5" /><path className="habitat-lantern-light" d="M211 157v15" /><path d="M200 179h22" /></g>}
    </svg>
    {children}
  </div>;
}

export function PetHabitatControls({ value, onChange }) {
  const habitat = normalizeHabitat(value);
  return <div className="pet-habitat-controls">
    <p className="pet-care-note">A little place to call home. These choices are free and shared by all your companions.</p>
    <fieldset><legend>Choose a place</legend><div className="pet-habitat-options">{HABITATS.map(item => <button type="button" key={item.key} aria-pressed={habitat.scene === item.key} onClick={() => onChange({ ...habitat, scene: item.key })}><span className="pet-habitat-swatch" data-scene={item.key} aria-hidden="true" /><strong>{item.label}</strong><span>{item.detail}</span></button>)}</div></fieldset>
    <fieldset><legend>Lighting</legend><div className="pet-habitat-toggles">{HABITAT_LIGHTS.map(item => <button type="button" key={item.key} aria-pressed={habitat.light === item.key} onClick={() => onChange({ ...habitat, light: item.key })}>{item.label}</button>)}</div><p className="pet-care-note">Follow my day uses your device time: daylight from 6 am to 6 pm.</p></fieldset>
    <fieldset><legend>Little comforts</legend><div className="pet-habitat-toggles">{HABITAT_DECOR.map(item => <button type="button" key={item.key} aria-pressed={habitat.decor.includes(item.key)} onClick={() => onChange(toggleHabitatDecor(habitat, item.key))}>{item.label}</button>)}</div></fieldset>
  </div>;
}

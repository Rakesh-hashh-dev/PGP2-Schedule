import { describe, it, expect } from 'vitest';
import { HABITATS, HABITAT_LIGHTS, HABITAT_DECOR, normalizeHabitat, validHabitat, habitatLight, toggleHabitatDecor } from './petHabitat.js';
import { adopt, emptyPet, normalize, setCosmetic, switchTo, xpOf } from './pet.js';
import { fromRow } from './petStorage.js';

describe('habitat persistence and compatibility', () => {
  it('upgrades an old cosmetic record without changing progress or equipment', () => {
    const old = adopt(emptyPet(), 'cat', 'Mochi', new Date(2026, 9, 21));
    delete old.cosmetics.habitat;
    const upgraded = normalize(JSON.parse(JSON.stringify(old)));
    expect(validHabitat(upgraded.cosmetics.habitat)).toBe(true);
    expect(upgraded.cosmetics.habitat).toEqual({scene:'garden',light:'auto',decor:['plant','cushion']});
    expect(upgraded.awarded).toEqual(old.awarded);
    expect(upgraded.name).toBe(old.name);
    expect(normalize(upgraded)).toBe(upgraded);
  });
  it('round-trips every scene and lighting through JSON and the cloud-row reader', () => {
    for (const scene of HABITATS) for (const light of HABITAT_LIGHTS) {
      const pet = setCosmetic(adopt(emptyPet(), 'cat', 'Mochi'), 'habitat', {scene:scene.key,light:light.key,decor:HABITAT_DECOR.map(item=>item.key)});
      const restored = fromRow({pet_key:pet.petKey, name:pet.name, adopted_at:pet.adoptedAt, cosmetics:JSON.parse(JSON.stringify(pet.cosmetics))});
      expect(restored.cosmetics.habitat).toEqual(pet.cosmetics.habitat);
      expect(xpOf(pet)).toBe(0);
      expect(switchTo(pet,'fox').cosmetics.habitat).toEqual(pet.cosmetics.habitat);
    }
  });
  it('rejects invalid scenes, lighting and decoration data safely', () => {
    for (const input of [null, false, 4, 'garden', {}, {scene:'bad', light:[], decor:'books'}]) {
      expect(validHabitat(normalizeHabitat(input))).toBe(true);
    }
    expect(normalizeHabitat({scene:'study',light:'night',decor:['books','books','unknown']})).toEqual({scene:'study',light:'night',decor:['books']});
    expect(normalizeHabitat({decor:[]} ).decor).toEqual([]);
  });
  it('toggles each decoration independently and ignores unknown keys', () => {
    let value = normalizeHabitat({scene:'study',light:'day',decor:[]});
    for (const {key} of HABITAT_DECOR) value = toggleHabitatDecor(value,key);
    expect(value.decor).toHaveLength(4);
    value = toggleHabitatDecor(value,'plant');
    expect(value.decor).not.toContain('plant');
    expect(toggleHabitatDecor(value,'bad')).toBe(value);
    expect(value.scene).toBe('study');
  });
  it('keeps no-op saves referentially stable', () => {
    const pet = emptyPet();
    expect(setCosmetic(pet,'habitat',pet.cosmetics.habitat)).toBe(pet);
  });
});
describe('device-time lighting', () => {
  it.each([[0,'night'],[5,'night'],[6,'day'],[12,'day'],[17,'day'],[18,'night'],[23,'night']])('resolves hour %s to %s', (hour, expected) => {
    expect(habitatLight(null,new Date(2026,9,21,hour))).toBe(expected);
  });
  it('honours manual lighting regardless of time', () => {
    expect(habitatLight({light:'day'},new Date(2026,9,21,23))).toBe('day');
    expect(habitatLight({light:'night'},new Date(2026,9,21,12))).toBe('night');
  });
});

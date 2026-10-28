// Used by pet-browser-check.mjs in an isolated Chromium profile.
/* global window, document, getComputedStyle, innerWidth, innerHeight */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PET_PROFILES } from '../src/lib/petProfiles.js';

export async function verifyCompanions(send, sessionId, out, name, reduced) {
  const evaluate = async (fn, ...args) => {
    const result = await send('Runtime.evaluate', { expression: `(${fn.toString()})(...${JSON.stringify(args)})`, awaitPromise: true, returnByValue: true }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ': ' + result.exceptionDetails.exception?.description);
    return result.result.value;
  };
  for (let i = 0; i < 80; i++) {
    if (await evaluate(() => !!window.companionQA)) break;
    await new Promise(done => setTimeout(done, 100));
  }
  const report = await evaluate(async (dark, reduced, profiles) => {
    const qa = window.companionQA;
    if (!qa) throw new Error('Preview controls did not initialize');
    qa.setState({ theme: dark ? 'dark' : 'light', paused: true, outfit: true });
    const all = () => qa.samples().flatMap(p => [p, ...p.querySelectorAll('*')]);
    const animations = () => all().filter(e => getComputedStyle(e).animationName !== 'none');
    const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
    const duplicateIds = ids.filter((id, i) => ids.indexOf(id) !== i);
    const missingRefs = [];
    for (const node of document.querySelectorAll('.dg-pet *')) {
      for (const attr of node.attributes) for (const match of attr.value.matchAll(/url\(#([^)]*)\)/g)) {
        if (!document.getElementById(match[1])) missingRefs.push(match[1]);
      }
    }
    const result = { pets: qa.data.pets.length, moods: qa.data.moods.length, duplicateIds, missingRefs, width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth };
    qa.setState({ motion: false });
    result.motionOffAnimations = animations().length;
    const focusedPet = qa.samples()[0];
    focusedPet.focus({ preventScroll: true });
    result.motionOffFocusRotate = getComputedStyle(focusedPet.querySelector('.dg-pet-head')).rotate;
    qa.setState({ motion: true, signatures: false, beat: 'headtilt' });
    result.signatureOffBeats = qa.samples().filter(e => e.hasAttribute('data-beat')).length;
    qa.setState({ signatures: true, beat: '', reaction: '' });
    result.reducedAnimations = reduced ? animations().length : 0;
    result.reducedFocusRotate = reduced ? getComputedStyle(focusedPet.querySelector('.dg-pet-head')).rotate : 'none';
    focusedPet.blur();
    qa.setState({ mood: 'focused' });
    if (!reduced && getComputedStyle(focusedPet.querySelector('.dg-pet-head')).animationName !== getComputedStyle(focusedPet.querySelector('.dg-pet-wearable-head')).animationName) throw new Error('Hat does not follow focused head');
    const outside = [];
    const checkBounds = tag => {
      for (const pet of qa.samples().filter(p => p.style.width !== '40px')) {
        const svg = pet.querySelector('.pet-art');
        const box = svg.getBoundingClientRect();
        for (const shape of svg.querySelectorAll('path,circle,ellipse,rect,polygon')) {
          if (shape.closest('defs') || !shape.getClientRects().length) continue;
          const bounds = shape.getBoundingClientRect();
          if (!bounds.width || !bounds.height) continue;
          const unit = box.width / 32;
          // A half unit allows the authored outline, never a moving mass.
          if (bounds.left < box.left - unit * .5 || bounds.right > box.right + unit * .5 || bounds.top < box.top - unit * .5 || bounds.bottom > box.bottom + unit * .5) {
            outside.push({ pet: pet.dataset.pet, state: tag, part: shape.closest('[data-part]')?.dataset.part || shape.getAttribute('class'), bounds: [bounds.left - box.left, bounds.top - box.top, bounds.right - box.left, bounds.bottom - box.top].map(v => +(v / unit).toFixed(2)) });
          }
        }
      }
    };
    let combinations = 0;
    for (const size of [48, 96, 116, 160]) {
      for (const mood of qa.data.moods) {
        qa.setState({ size, mood, beat: '', reaction: '' });
        checkBounds(mood + '/' + size);
        combinations += qa.data.pets.length;
      }
    }
    // Test every species and mood action from the actual action-pool contract.
    qa.setState({ size: 160, mood: 'content' });
    for (const action of qa.data.actions) {
      qa.setState({ beat: action });
      checkBounds(action);
      combinations += qa.data.pets.length;
    }
    for (const reaction of ['pet', 'play', 'treat', 'leap']) {
      qa.setState({ reaction, mood: 'sleepy', beat: 'headtilt' });
      checkBounds('care/' + reaction);
      const pet = qa.samples().find(p => p.dataset.pet === 'cat');
      const head = pet.querySelector('.dg-pet-head');
      if (pet.dataset.beat || (!reduced && getComputedStyle(head).animationName !== 'petAttention')) throw new Error('Care head gesture lost priority');
      if (!reduced && getComputedStyle(head).animationName !== getComputedStyle(pet.querySelector('.dg-pet-wearable-head')).animationName) throw new Error('Hat does not follow care head');
      combinations += qa.data.pets.length;
    }
    result.rigActions = [];
    for (const action of [...new Set(Object.values(profiles).flatMap(p => p.idles))]) {
      qa.setState({ action, beat: '', reaction: '', mood: 'content' });
      const matching = qa.samples().filter(p => profiles[p.dataset.pet].idles.includes(action));
      for (const pet of qa.samples().filter(p => !profiles[p.dataset.pet].idles.includes(action))) {
        delete pet.dataset.action;
        delete pet.dataset.actionSource;
      }
      checkBounds('rig/' + action);
      for (const pet of matching) {
        const running = [pet,...pet.querySelectorAll('*')].filter(e => getComputedStyle(e).animationName !== 'none');
        if (!reduced && !running.length) throw new Error('No rig action animation: ' + pet.dataset.pet + '/' + action);
        if (reduced && running.length) throw new Error('Reduced rig action animated: ' + pet.dataset.pet + '/' + action);
      }
      result.rigActions.push({ action, pets: matching.length });
      combinations += qa.data.pets.length;
    }
    result.rigCare = [];
    for (const reaction of ['pet','play','treat','leap']) {
      qa.setState({ action: 'listen', reaction, mood: 'sleepy', beat: 'headtilt' });
      checkBounds('rig-care/' + reaction);
      for (const pet of qa.samples()) {
        const expected = reaction === 'leap' ? 'celebrate' : reaction;
        if (pet.dataset.action !== expected || pet.dataset.actionSource !== 'care' || pet.dataset.beat) throw new Error('Current rig care priority lost: ' + pet.dataset.pet);
        const head = getComputedStyle(pet.querySelector('.pet-rig-head')).animationName;
        const hat = getComputedStyle(pet.querySelector('.dg-pet-wearable-head')).animationName;
        if (head !== hat) throw new Error('Current care hat detached: ' + pet.dataset.pet);
      }
      result.rigCare.push(reaction);
      combinations += qa.data.pets.length;
    }
    qa.setState({ action: '', reaction: '', beat: '' });
    result.combinations = combinations;
    result.outside = outside;
    result.applicationPages = [];
    for (const pet of qa.data.pets) {
      qa.selectPage(pet.key);
      const hero = document.querySelector('#page-render .pet-identity-pet');
      if (hero?.dataset.pet !== pet.key || !hero.querySelector('svg')) throw new Error('Wrong application-page hero: ' + pet.key);
      if (document.documentElement.scrollWidth > innerWidth) throw new Error('Application-page overflow: ' + pet.key);
      result.applicationPages.push({ key: pet.key, heroWidth: +hero.getBoundingClientRect().width.toFixed(1) });
    }
    document.querySelector('#page-preview').open = false;
    const luna = qa.samples().find(p => p.dataset.pet === 'luna');
    result.lunaVector = !!luna.querySelector('svg.pet-rig') && !luna.querySelector('image,.luna-strip');
    result.lunaEyeProfile = luna.querySelector('.dg-pet-eyes')?.dataset.eyePersonality;
    result.lunaPupilClips = luna.querySelectorAll('.dg-pet-eye [clip-path]').length;
    if (!result.lunaVector || result.lunaEyeProfile !== 'luna' || result.lunaPupilClips !== 2) throw new Error('Luna vector/eye rig missing');
    result.lunaPriority = [];
    for (const reaction of ['pet','play','treat','leap']) {
      // A stale idle beat and sleepy face must yield to the care response.
      luna.dataset.mood = 'sleepy'; luna.dataset.beat = 'headtilt'; luna.dataset.reaction = reaction;
      const head = getComputedStyle(luna.querySelector('.pet-rig-head')).animationName;
      const joy = getComputedStyle(luna.querySelector('.dg-pet-expression-joy')).display;
      const rest = getComputedStyle(luna.querySelector('.dg-pet-expression-rest')).display;
      result.lunaPriority.push({ reaction, head, joy, rest });
      if ((!reduced && head !== 'petAttention') || (reduced && head !== 'none') || joy === 'none' || rest !== 'none') throw new Error('Luna care priority failure');
    }
    if (!reduced) {
      qa.setState({ mood: 'content', reaction: '', beat: '', paused: false });
      const head = luna.querySelector('.pet-rig-head');
      luna.scrollIntoView({ block: 'center' });
      await new Promise(done => setTimeout(done, 200));
      const before = getComputedStyle(head).transform;
      await new Promise(done => setTimeout(done, 400));
      result.lunaAdvances = getComputedStyle(head).transform !== before;
      if (!result.lunaAdvances) throw new Error('Luna vector head did not animate');
    }
    qa.setState({ reaction: '', beat: '', mood: 'content', paused: false });
    // Trigger the real visibility listener, then inspect every running layer.
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    result.hiddenUnpaused = animations().filter(e => getComputedStyle(e).animationPlayState !== 'paused').length;
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
    // Actual IntersectionObserver must pause a pet below the viewport.
    window.scrollTo(0, 0);
    const last = qa.samples().at(-1);
    last.style.position = 'relative';
    last.style.top = innerHeight + 'px';
    await new Promise(done => setTimeout(done, 600));
    result.offscreenObserved = last.hasAttribute('data-offscreen') && [last, ...last.querySelectorAll('*')].every(e => getComputedStyle(e).animationName === 'none' || getComputedStyle(e).animationPlayState === 'paused');
    last.style.removeProperty('position');
    last.style.removeProperty('top');
    qa.setState({ mood: 'content', paused: true, size: innerWidth < 600 ? 96 : 160, outfit: false });
    // Frozen captures include all pets, even those outside a normal viewport.
    for (const pet of qa.samples()) { pet.removeAttribute('data-offscreen'); for (const animation of pet.getAnimations({ subtree: true })) animation.currentTime = 550; }
    return result;
  }, name.includes('dark'), reduced, PET_PROFILES);
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, sessionId);
  writeFileSync(resolve(out, `companion-${name}.png`), Buffer.from(screenshot.data, 'base64'));
  writeFileSync(resolve(out, `${name}-report.json`), JSON.stringify(report, null, 2));
  if (report.duplicateIds.length || report.missingRefs.length || report.overflow || report.outside.length || report.motionOffAnimations || report.reducedAnimations || report.motionOffFocusRotate !== 'none' || report.reducedFocusRotate !== 'none' || report.signatureOffBeats || report.hiddenUnpaused || !report.offscreenObserved) throw new Error(`Companion QA failed: ${JSON.stringify(report)}`);
  // Record geometry findings for review; the caller decides whether any are
  // intended effects or a silhouette clipping defect before final delivery.
  console.log(`${name}: ${report.pets} pets, ${report.combinations} state/size renders; refs/motion/visibility/overflow PASS; ${report.outside.length} geometry observations`);
  return report;
}

// Preview-only controls; never reads or writes application storage.
(() => {
  const data = JSON.parse(document.querySelector('#preview-data').textContent);
  const control = id => document.getElementById(id);
  const samples = () => [...document.querySelectorAll('.companion-card .dg-pet')];
  const state = { theme: 'light', size: 160, mood: 'content', beat: '', reaction: '', outfit: false, motion: true, signatures: true, paused: false, action: '' };
  const setAttribute = (node, key, value) => value ? node.setAttribute(key, value) : node.removeAttribute(key);
  const apply = () => {
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.toggleAttribute('data-review-paused', state.paused);
    for (const card of document.querySelectorAll('.companion-card')) card.toggleAttribute('data-outfit', state.outfit);
    for (const pet of samples()) {
      pet.dataset.mood = state.mood;
      pet.dataset.motion = state.motion ? 'on' : 'off';
      setAttribute(pet, 'data-action', state.action ? (state.reaction ? (state.reaction === 'leap' ? 'celebrate' : state.reaction) : state.action) : '');
      setAttribute(pet, 'data-action-source', state.action ? (state.reaction ? 'care' : 'idle') : '');
      setAttribute(pet, 'data-sig', state.signatures ? '' : 'off');
      setAttribute(pet, 'data-neck', state.outfit ? 'scarf' : '');
      setAttribute(pet, 'data-reaction', state.reaction);
      // Care replaces any idle gesture, just as it does on the application page.
      setAttribute(pet, 'data-beat', !state.reaction && state.signatures ? (state.beat === 'signature' ? data.personalities[pet.dataset.pet][0] : state.beat) : '');
      if (pet.closest('.sample').querySelector('.sample-label').textContent.startsWith('Detail')) {
        pet.style.width = pet.style.height = state.size + 'px';
        pet.style.setProperty('--pet-overlay-k', state.size / 40);
        pet.closest('.sample').querySelector('.sample-label').textContent = 'Detail · ' + state.size + 'px';
      }
    }
    for (const animation of document.getAnimations()) animation.currentTime = state.paused ? 550 : 0;
  };
  const setState = update => {
    Object.assign(state, update);
    for (const [id, value] of Object.entries(state)) {
      if (!control(id)) continue;
      if (typeof value === 'boolean') control(id).checked = value;
      else control(id).value = value;
    }
    apply();
  };
  const selectPage = key => {
    control('page-render').innerHTML = data.pages[key];
    control('page-label').textContent = data.pets.find(p => p.key === key).label;
    control('page-preview').open = true;
  };
  for (const id of Object.keys(state).filter(id => control(id))) control(id).addEventListener('change', () => setState({ [id]: typeof state[id] === 'boolean' ? control(id).checked : id === 'size' ? Number(control(id).value) : control(id).value }));
  control('replay').addEventListener('click', apply);
  document.querySelectorAll('[data-select]').forEach(button => button.addEventListener('click', () => selectPage(button.dataset.select)));
  for (const pet of samples()) {
    let reset;
    const react = () => {
      clearTimeout(reset);
      delete pet.dataset.beat;
      pet.dataset.reaction = 'pet';
      for (const animation of pet.getAnimations({ subtree: true })) animation.currentTime = 0;
      reset = setTimeout(apply, 1500);
    };
    pet.addEventListener('click', react);
    pet.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); react(); } });
    pet.addEventListener('pointermove', event => {
      if (!state.motion || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const box = pet.getBoundingClientRect();
      pet.style.setProperty('--pet-look-x', ((event.clientX - box.left) / box.width - .5) * 1.5 + 'px');
      pet.style.setProperty('--pet-look-y', ((event.clientY - box.top) / box.height - .5) * 1.2 + 'px');
    });
    pet.addEventListener('pointerleave', () => { pet.style.removeProperty('--pet-look-x'); pet.style.removeProperty('--pet-look-y'); });
  }
  // The checker exercises the same controls the human reviewer uses.
  window.companionQA = { data, state, setState, selectPage, samples };
  setState({});
})();

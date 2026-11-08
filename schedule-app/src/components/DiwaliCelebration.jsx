import { useEffect, useRef, useState } from 'react';
import { Download, Users, Shirt, Power } from 'lucide-react';
import DiyaMark from './DiyaMark.jsx';
import PetCameo from './PetCameo.jsx';
import { downloadDiwaliCard } from '../lib/diwaliCard.js';
import '../styles/diwali.css';

export default function DiwaliCelebration({ festival, name, pet, petSettings, petContext, petsEnabled, now, onOpenBoard }) {
  const [downloading, setDownloading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [waving, setWaving] = useState(false);
  const [visible, setVisible] = useState(false);
  const rootRef = useRef(null);
  const artRef = useRef(null), diyaRef = useRef(null), greetingTimer = useRef(null);
  useEffect(() => () => clearTimeout(greetingTimer.current), []);
  useEffect(() => {
    let intersecting = true;
    const sync = () => setVisible(intersecting && !document.hidden);
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => { intersecting = entries[0]?.isIntersecting === true; sync(); }) : null;
    if (rootRef.current) observer?.observe(rootRef.current);
    sync(); document.addEventListener('visibilitychange', sync);
    return () => { observer?.disconnect(); document.removeEventListener('visibilitychange', sync); };
  }, [festival.enabled, festival.campaign?.key]);
  if (!festival.campaign) return null;
  const { campaign, enabled, prefs, update } = festival;
  const companionVisible = petsEnabled && pet?.petKey && pet?.companionEnabled !== false && petSettings?.enabled !== false;
  if (!enabled) return <section className="diwali-off" aria-label="Diwali preferences"><span>Diwali mode is off on this device.</span><button type="button" onClick={() => update({ enabled: true })}>Turn on Diwali mode</button></section>;
  const light = () => {
    update({ lit: true }); setFeedback('A little light for everything you’re working towards.');
    setWaving(true); clearTimeout(greetingTimer.current); greetingTimer.current = setTimeout(() => setWaving(false), 800);
  };
  const download = async () => {
    setDownloading(true); setFeedback('');
    try {
      await downloadDiwaliCard({ name, companionElement: companionVisible ? artRef.current?.querySelector('.dg-pet') : null, diyaElement: diyaRef.current, year: campaign.date.slice(0, 4) });
      setFeedback('Your card download is ready. Share it wherever you like.');
    } catch (error) { setFeedback(error.message || 'Could not create the card. Please try again.'); }
    finally { setDownloading(false); }
  };
  return <section ref={rootRef} className="diwali-celebration" data-visible={visible} data-lit={prefs.lit} data-motion={petSettings?.motion === false ? 'off' : 'on'} aria-labelledby="diwali-title">
    <div className="diwali-rangoli" aria-hidden="true"><svg viewBox="0 0 240 240"><g fill="none" stroke="currentColor" strokeWidth="1">{Array.from({ length: 12 }, (_, index) => <ellipse key={index} cx="120" cy="77" rx="17" ry="49" transform={`rotate(${index * 30} 120 120)`} />)}<circle cx="120" cy="120" r="28" /><circle cx="120" cy="120" r="97" /></g></svg></div>
    <header className="diwali-topline"><span className="diwali-eyebrow"><span className="diwali-eyebrow-ornament" aria-hidden="true" /><span className="diwali-eyebrow-copy">A little light for your day</span></span><button type="button" className="diwali-disable" onClick={() => update({ enabled: false })} aria-label="Turn off Diwali mode on this device"><Power size={13} /> Turn off</button></header>
    <div className="diwali-main"><div className="diwali-copy"><p className="diwali-kicker">Your festive companion corner</p><h2 id="diwali-title">{campaign.greeting}{name ? `, ${name}` : ''}.</h2><p>A little light for everything you’re working towards.</p><p className="diwali-support">Your day, at your pace. Your timetable stays close by.</p></div>
      <div className="diwali-art"><button type="button" className="diwali-light" onClick={light} aria-pressed={prefs.lit} aria-label={prefs.lit ? 'Your diya is lit. Replay the greeting' : 'Light your Diwali diya'}><span ref={diyaRef}><DiyaMark lit={prefs.lit} /></span><span>{prefs.lit ? 'Your little light · tap for a greeting' : 'Tap to light your diya'}</span></button>
        {companionVisible && <div ref={artRef} className="diwali-companion" data-festive-reaction={waving ? 'hello' : undefined}><PetCameo pet={pet} petSettings={petSettings} petContext={petContext} now={now} size={94} festive={festival.outfit} /><span>{pet.name || 'Your companion'} is celebrating with you.</span></div>}
      </div></div>
    <div className="diwali-actions"><button type="button" onClick={download} disabled={downloading}><Download size={15} /> {downloading ? 'Creating your card…' : 'Download greeting card'}</button>{onOpenBoard && <button type="button" onClick={onOpenBoard}><Users size={15} /> Campus celebrations</button>}{companionVisible && petSettings?.wardrobe !== false && <button type="button" aria-pressed={prefs.outfit} onClick={() => update({ outfit: !prefs.outfit })}><Shirt size={15} /> Festive scarf {prefs.outfit ? 'on' : 'off'}</button>}</div>
    <p className="diwali-feedback" role="status">{feedback || (prefs.lit ? 'Your diya stays lit for this celebration on this device.' : 'A small moment for you. Light it whenever you like.')}</p>
    <footer className="diwali-signoff"><span aria-hidden="true" /><p>With warm wishes,<strong>Rakesh</strong></p></footer>
  </section>;
}

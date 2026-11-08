import { useEffect, useRef } from 'react';
import DiyaMark from './DiyaMark.jsx';
import '../styles/diwali-ambience.css';

function LanternMark() {
  return <svg viewBox="0 0 80 116" aria-hidden="true">
    <ellipse cx="40" cy="104" rx="19" ry="7" fill="#efb761" opacity=".12" />
    <path d="M18 20Q40 7 62 20L58 77Q40 91 22 77Z" fill="#cf8859" stroke="#f6c786" strokeWidth="1.1" />
    <path d="M22 23Q40 13 58 23L54 75Q40 85 26 75Z" fill="#edb578" opacity=".72" />
    <path d="M30 17Q24 45 30 80M50 17Q56 45 50 80M40 15V83" fill="none" stroke="#ffe0a1" strokeWidth=".8" opacity=".65" />
    <path d="M18 20Q40 30 62 20M22 77Q40 68 58 77" fill="none" stroke="#ffe1a6" strokeWidth="1.4" />
    <ellipse cx="40" cy="78" rx="17" ry="4" fill="#733f40" />
    <ellipse cx="40" cy="77" rx="11" ry="2.5" fill="#ffd787" opacity=".8" />
    <path d="M40 77c-6-4-4-9 0-14 0 5 6 8 3 12Z" fill="#fff2c4" />
    <path d="M28 84v11m24-11v9" stroke="#e9bd7b" strokeWidth=".8" opacity=".55" />
  </svg>;
}

export default function DiwaliAmbience({ enabled, motion = true }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!enabled || !ref.current) return;
    const layer = ref.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => { layer.dataset.paused = String(document.hidden || reduced.matches || !motion); };
    sync();
    document.addEventListener('visibilitychange', sync);
    reduced.addEventListener('change', sync);
    return () => { document.removeEventListener('visibilitychange', sync); reduced.removeEventListener('change', sync); };
  }, [enabled, motion]);
  if (!enabled) return null;
  return <><div ref={ref} className="diwali-ambience" data-motion={motion ? 'on' : 'off'} aria-hidden="true">
    <div className="diwali-ambient-glow" />
    <div className="diwali-ambient-rangoli"><svg viewBox="0 0 240 240"><g fill="none" stroke="currentColor" strokeWidth=".8">{Array.from({ length: 12 }, (_, index) => <ellipse key={index} cx="120" cy="78" rx="17" ry="48" transform={`rotate(${index * 30} 120 120)`} />)}<circle cx="120" cy="120" r="30" /><circle cx="120" cy="120" r="98" /></g></svg></div>
    <div className="diwali-ambient-lanterns">{[0, 1, 2].map(index => <span key={index} className={`diwali-floating-lantern diwali-floating-lantern-${index}`}><LanternMark /></span>)}</div>
    <div className="diwali-ambient-lights">{Array.from({ length: 10 }, (_, index) => <span key={index} style={{ '--light-index': index }} />)}</div>
  </div><span className="diwali-grounded-diya" aria-hidden="true"><DiyaMark lit /></span></>;
}

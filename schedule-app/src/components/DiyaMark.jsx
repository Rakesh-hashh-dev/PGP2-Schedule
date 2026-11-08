import { useId } from 'react';
// Vector artwork belongs to the app, so cards can export it without a network fetch.
export default function DiyaMark({ lit = false, className = '' }) {
  const id = useId().replace(/:/g, '');
  return <svg className={`diya-mark ${className}`} viewBox="0 0 200 180" aria-hidden="true">
    <defs><linearGradient id={`${id}-clay`} x2="0" y2="1"><stop stopColor="#e18c5c" /><stop offset="1" stopColor="#913b50" /></linearGradient><linearGradient id={`${id}-flame`} x2="0" y2="1"><stop stopColor="#fff5c7" /><stop offset=".65" stopColor="#ffd268" /><stop offset="1" stopColor="#ef8c3d" /></linearGradient></defs>
    {lit && <><circle className="diya-halo" cx="100" cy="70" r="53" fill="#efb25c" opacity=".12" /><path className="diya-flame" d="M100 102C67 89 83 64 97 43c-1 18 25 27 23 44-1 10-10 17-20 15Z" fill={`url(#${id}-flame)`} /><path d="M100 103c-13-9-5-20 0-29 0 10 11 17 6 25Z" fill="#fff9df" /></>}
    <ellipse cx="100" cy="151" rx="65" ry="8" fill="#100d25" opacity=".22" />
    <path d="M35 110Q100 149 165 110c-11 47-113 47-130 0Z" fill={`url(#${id}-clay)`} stroke="#edb37c" strokeWidth="2" />
    <ellipse cx="100" cy="110" rx="65" ry="13" fill="#6e324b" stroke="#edb37c" strokeWidth="2" />
    <ellipse cx="100" cy="110" rx="49" ry="7" fill="#d18a54" opacity=".7" />
    <path d="M55 128q45 20 90 0M68 137q32 13 64 0" fill="none" stroke="#ffd898" strokeWidth="1.5" />
    <path d="m96 111 5-13" stroke="#423129" strokeWidth="3" strokeLinecap="round" />
  </svg>;
}

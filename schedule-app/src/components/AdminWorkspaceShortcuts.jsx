import { useEffect, useRef, useState } from 'react';
import { Pin, SlidersHorizontal, Search, CalendarDays, Utensils, BellRing, ShieldCheck, Users, History, Settings2, RotateCcw, ArrowUpRight, Check, ChevronDown } from 'lucide-react';
import { availableAdminCommands } from '../lib/adminCommands.js';
import { loadAdminWorkspacePrefs, saveAdminWorkspacePrefs } from '../lib/adminWorkspacePrefs.js';
import { SHORTCUT_LIMIT, toggleAdminPin } from '../lib/adminWorkspacePresentation.js';
import '../styles/admin-workspace.css';

const ICONS = { 'classes-today': CalendarDays, 'classes-tomorrow': CalendarDays, 'menu-tomorrow': Utensils, 'notification-diagnostics': BellRing, reports: ShieldCheck, 'student-support': Users, 'publication-history': History, 'system-controls': Settings2 };
const GROUPS = [{ label: 'Schedule', ids: ['classes-today', 'classes-tomorrow', 'menu-tomorrow'] }, { label: 'Support & review', ids: ['notification-diagnostics', 'reports', 'student-support'] }, { label: 'Workspace', ids: ['publication-history', 'system-controls'] }];
export default function AdminWorkspaceShortcuts({ role, userId, onCommand }) {
  const [preferences, setPreferences] = useState(() => loadAdminWorkspacePrefs(userId));
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const editor = useRef(null);
  const commands = availableAdminCommands(role), allowed = new Set(commands.map(command => command.id));
  const pins = preferences.pins.filter(id => allowed.has(id));
  const matches = availableAdminCommands(role, query);
  useEffect(() => {
    if (role) saveAdminWorkspacePrefs(userId, { ...loadAdminWorkspacePrefs(userId), pins: preferences.pins.filter(id => availableAdminCommands(role).some(command => command.id === id)) });
  }, [preferences, role, userId]);
  const save = (next, success) => {
    setPreferences(next);
    setMessage(saveAdminWorkspacePrefs(userId, next) ? success : 'Device storage is unavailable. These shortcuts will last for this visit.');
  };
  const toggle = id => {
    const current = { ...loadAdminWorkspacePrefs(userId), pins };
    const next = toggleAdminPin(current, id, allowed);
    if (next === current) { setMessage(`Choose up to ${SHORTCUT_LIMIT} shortcuts. Unpin one to add another.`); return; }
    save(next, 'Shortcuts saved on this device.');
  };
  return <details className="admin-card aw-card aw-shortcuts" aria-labelledby="aw-shortcut-title">
    <summary className="aw-shortcuts-summary"><span className="aw-heading-icon"><Pin size={15} aria-hidden="true" /></span><strong id="aw-shortcut-title">Your shortcuts</strong><span className="aw-count" aria-label={`${pins.length} of ${SHORTCUT_LIMIT} shortcuts selected`}>{pins.length}/{SHORTCUT_LIMIT}</span><ChevronDown size={14} className="aw-chevron" aria-hidden="true" /></summary>
    <div className="aw-shortcuts-body">
    {pins.length ? <div className="aw-pinned-grid">{pins.map(id => {
      const command = commands.find(item => item.id === id), Icon = ICONS[id] || Pin;
      return <button type="button" className="aw-pinned" key={id} onClick={() => onCommand(id)}><Icon size={16} /><span>{command.label}</span><ArrowUpRight size={13} aria-hidden="true" /></button>;
    })}</div> : <div className="aw-empty"><Pin size={20} aria-hidden="true" /><p>No shortcuts pinned yet.<span>Choose a few tools below to keep them close.</span></p><button type="button" className="aw-button" onClick={() => { editor.current.open = true; editor.current.querySelector('input')?.focus(); }}>Choose shortcuts</button></div>}
    <details ref={editor} className="aw-shortcut-editor"><summary><SlidersHorizontal size={14} /> Customize shortcuts <ChevronDown size={14} className="aw-chevron" aria-hidden="true" /></summary>
      <p className="aw-helper">Choose up to {SHORTCUT_LIMIT}. Only tools allowed by your role appear.</p>
      <label className="aw-search"><Search size={14} aria-hidden="true" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a tool…" aria-label="Find a shortcut" /></label>
      <div className="aw-option-groups">{GROUPS.map(group => {
        const items = matches.filter(command => group.ids.includes(command.id));
        return items.length ? <fieldset key={group.label}><legend>{group.label}</legend><div className="aw-options">{items.map(command => {
          const selected = pins.includes(command.id), Icon = ICONS[command.id] || Pin;
          return <label key={command.id} className={`aw-option${selected ? ' is-selected' : ''}`}><input type="checkbox" checked={selected} disabled={!selected && pins.length >= SHORTCUT_LIMIT} onChange={() => toggle(command.id)} /><Icon size={15} aria-hidden="true" /><span>{command.label}</span>{selected && <Check size={13} className="aw-selected-check" aria-hidden="true" />}</label>;
        })}</div></fieldset> : null;
      })}</div>
      {!matches.length && <p className="aw-helper">No tools match “{query}”. Try another search.</p>}
      <div className="aw-editor-footer"><span>{pins.length} selected · up to {SHORTCUT_LIMIT} shortcuts</span><button type="button" className="aw-link" disabled={!pins.length} onClick={() => save({ ...loadAdminWorkspacePrefs(userId), pins: [] }, 'Shortcuts cleared. Saved workspace filters are unchanged.')}>Clear shortcuts</button></div>
    </details>
    <details className="aw-reset"><summary><RotateCcw size={12} /> Reset workspace preferences</summary><p>Clear your shortcuts and saved workspace filters on this device. Published app settings stay unchanged.</p>
      {!confirmReset ? <button type="button" className="aw-link aw-danger" onClick={() => setConfirmReset(true)}>Reset preferences…</button> : <div className="aw-inline-actions"><button type="button" className="aw-button aw-danger" onClick={() => { save({ version: 1, pins: [], filters: {} }, 'Workspace preferences reset. Reopen a workspace to use default filters.'); setConfirmReset(false); }}>Confirm reset</button><button type="button" className="aw-button" onClick={() => setConfirmReset(false)}>Keep preferences</button></div>}
    </details>
    <p className="aw-feedback" role="status">{message || 'Personal to this account and device.'}</p>
    </div>
  </details>;
}

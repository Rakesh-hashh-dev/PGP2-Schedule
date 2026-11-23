
import { useState } from 'react';
import { availablePlan, summarizeBidflowPlan, termDisplayLabel } from '../lib/bidflowPlan.js';

export default function BidFlowSavedPlans({ saved, plan, courseMap, onSave, onLoad, onRename, onDelete, onUpdate }) {
  const [name, setName] = useState('');
  const [renameId, setRenameId] = useState(null);
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const selected = [left, right].map(id => saved.find(item => item.id === id));
  const comparable = selected.every(Boolean) && left !== right;
  const limitReached = saved.length >= 5;

  return (
    <section className="bf-saved" aria-label="Saved plans">
      <form className="bf-save-form" onSubmit={event => {
        event.preventDefault();
        if (!name.trim()) return;
        if (renameId) onRename(renameId, name.trim());
        else if (!limitReached) onSave(name.trim(), plan);
        setName('');
        setRenameId(null);
      }}>
        <label>{renameId ? 'Rename plan' : 'Plan name'}<input maxLength={60} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Finance focus" /></label>
        <button className="bf-primary" type="submit" disabled={!name.trim() || (!renameId && (limitReached || !plan.primary.length && !plan.backup.length))}>{renameId ? 'Save name' : 'Save current plan'}</button>
        {renameId && <button className="bf-quiet" type="button" onClick={() => { setRenameId(null); setName(''); }}>Cancel</button>}
      </form>
      {limitReached && <p className="bf-empty">Five plans are saved. Update or remove a plan to make room for another.</p>}
      {saved.length ? <ul className="bf-saved-list">{saved.map(item => {
        const available = availablePlan(item.plan, courseMap);
        const { credits } = summarizeBidflowPlan(available, courseMap);
        return <li key={item.id}>
          <div><strong>{item.name}</strong><small>{available.primary.length} primary · {available.backup.length} backup · {credits.toFixed(1)} cr</small></div>
          <div className="bf-rank-actions">
            <button className="bf-quiet" type="button" onClick={() => onLoad(item.plan)}>Load</button>
            <button className="bf-quiet" type="button" disabled={!plan.primary.length && !plan.backup.length} onClick={() => onUpdate(item.id, plan)}>Update</button>
            <button className="bf-quiet" type="button" onClick={() => { setRenameId(item.id); setName(item.name); }}>Rename</button>
            <button className="bf-quiet" type="button" onClick={() => {
              if (!window.confirm('Delete the saved plan “' + item.name + '”?')) return;
              onDelete(item.id);
              if (left === item.id) setLeft('');
              if (right === item.id) setRight('');
              if (renameId === item.id) { setRenameId(null); setName(''); }
            }}>Delete</button>
          </div>
        </li>;
      })}</ul> : <p className="bf-empty">Save a named copy of your current plan to revisit it later.</p>}
      {saved.length >= 2 && <section className="bf-compare">
        <h3>Compare plans</h3>
        <div className="bf-compare-grid">
          {[['First plan', left, setLeft], ['Second plan', right, setRight]].map(([label, value, select]) =>
            <label key={label}>{label}<select value={value} onChange={event => select(event.target.value)}><option value="">Select a plan</option>{saved.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>)}
          {comparable && selected.map((item, index) => {
            const available = availablePlan(item.plan, courseMap);
            const other = availablePlan(selected[1 - index].plan, courseMap);
            const unique = available.primary.filter(id => !other.primary.includes(id));
            const { credits, byTerm } = summarizeBidflowPlan(available, courseMap);
            return <article key={item.id}>
              <h4>{item.name} · {credits.toFixed(1)} cr</h4>
              <p>{byTerm.map(([term, total]) => termDisplayLabel(term) + ' ' + total.toFixed(1) + ' cr').join(' · ') || 'No primary credits'}</p>
              <p>{unique.length ? 'Primary choices unique to this plan' : 'Primary choices also appear in the other plan.'}</p>
              {unique.length > 0 && <ul>{unique.map(id => <li key={id}>{courseMap[id].name} · {termDisplayLabel(courseMap[id].term)}</li>)}</ul>}
            </article>;
          })}
        </div>
      </section>}
    </section>
  );
}

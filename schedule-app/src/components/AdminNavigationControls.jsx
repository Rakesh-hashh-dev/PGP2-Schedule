import { ArrowUp, ArrowDown, Eye, EyeOff, LockKeyhole, Monitor, Smartphone, Layers3, PanelLeft, MousePointer2 } from 'lucide-react';
import AdminControlsPublish from './AdminControlsPublish.jsx';
import { ControlStats, ControlSectionTitle } from './AdminControlVisuals.jsx';
import { NAV_ITEMS, NAV_GROUPS } from '../lib/navItems.js';
import { configureNav } from '../lib/navigationControls.js';

export default function AdminNavigationControls({ readOnly }) {
  return <AdminControlsPublish section="navigation" title="Navigation menu" readOnly={readOnly}>{({ value, setValue }) => {
    const patch = (id, p) => setValue({ ...value, items: { ...value.items, [id]: { ...value.items[id], ...p } } });
    const rank = id => value.order.includes(id) ? value.order.indexOf(id) : 999;
    const move = (id, offset, group) => {
      const all = [...new Set([...(value.order || []), ...NAV_ITEMS.map(i => i.id)])];
      const groupIds = all.filter(key => NAV_ITEMS.find(i => i.id === key)?.group === group);
      const other = groupIds[groupIds.indexOf(id) + offset]; if (!other) return;
      const i = all.indexOf(id), j = all.indexOf(other); [all[i], all[j]] = [all[j], all[i]]; setValue({ ...value, order: all });
    };
    const visible = NAV_ITEMS.filter(i => value.items[i.id]?.visible !== false || i.id === 'today').length;
    return <>
      <ControlStats items={[{ Icon: Eye, label: 'Visible destinations', value: `${visible} / ${NAV_ITEMS.length}` }, { Icon: Layers3, label: 'Menu groups', value: NAV_GROUPS.length }, { Icon: LockKeyhole, label: 'Access rules', value: 'Protected', detail: 'Existing feature gates apply' }]} />
      <div className="ac-workspace">
        <div className="ac-editor-column ac-nav-editor">
          <p className="ac-section-intro">Arrange destinations within each group, choose what appears, and give each item a clear label.</p>
          {NAV_GROUPS.map(group => {
            const items = NAV_ITEMS.filter(i => i.group === group.id).sort((a, b) => rank(a.id) - rank(b.id));
            return <section key={group.id} className="admin-controls-box ac-nav-group"><ControlSectionTitle Icon={group.id === 'schedule' ? PanelLeft : Layers3} title={group.label} aside={`${items.length} items`} />
              {items.map((item, index) => { const Icon = item.icon; const on = value.items[item.id]?.visible !== false; return <div className={`ac-nav-editor-row ${on ? '' : 'is-hidden'}`} key={item.id}>
                <span className="ac-row-glyph"><Icon size={19} strokeWidth={1.7} aria-hidden="true" /></span>
                <div className="ac-row-copy"><label><span className="sr-only">Label for {item.label}</span><input maxLength={40} value={value.items[item.id]?.label ?? item.label} onChange={e => patch(item.id, { label: e.target.value })} /></label><small>{item.id === 'today' ? <><LockKeyhole size={11} />Always available</> : on ? item.label : <><EyeOff size={11} />Hidden from navigation</>}</small></div>
                <div className="ac-reorder"><button type="button" disabled={index === 0} aria-label={`Move ${item.label} up`} onClick={() => move(item.id, -1, group.id)}><ArrowUp size={14} /></button><button type="button" disabled={index === items.length - 1} aria-label={`Move ${item.label} down`} onClick={() => move(item.id, 1, group.id)}><ArrowDown size={14} /></button></div>
                <label className="ac-switch"><input type="checkbox" aria-label={`Show ${item.label}`} disabled={item.id === 'today'} checked={on} onChange={e => patch(item.id, { visible: e.target.checked })} /><span aria-hidden="true" /></label>
              </div>; })}
            </section>;
          })}
        </div>
        <aside className="ac-preview-column"><div className="ac-preview-sticky"><ControlSectionTitle Icon={Monitor} title="Student view" description="Your labels and order, at a glance." aside="Preview" />
          <div className="ac-nav-model"><div className="ac-browser-chrome"><span /><span /><span /><small>Desktop navigation</small></div><div className="ac-nav-model-brand"><span>T</span><div>TermFlow<small>PGP2 · Your campus, connected</small></div></div>
            {NAV_GROUPS.map(g => <section key={g.id}><h4>{g.label}</h4>{configureNav(NAV_ITEMS.filter(i => i.group === g.id), value).map(i => { const Icon = i.icon; return <div className={`ac-preview-menu-item ${i.id === 'today' ? 'is-active' : ''}`} key={i.id}><Icon size={15} /><span>{i.label}</span>{i.id === 'today' && <i />}</div>; })}</section>)}
            <div className="ac-nav-model-footer"><span>JD</span><div>Student account<small>Settings and sign-out stay available</small></div></div>
          </div><div className="ac-mobile-preview"><Smartphone size={16} /><div><strong>Consistent across devices</strong><p>The same labels and visibility carry through to mobile menus.</p></div></div><p className="ac-preview-note"><MousePointer2 size={13} />Layout preview. Existing feature switches determine which destinations a student can access.</p>
        </div></aside>
      </div>
    </>;
  }}</AdminControlsPublish>;
}

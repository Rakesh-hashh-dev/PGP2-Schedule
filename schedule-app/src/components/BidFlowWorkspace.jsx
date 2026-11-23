import { useEffect, useRef, useState } from 'react';
import { X, Search, Layers, Check, Plus, ArrowUp, ArrowDown, Download, FileText, ArrowRight, BookOpen, ListChecks, Bookmark, SlidersHorizontal, List, LayoutGrid, RotateCcw, ChevronDown } from 'lucide-react';
import { availablePlan, bidflowCourseKey, generateBidFlowCsv, loadBidflowWorkspace, officialCourseCode, summarizeBidflowPlan, termDisplayLabel, termKey, timetableHandoff } from '../lib/bidflowPlan.js';
import BidFlowPlanSummary from './BidFlowPlanSummary.jsx';
import BidFlowSavedPlans from './BidFlowSavedPlans.jsx';
import { exportBidFlowPdf } from '../lib/bidflowPdf.js';
import '../styles/bidflow.css';

function CourseFaculty({ faculty, facultyType, area }) {
  if (!faculty && !facultyType) return null;
  return <p className="bf-course-faculty">
    {faculty}
    {facultyType && <span className="bf-faculty-type" data-faculty-type={facultyType} data-area={facultyType === "Internal" ? area : undefined}>{facultyType}</span>}
  </p>;
}

export default function BidFlowWorkspace({ onClose, config, storageKey, timetable, onApply, studentName = '', preview = false, catalogNotice }) {
  const [initial] = useState(() => loadBidflowWorkspace(storageKey));
  const [draft, setDraft] = useState(initial.plan);
  const [saved, setSaved] = useState(initial.saved);
  const [view, setView] = useState('catalog');
  const [catalogLayout, setCatalogLayout] = useState('list');
  const [collapsedTerms, setCollapsedTerms] = useState({});
  const viewHeading = useRef(null);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [area, setArea] = useState('');
  const [termFilter, setTermFilter] = useState('');
  const [faculty, setFaculty] = useState('');
  const [creditFilter, setCreditFilter] = useState('');
  const [storageError, setStorageError] = useState(false);
  const { courses, cohort, term, minCredits, maxCredits, totalMinCredits, totalMaxCredits, termCreditRanges = {}, rulesText } = config;
  const catalog = courses.map(course => {
    const key = termKey(course.term || term);
    const label = /^[IVX]+$/.test(key) ? 'Term ' + key : (course.term || term);
    return { ...course, term: label, id: bidflowCourseKey(course, term) };
  });
  const courseMap = Object.fromEntries(catalog.map(course => [course.id, course]));
  const plan = availablePlan(draft, courseMap);
  const unavailable = draft.primary.length + draft.backup.length - plan.primary.length - plan.backup.length;
  const { credits, byTerm, byArea } = summarizeBidflowPlan(plan, courseMap);
  const terms = [...new Set(catalog.map(course => course.term))].sort((a, b) => termDisplayLabel(a).localeCompare(termDisplayLabel(b), undefined, { numeric: true }));
  const termTotals = Object.fromEntries(byTerm);
  const termSummary = terms.map(label => ({
    term: label,
    credits: termTotals[label] || 0,
    ...(termCreditRanges[termKey(label)] || { min: minCredits, max: maxCredits }),
  }));
  const hasTotalRange = totalMinCredits != null && totalMaxCredits != null;
  const minTotal = hasTotalRange ? totalMinCredits : terms.length === 1 ? termSummary[0].min : null;
  const maxTotal = hasTotalRange ? totalMaxCredits : terms.length === 1 ? termSummary[0].max : null;
  const handoff = timetable && timetableHandoff(plan.primary, courseMap, timetable, cohort);
  const handoffCount = handoff ? Object.keys(handoff.eligible).length : 0;
  const query = search.trim().toLowerCase();
  const areas = [...new Set(catalog.map(course => course.area))].sort();
  const facultyList = [...new Set(catalog.map(course => course.faculty).filter(Boolean))].sort();
  const creditValues = [...new Set(catalog.map(course => course.credits))].sort((a, b) => a - b);
  const filterCount = [faculty, creditFilter].filter(Boolean).length;
  const hasFilters = Boolean(query || termFilter || area || filterCount);
  const visible = catalog.filter(course => (!area || course.area === area) &&
    (!termFilter || course.term === termFilter) && (!faculty || course.faculty === faculty) &&
    (!creditFilter || course.credits === Number(creditFilter)) &&
    [course.name, course.code, course.faculty, course.area, course.facultyType].some(value => value?.toLowerCase().includes(query)));

  const grouped = new Map();
  for (const course of visible) {
    if (!grouped.has(course.term)) grouped.set(course.term, []);
    grouped.get(course.term).push(course);
  }

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ plan: draft, saved }));
    } catch {
      // Keep the current working draft available for export.
      const timer = setTimeout(() => setStorageError(true), 0);
      return () => clearTimeout(timer);
    }
  }, [draft, saved, storageKey]);

  function toggle(code, list) {
    const other = list === 'primary' ? 'backup' : 'primary';
    setDraft(previous => ({
      ...previous,
      [list]: previous[list].includes(code) ? previous[list].filter(item => item !== code) : [...previous[list], code],
      [other]: previous[other].filter(item => item !== code),
    }));
  }

  function move(codes, list, index, offset) {
    const reordered = [...codes];
    [reordered[index], reordered[index + offset]] = [reordered[index + offset], reordered[index]];
    setDraft(previous => ({ ...previous, [list]: [...reordered, ...previous[list].filter(code => !Object.hasOwn(courseMap, code))] }));
  }

  function downloadCsv() {
    const url = URL.createObjectURL(new Blob(['\uFEFF', generateBidFlowCsv(plan, courseMap)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'BidFlow_Preferences.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function selectView(next, focus = false) {
    setView(next);
    if (focus) requestAnimationFrame(() => {
      viewHeading.current?.scrollIntoView({ block: 'nearest' });
      viewHeading.current?.focus({ preventScroll: true });
    });
  }

  function resetFilters() {
    setSearch('');
    setArea('');
    setTermFilter('');
    setFaculty('');
    setCreditFilter('');
  }

  function resetPlan() {
    if (!window.confirm('Clear all primary and backup choices? Your saved plans will still be available.')) return;
    setDraft({ primary: [], backup: [] });
    resetFilters();
    setShowFilters(false);
    selectView('catalog', true);
  }

  const hasPicks = plan.primary.length + plan.backup.length > 0;
  const Heading = preview ? 'h2' : 'h1';
  const viewTitle = { catalog: 'Browse electives', plan: 'Rank your choices', saved: 'Saved plans' }[view];
  const missingCodes = handoff?.blocked.filter(code => !officialCourseCode(code)).length || 0;
  const blockedCodes = handoff?.blocked.filter(officialCourseCode) || [];
  const handoffNote = handoff?.unavailable ? 'This plan is for a different cohort than your timetable.'
    : missingCodes || blockedCodes.length ? [
      missingCodes ? 'Some primary choices need official course codes before they can be added to setup.' : '',
      blockedCodes.length ? 'Check the course, credits or section in setup for ' + blockedCodes.join(', ') + '.' : '',
    ].filter(Boolean).join(' ')
    : handoff?.otherTerm ? handoff.otherTerm + (handoff.otherTerm === 1 ? ' primary choice is for another term.' : ' primary choices are for other terms.')
    : storageKey && !storageError ? 'Draft saved on this device.' : '';
  const actions = <>
    {handoff && !handoff.unavailable && <button type="button" className="bf-primary bf-apply" disabled={!handoffCount}
      onClick={() => { onApply(handoff.eligible); onClose(); }}>
      {handoffCount ? 'Add ' + handoffCount + ' to setup' : 'Add to setup'} <ArrowRight size={16} aria-hidden="true" />
    </button>}
    <div className="bf-export-actions">
      <button type="button" className="bf-quiet" disabled={!hasPicks} onClick={downloadCsv}><Download size={15} aria-hidden="true" /> CSV</button>
      <button type="button" className="bf-quiet" disabled={!hasPicks} onClick={() => exportBidFlowPdf({ plan, courseMap, cohortName: cohort,
        termName: terms.join(' · ') || term, minCredits: minTotal, maxCredits: maxTotal, studentName, rulesText, termSummary })}><FileText size={15} aria-hidden="true" /> Print / PDF</button>
    </div>
  </>;

  return <>
    <header className="bf-heading">
      <div className="bf-brand"><Layers aria-hidden="true" size={22} /></div>
      <div>
        <Heading>BidFlow</Heading>
        <p>{preview ? 'Student preview' : 'Elective planner'}{!catalogNotice && ' · ' + cohort}</p>
      </div>
      {preview && <button type="button" className="bf-icon bf-close" onClick={onClose} aria-label="Close BidFlow"><X size={20} /></button>}
    </header>

    {catalogNotice ? <div className="bf-body bf-catalog-status">
      <BookOpen size={25} aria-hidden="true" />
      <h2>Elective catalog</h2>
      <p role="status">{catalogNotice}</p>
    </div> : <div className="bf-layout">
      <div className="bf-main">
        <nav className="bf-tabs" aria-label="Planner views">
          {[['catalog', 'Electives', courses.length, BookOpen], ['plan', 'My plan', plan.primary.length + plan.backup.length, ListChecks], ['saved', 'Saved plans', saved.length, Bookmark]].map(([id, label, count, Icon]) =>
            <button key={id} type="button" aria-pressed={view === id} onClick={() => selectView(id)}>
              <Icon size={15} aria-hidden="true" /> {label} <span>{count}</span>
            </button>)}
        </nav>

        <div className="bf-body">
          <div className="bf-view-head">
            <h2 ref={viewHeading} tabIndex={-1}>{viewTitle}</h2>
            <details className="bf-rules"><summary>Planning rules</summary>
              <p>{rulesText || 'Only primary choices count toward credit targets.'}</p>
              <p>Follow the institute’s published instructions when submitting official choices.</p>
              {config.updatedAt && <p>Catalog updated {new Date(config.updatedAt).toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' })}</p>}
            </details>
          </div>

          {storageError && <p role="status" className="bf-notice">Browser storage is unavailable. Export your plan to keep a copy.</p>}
          {unavailable > 0 && <div className="bf-notice">
            <span>{unavailable} saved {unavailable === 1 ? 'choice is' : 'choices are'} unavailable in the current catalog.</span>
            <button className="bf-quiet" type="button" onClick={() => setDraft(plan)}>Remove unavailable choices</button>
          </div>}

          {view === 'catalog' ? <>
            <div className="bf-catalog-tools">
              <div className="bf-filters" data-expanded={showFilters}>
                <label><Search size={16} aria-hidden="true" /><input type="search" aria-label="Search electives"
                  placeholder="Search electives" value={search} onChange={event => setSearch(event.target.value)} /></label>
                <button className="bf-quiet bf-filter-switch" type="button" aria-expanded={showFilters}
                  onClick={() => setShowFilters(open => !open)}><SlidersHorizontal size={15} aria-hidden="true" /> Filters{filterCount > 0 && <span>{filterCount}</span>}</button>
                {showFilters && <div className="bf-filter-options">
                  <label>Faculty<select value={faculty} onChange={event => setFaculty(event.target.value)}><option value="">All faculty</option>{facultyList.map(item => <option key={item}>{item}</option>)}</select></label>
                  <label>Credits<select value={creditFilter} onChange={event => setCreditFilter(event.target.value)}><option value="">All credits</option>{creditValues.map(item => <option key={item} value={item}>{item} cr</option>)}</select></label>
                </div>}
              </div>
              <div className="bf-catalog-refine">
                {terms.length > 1 && <div className="bf-term-filters" role="group" aria-label="Filter by term">
                  {['', ...terms].map(label => <button key={label || 'all'} type="button" className="bf-quiet" aria-pressed={termFilter === label}
                    data-term={termKey(label)} onClick={() => setTermFilter(label)}>{termDisplayLabel(label) || 'All terms'}</button>)}
                </div>}
                <label className="bf-area-filter">
                  Area
                  <select value={area} data-area={area} onChange={event => setArea(event.target.value)}>
                    <option value="">All areas</option>
                    {areas.map(item => <option key={item}>{item}</option>)}
                  </select>
                </label>
              </div>
              <div className="bf-results">
                <div className="bf-result-count">
                  <span role="status">{visible.length} of {catalog.length} electives</span>
                  {hasFilters && <button className="bf-quiet" type="button" onClick={resetFilters}>Clear filters</button>}
                </div>
                <div className="bf-layout-picker" role="group" aria-label="Catalog layout">
                  <button type="button" className="bf-quiet" aria-pressed={catalogLayout === 'list'} onClick={() => setCatalogLayout('list')}>
                    <List size={15} aria-hidden="true" /> List
                  </button>
                  <button type="button" className="bf-quiet" aria-pressed={catalogLayout === 'grid'} onClick={() => setCatalogLayout('grid')}>
                    <LayoutGrid size={15} aria-hidden="true" /> Grid
                  </button>
                </div>
              </div>
            </div>
            {visible.length ? <div className="bf-catalog-groups">{terms.filter(label => grouped.has(label)).map(label => {
              const tKey = termKey(label);
              const isCollapsed = !!collapsedTerms[label];
              const courseList = grouped.get(label);
              const termRange = termCreditRanges[tKey] || { min: minCredits, max: maxCredits };
              const pickedInTerm = [...plan.primary, ...plan.backup].filter(id => courseMap[id] && termKey(courseMap[id].term) === tKey).length;
              return (
              <section className="bf-catalog-group" aria-label={termDisplayLabel(label) + ' electives'} data-term={tKey} data-collapsed={isCollapsed || undefined} key={label}>
                <button
                  type="button"
                  className="bf-catalog-group-head"
                  aria-expanded={!isCollapsed}
                  onClick={() => setCollapsedTerms(prev => ({ ...prev, [label]: !prev[label] }))}
                >
                  <span className="bf-term-badge" aria-hidden="true">{termDisplayLabel(label).replace('Term ', '')}</span>
                  <span className="bf-term-head-info">
                    <span className="bf-term-title">{termDisplayLabel(label)}</span>
                    <span className="bf-term-meta">
                      <span className="bf-term-chip">{courseList.length} {courseList.length === 1 ? 'elective' : 'electives'}</span>
                      {termRange.min != null && <span className="bf-term-chip">{termRange.min}–{termRange.max} cr</span>}
                      {pickedInTerm > 0 && <span className="bf-term-chip bf-term-chip--picked">{pickedInTerm} picked</span>}
                    </span>
                  </span>
                  <span className="bf-term-chevron" aria-hidden="true"><ChevronDown size={17} /></span>
                </button>
                <div className="bf-catalog-group-body">
                  <div className="bf-catalog" data-layout={catalogLayout}>{courseList.map(course => {
                  const primary = plan.primary.includes(course.id);
                  const backup = plan.backup.includes(course.id);
                  const officialCode = officialCourseCode(course.code);
                  return <article className="bf-course" key={course.id} data-choice={primary ? 'primary' : backup ? 'backup' : undefined}>
                    <div className="bf-course-copy">
                      {officialCode && <span className="bf-course-code">{officialCode}</span>}
                      <h4>{course.name}</h4>
                      <div className="bf-course-context">
                        <span className="bf-course-area" data-area={course.area}>Area <strong>{course.area}</strong></span>
                        <CourseFaculty faculty={course.faculty} facultyType={course.facultyType} area={course.area} />
                      </div>
                      {(course.description || course.slots != null) && <details className="bf-details">
                        <summary>Course details</summary>
                        {course.description && <p>{course.description}</p>}
                        {course.slots != null && <p>{course.slots} seats listed in the catalog</p>}
                      </details>}
                    </div>
                    <span className="bf-course-credit">{course.credits} cr</span>
                    <div className="bf-course-actions">
                      {[['primary', 'Primary', primary], ['backup', 'Backup', backup]].map(([kind, name, chosen]) =>
                        <button key={kind} type="button" data-kind={kind} aria-pressed={chosen}
                          aria-label={name + ' ' + (officialCode || course.name) + ' · ' + termDisplayLabel(course.term)} onClick={() => toggle(course.id, kind)}>
                          {chosen ? <Check size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}{name}
                        </button>)}
                    </div>
                  </article>;
                })}</div>
                </div>
              </section>
              );
            })}</div> : <div className="bf-empty bf-empty-state">
                <BookOpen size={22} aria-hidden="true" />
                <strong>{catalog.length ? 'No matching electives' : 'No electives in this catalog yet'}</strong>
                {hasFilters && <button className="bf-quiet" type="button" onClick={resetFilters}>Reset search and filters</button>}
              </div>}
          </> : view === 'plan' ? <>
            {(hasPicks || unavailable > 0) && <div className="bf-plan-toolbar">
              {hasPicks && <p className="bf-plan-hint">Move courses up or down to set your preference order.</p>}
              <button type="button" className="bf-quiet bf-reset-plan" onClick={resetPlan}>
                <RotateCcw size={15} aria-hidden="true" /> Clear all &amp; start over
              </button>
            </div>}
            <div className="bf-plan">
              {[['primary', 'Primary choices'], ['backup', 'Backup choices']].map(([list, title]) => <section key={list} data-kind={list}>
                <h3>{title} <span>{plan[list].length}</span></h3>
                {plan[list].length ? <ol>{plan[list].map((id, index, ids) => {
                  const course = courseMap[id];
                  const details = [officialCourseCode(course.code), termDisplayLabel(course.term)].filter(Boolean).join(' · ');
                  const label = (officialCourseCode(course.code) || course.name) + ' · ' + termDisplayLabel(course.term);
                  return <li key={id}>
                    <span className="bf-rank" aria-hidden="true">{index + 1}</span>
                    <div>
                      <strong>{course.name}</strong>
                      <small>{details}</small>
                      <div className="bf-course-context">
                        <span className="bf-course-area" data-area={course.area}>Area <strong>{course.area}</strong></span>
                        <span className="bf-course-credit">{course.credits} cr</span>
                      </div>
                      <CourseFaculty faculty={course.faculty} facultyType={course.facultyType} area={course.area} />
                    </div>
                    <div className="bf-rank-actions">
                      <button type="button" className="bf-icon" disabled={index === 0} aria-label={'Move ' + label + ' up'} onClick={() => move(ids, list, index, -1)}><ArrowUp size={16} aria-hidden="true" /></button>
                      <button type="button" className="bf-icon" disabled={index === ids.length - 1} aria-label={'Move ' + label + ' down'} onClick={() => move(ids, list, index, 1)}><ArrowDown size={16} aria-hidden="true" /></button>
                      <button type="button" className="bf-icon" aria-label={'Remove ' + label} onClick={() => toggle(id, list)}><X size={16} aria-hidden="true" /></button>
                    </div>
                  </li>;
                })}</ol> : <div className="bf-empty"><p>No {list} choices yet.</p><button type="button" className="bf-quiet" onClick={() => selectView('catalog', true)}>Browse electives</button></div>}
              </section>)}
            </div>
            {byArea.length > 0 && <section className="bf-area-summary" aria-label="Primary credits by area">
              <h3>Primary credits by area</h3>
              <ul>{byArea.map(([label, total]) => <li key={label}><span>{label}</span><strong>{total.toFixed(1)} cr</strong></li>)}</ul>
            </section>}
          </> : <BidFlowSavedPlans
            saved={saved} plan={plan} courseMap={courseMap}
            onSave={(name, current) => setSaved(previous => [...previous, { id: crypto.randomUUID(), name, plan: current }])}
            onLoad={current => {
              if ((hasPicks || unavailable) && !window.confirm('Replace the working draft with this saved plan?')) return;
              setDraft(current);
              selectView('plan', true);
            }}
            onRename={(id, name) => setSaved(previous => previous.map(item => item.id === id ? { ...item, name } : item))}
            onUpdate={(id, current) => {
              if (window.confirm('Update this saved plan with your working draft?')) setSaved(previous => previous.map(item => item.id === id ? { ...item, plan: current } : item));
            }}
            onDelete={id => setSaved(previous => previous.filter(item => item.id !== id))}
          />}
        </div>
      </div>
      <BidFlowPlanSummary key={view} credits={credits} minTotal={minTotal} maxTotal={maxTotal} termSummary={termSummary}
        primaryCount={plan.primary.length} backupCount={plan.backup.length} onReview={view === 'plan' ? undefined : () => selectView('plan', true)}
        actions={actions} actionNote={handoffNote} />
    </div>}
  </>;
}

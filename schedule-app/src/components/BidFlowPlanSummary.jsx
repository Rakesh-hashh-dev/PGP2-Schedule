import { useId, useState } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';

import { creditStatus, termDisplayLabel, termKey } from '../lib/bidflowPlan.js';

export default function BidFlowPlanSummary({ credits, minTotal, maxTotal, termSummary, primaryCount, backupCount, onReview, actions, actionNote }) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const status = maxTotal === null ? null : creditStatus(credits, minTotal, maxTotal);

  return <aside className="bf-summary" aria-label="Current plan" data-expanded={expanded}>
    <header className="bf-summary-head">
      <div className="bf-summary-hero" aria-live="polite" aria-atomic="true">
        <div className="bf-summary-title-row">
          <div className="bf-summary-badge">
            <span className="bf-pulse-dot" aria-hidden="true" />
            <h2>Current plan</h2>
          </div>
          {status && (
            <span className="bf-status-pill" data-status={status.kind}>
              {status.kind === 'within' ? 'On track' : status.kind === 'over' ? 'Over limit' : 'In progress'}
            </span>
          )}
        </div>

        <div className="bf-summary-score-row">
          <div className="bf-credits-display">
            <strong className="bf-credits-number">{credits.toFixed(1)}</strong>
            <span className="bf-credits-unit">cr</span>
          </div>

          <div className="bf-counter-chips">
            <div className="bf-counter-chip bf-counter-chip--primary" title="Primary choices">
              <span className="bf-chip-dot bf-chip-dot--primary" aria-hidden="true" />
              <span className="bf-chip-count">{primaryCount}</span>
              <span className="bf-chip-label">primary</span>
            </div>
            <div className="bf-counter-chip bf-counter-chip--backup" title="Backup choices">
              <span className="bf-chip-dot bf-chip-dot--backup" aria-hidden="true" />
              <span className="bf-chip-count">{backupCount}</span>
              <span className="bf-chip-label">backup</span>
            </div>
          </div>
        </div>
      </div>

      {onReview
        ? <button type="button" className="bf-primary bf-review" onClick={onReview}>
            <span>Review plan</span>
            <ArrowRight size={15} aria-hidden="true" className="bf-review-arrow" />
          </button>
        : <button type="button" className="bf-quiet bf-rail-toggle" aria-expanded={expanded} aria-controls={detailsId}
            onClick={() => setExpanded(open => !open)}>Plan actions <ChevronDown size={15} aria-hidden="true" /></button>}
    </header>

    <div id={detailsId} className="bf-summary-details">
      {status && <div className="bf-summary-target" data-status={status.kind}>
        <div><span>Overall target</span><strong>{minTotal === maxTotal ? minTotal : minTotal + '–' + maxTotal} cr</strong></div>
        <progress value={Math.min(credits, maxTotal)} max={maxTotal} aria-label="Primary credits toward overall maximum" />
        <small>{status.label}</small>
      </div>}
      {termSummary.length > 0 && <div className="bf-term-targets">
        <h3>Term credits</h3>
        {termSummary.map(({ term, credits: amount, min, max }) => {
          const termStatus = creditStatus(amount, min, max);
          return <div className="bf-term-target" key={term} data-term={termKey(term)} data-status={termStatus.kind}>
            <div><strong>{termDisplayLabel(term)}</strong><span>{amount.toFixed(1)} / {min === max ? min : min + '–' + max} cr</span></div>
            <progress value={Math.min(amount, max)} max={max} aria-label={termDisplayLabel(term) + ' primary credits toward maximum'} />
            <small>{termStatus.label}</small>
          </div>;
        })}
      </div>}
      <div className="bf-summary-actions">{actions}{actionNote && <p>{actionNote}</p>}</div>
    </div>
  </aside>;
}

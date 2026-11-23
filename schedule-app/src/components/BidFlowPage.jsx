import { ArrowLeft } from 'lucide-react';
import { useAppControls } from '../lib/appControls.js';
import { bidflowCatalogNotice, bidflowPlanKey } from '../lib/bidflowPlan.js';
import BidFlowWorkspace from './BidFlowWorkspace.jsx';

export default function BidFlowPage({ userId, studentName, timetable, onApply, onBack, backLabel = 'Back to Planner' }) {
  const controls = useAppControls();
  const config = controls.payload.bidflow;
  const catalogNotice = bidflowCatalogNotice(controls);
  const storageKey = config.enabled && userId ? bidflowPlanKey(userId, config) : undefined;

  return <main className="bidflow-page tf-page-stage" tabIndex={-1} aria-label="BidFlow elective planner">
    <nav className="bidflow-page-nav" aria-label="BidFlow navigation">
      <button type="button" className="bf-quiet" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> {backLabel}</button>
    </nav>
    <section className="bidflow-page-content" aria-label="Elective workspace">
      <BidFlowWorkspace key={storageKey} config={config} storageKey={storageKey} catalogNotice={catalogNotice}
        timetable={timetable} onApply={onApply} onClose={onBack} studentName={studentName} />
    </section>
  </main>;
}

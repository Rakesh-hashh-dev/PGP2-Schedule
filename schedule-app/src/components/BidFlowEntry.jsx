
import { ArrowRight, Layers } from 'lucide-react';
import { useAppControls } from '../lib/appControls.js';
import { bidflowCatalogNotice } from '../lib/bidflowPlan.js';
import '../styles/bidflow.css';

export default function BidFlowEntry({ onOpen, buttonRef, showBeforePublish = false }) {
  const controls = useAppControls();
  const config = controls.payload.bidflow;
  if (!config.enabled && (!showBeforePublish || config.updatedAt)) return null;
  const catalogNotice = bidflowCatalogNotice(controls);
  return (
    <section className="bidflow-entry" data-availability={catalogNotice ? "waiting" : "ready"} aria-label="BidFlow elective planner">
      <div className="bf-brand"><Layers size={19} aria-hidden="true" /></div>
      <div>
        <h2>BidFlow elective planner</h2>
        <p>{catalogNotice || config.cohort + ' · Browse electives, track credits and compare plans'}</p>
      </div>
      <button type="button" className="bf-primary" ref={buttonRef} onClick={onOpen}>Open BidFlow <ArrowRight size={16} /></button>
    </section>
  );
}

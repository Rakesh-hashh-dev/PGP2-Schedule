import { createPortal } from 'react-dom';
import { dialogProps, useDialog } from '../hooks/useDialog.js';
import BidFlowWorkspace from './BidFlowWorkspace.jsx';

export default function BidFlowModal({ onClose, config }) {
  const dialogRef = useDialog(true, onClose);
  return createPortal(
    <div className="bidflow-overlay" onClick={onClose}>
      <section className="bidflow-modal" ref={dialogRef} {...dialogProps('BidFlow student preview')} onClick={event => event.stopPropagation()}>
        <BidFlowWorkspace config={config} onClose={onClose} preview />
      </section>
    </div>,
    document.body,
  );
}

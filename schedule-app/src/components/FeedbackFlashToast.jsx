import { useState, useEffect } from "react";
import { MessageSquare, X, ExternalLink, ArrowRight } from "lucide-react";

export default function FeedbackFlashToast({ config, onOpenFeedback, onClose }) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      if (onClose) onClose();
    }, 300); // Wait for slide-out animation to finish
  };

  useEffect(() => {
    // Small delay to allow the slide-in animation to trigger after mount
    const timer = setTimeout(() => setVisible(true), 100);

    // Auto-dismiss after 15 seconds unless they interact
    const autoDismiss = setTimeout(() => {
      handleClose();
    }, 15000);

    return () => {
      clearTimeout(timer);
      clearTimeout(autoDismiss);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClickSubmit = () => {
    handleClose();
    if (config.link) {
      window.open(config.link, "_blank", "noopener,noreferrer");
    } else {
      if (onOpenFeedback) onOpenFeedback();
    }
  };

  if (!visible && !closing) return null;

  let formattedDeadline = "";
  if (config.deadline) {
    formattedDeadline = new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    }).format(new Date(config.deadline));
  }

  return (
    <div className={`feedback-flash-toast ${visible && !closing ? "show" : ""} ${closing ? "hide" : ""}`}>
      <div className="feedback-flash-inner">
        <button className="feedback-flash-close" onClick={handleClose} aria-label="Close">
          <X size={16} />
        </button>
        <div className="feedback-flash-icon">
          <MessageSquare size={20} color="var(--amber)" />
        </div>
        <div className="feedback-flash-content">
          <div className="feedback-flash-title">
            Fill out the Feedback for {config.subjectName || "your classes"}{formattedDeadline ? ` by ${formattedDeadline}` : ""}!
          </div>
          <button className="feedback-flash-btn" onClick={handleClickSubmit}>
            {config.link ? (
              <>Open Form <ExternalLink size={14} /></>
            ) : (
              <>Submit Feedback <ArrowRight size={14} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

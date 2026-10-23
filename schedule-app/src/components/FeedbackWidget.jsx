import { useState } from "react";
import { MessageSquare, X, CheckCircle, Send } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useBackClose } from "../lib/backClose.js";

export default function FeedbackWidget({ user, onClose }) {
  useBackClose(onClose);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: dbError } = await supabase.from("feedback").insert({
        user_id: user?.id || user?.user_id || "unknown",
        message: message.trim(),
        status: "pending"
      });
      if (dbError) throw dbError;
      setSubmitted(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error("Feedback error:", err);
      setError(err.message || "Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="notif-backdrop" onClick={onClose} style={{ zIndex: 10000 }} />
      <div className="tf-centered-dialog" style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: "var(--card)",
        padding: "24px",
        borderRadius: "16px",
        width: "90%",
        maxWidth: "400px",
        zIndex: 10001,
        border: "1px solid var(--border)",
        boxShadow: "0 10px 40px rgba(0,0,0,0.2)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2 style={{ margin: 0, fontSize: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
            <MessageSquare size={18} color="var(--violet)" /> Submit Feedback
          </h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)" }}>
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "var(--green)" }}>
            <CheckCircle size={48} style={{ margin: "0 auto 16px" }} />
            <h3 style={{ margin: "0 0 8px", color: "var(--text)" }}>Thank You!</h3>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "14px" }}>Your feedback has been sent to the admins.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: "14px", lineHeight: "1.5" }}>
              Found a bug? Have a feature request? Let us know below.
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What's on your mind?"
              rows={4}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: "var(--text)",
                fontFamily: "inherit",
                fontSize: "14px",
                resize: "vertical",
                marginBottom: "16px"
              }}
            />
            {error && <div style={{ color: "var(--danger)", fontSize: "13px", marginBottom: "16px" }}>{error}</div>}
            <button
              type="submit"
              disabled={submitting || !message.trim()}
              className="admin-btn primary"
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "none",
                background: "var(--violet)",
                color: "#fff",
                fontWeight: "600",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "8px",
                cursor: submitting || !message.trim() ? "not-allowed" : "pointer",
                opacity: submitting || !message.trim() ? 0.6 : 1
              }}
            >
              {submitting ? "Submitting..." : <><Send size={16} /> Send Feedback</>}
            </button>
          </form>
        )}
      </div>
    </>
  );
}

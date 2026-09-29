import { useState, useEffect, useCallback } from "react";
import { Users, Zap, Megaphone, Sparkles, CircleCheck, X, ExternalLink } from "lucide-react";
import { safeUrl } from "../lib/safeUrl.js";

const SVG_TYPES = {
  social: { Component: Users, color: "#8B5CF6", bg: "rgba(139, 92, 246, 0.14)" },
  alert: { Component: Zap, color: "#F59E0B", bg: "rgba(245, 158, 11, 0.14)" },
  announcement: { Component: Megaphone, color: "#3B82F6", bg: "rgba(59, 130, 246, 0.14)" },
  sparkles: { Component: Sparkles, color: "#EC4899", bg: "rgba(236, 72, 153, 0.14)" },
  success: { Component: CircleCheck, color: "#10b981", bg: "rgba(16, 185, 129, 0.14)" }
};

export default function SocialFlashToast({ config, onClose }) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  const duration = Math.max(3000, Math.min(10000, config?.duration || 6000));

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      if (onClose) onClose();
    }, 350);
  }, [onClose]);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50);
    const autoDismiss = setTimeout(() => {
      handleClose();
    }, duration);

    return () => {
      clearTimeout(timer);
      clearTimeout(autoDismiss);
    };
  }, [duration, handleClose]);

  if (!config) return null;

  const typeInfo = SVG_TYPES[config.iconType] || SVG_TYPES.social;
  const { Component, color, bg } = typeInfo;

  return (
    <div className={`social-flash-toast ${visible && !closing ? "show" : ""} ${closing ? "hide" : ""}`}>
      <div className="social-flash-inner" style={{ "--flash-color": color }}>
        <span className="social-flash-sheen" aria-hidden="true" />
        <button className="social-flash-close" onClick={handleClose} aria-label="Close notification">
          <X size={15} strokeWidth={1.8} />
        </button>

        <div className="social-flash-badge" style={{ background: bg, border: `1px solid ${color}44` }}>
          <span className="social-flash-badge-ring" aria-hidden="true" />
          <Component size={20} color={color} strokeWidth={1.8} />
        </div>

        <div className="social-flash-body">
          <div className="social-flash-title">{config.title || "Social Notification"}</div>
          <div className="social-flash-message">{config.message || "You have a new update!"}</div>
          {safeUrl(config.url) && (
            <a
              href={safeUrl(config.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="social-flash-action"
              onClick={handleClose}
            >
              View <ExternalLink size={12} strokeWidth={1.8} />
            </a>
          )}
        </div>

        {/* Countdown progress bar */}
        <div
          className="social-flash-progress"
          style={{
            background: color,
            animationDuration: `${duration}ms`
          }}
        />
      </div>
    </div>
  );
}

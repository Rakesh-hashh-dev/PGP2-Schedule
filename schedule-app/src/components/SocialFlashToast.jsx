import { useState, useEffect } from "react";
import { safeUrl } from "../lib/safeUrl.js";

function SocialSvg({ color = "#8B5CF6" }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function AlertSvg({ color = "#F59E0B" }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function AnnouncementSvg({ color = "#3B82F6" }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function SuccessSvg({ color = "#10b981" }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function CloseSvg() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ExternalLinkSvg() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

const SVG_TYPES = {
  social: { Component: SocialSvg, color: "#8B5CF6", bg: "rgba(139, 92, 246, 0.2)" },
  alert: { Component: AlertSvg, color: "#F59E0B", bg: "rgba(245, 158, 11, 0.2)" },
  announcement: { Component: AnnouncementSvg, color: "#3B82F6", bg: "rgba(59, 130, 246, 0.2)" },
  success: { Component: SuccessSvg, color: "#10b981", bg: "rgba(16, 185, 129, 0.2)" }
};

export default function SocialFlashToast({ config, onClose }) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  const duration = Math.max(3000, Math.min(10000, config?.duration || 6000));

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      if (onClose) onClose();
    }, 350);
  };

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50);
    const autoDismiss = setTimeout(() => {
      handleClose();
    }, duration);

    return () => {
      clearTimeout(timer);
      clearTimeout(autoDismiss);
    };
  }, [duration]);

  if (!config) return null;

  const typeInfo = SVG_TYPES[config.iconType] || SVG_TYPES.social;
  const { Component, color, bg } = typeInfo;

  return (
    <div className={`social-flash-toast ${visible && !closing ? "show" : ""} ${closing ? "hide" : ""}`}>
      <div className="social-flash-inner" style={{ "--flash-color": color }}>
        <span className="social-flash-sheen" aria-hidden="true" />
        <button className="social-flash-close" onClick={handleClose} aria-label="Close notification">
          <CloseSvg />
        </button>

        <div className="social-flash-badge" style={{ background: bg, border: `1px solid ${color}44` }}>
          <span className="social-flash-badge-ring" aria-hidden="true" />
          <Component color={color} />
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
              View <ExternalLinkSvg />
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

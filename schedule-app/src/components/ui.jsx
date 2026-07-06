// Shared UI primitives — one canonical Card / Badge / Button / EmptyState /
// Skeleton so panels stop growing their own slightly-different versions.
// Styles live in ../styles/ui.css and use the global design tokens.
import { Loader2 } from "lucide-react";
import "../styles/ui.css";

export function Card({ as: Tag = "div", className = "", children, ...rest }) {
  return (
    <Tag className={`ui-card ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}

// tone: neutral | live | amber | violet | blue | danger
export function Badge({ tone = "neutral", className = "", children, ...rest }) {
  return (
    <span className={`ui-badge ui-badge-${tone} ${className}`.trim()} {...rest}>
      {children}
    </span>
  );
}

// variant: primary | secondary | ghost | danger · size: sm | md
export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  ...rest
}) {
  return (
    <button
      className={`ui-btn ui-btn-${variant} ui-btn-${size} ${className}`.trim()}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 size={size === "sm" ? 13 : 15} className="ui-btn-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function EmptyState({ icon: Icon, title, sub, action, compact = false, className = "" }) {
  return (
    <div className={`ui-empty${compact ? " ui-empty-compact" : ""} ${className}`.trim()} role="status">
      {Icon && (
        <div className="ui-empty-ico" aria-hidden="true">
          <Icon size={compact ? 18 : 26} strokeWidth={1.8} />
        </div>
      )}
      {title && <div className="ui-empty-title">{title}</div>}
      {sub && <div className="ui-empty-sub">{sub}</div>}
      {action && <div className="ui-empty-action">{action}</div>}
    </div>
  );
}

export function Skeleton({ width, height = 14, radius = 8, className = "", style }) {
  return (
    <span
      className={`ui-skeleton ${className}`.trim()}
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

// Reserves vertical space while lists load, instead of a bare "Loading…" line.
export function SkeletonText({ lines = 3, className = "" }) {
  return (
    <div className={`ui-skeleton-text ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={13} width={`${100 - (i % 3) * 18}%`} />
      ))}
    </div>
  );
}

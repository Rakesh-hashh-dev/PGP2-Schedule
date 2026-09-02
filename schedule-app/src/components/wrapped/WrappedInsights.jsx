import { ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, Brain, Fingerprint, Sparkles } from "lucide-react";

function compact(value, suffix = "") {
  if (value == null) return "—";
  return `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`;
}

function Delta({ metric }) {
  const improving = metric.delta === 0 || (metric.lowerIsBetter ? metric.delta < 0 : metric.delta > 0);
  const Icon = metric.delta > 0 ? ArrowUpRight : metric.delta < 0 ? ArrowDownRight : ArrowRight;
  return (
    <span className={`wrapped-comparison-delta${metric.delta === 0 ? " is-neutral" : improving ? " is-positive" : " is-negative"}`}>
      <Icon size={13} aria-hidden="true" />
      {metric.delta === 0 ? "No change" : `${metric.delta > 0 ? "+" : ""}${compact(metric.delta, metric.deltaUnit)}`}
    </span>
  );
}

export function WrappedIdentity({ archetype, insights }) {
  if (!archetype && !insights?.length) return null;
  return (
    <section className="wrapped-identity" aria-label="Your term pattern">
      {archetype && (
        <div className="wrapped-archetype">
          <span className="wrapped-archetype-icon"><Fingerprint size={20} aria-hidden="true" /></span>
          <div><span>Your term archetype</span><h2>{archetype.title}</h2><p>{archetype.description}</p></div>
        </div>
      )}
      {!!insights?.length && (
        <div className="wrapped-insight-list">
          <div className="wrapped-insight-list-head"><Brain size={17} aria-hidden="true" /><strong>What the pattern says</strong></div>
          {insights.map((insight) => <p key={insight.id}><Sparkles size={13} aria-hidden="true" />{insight.text}</p>)}
        </div>
      )}
    </section>
  );
}

export function WrappedComparison({ comparison }) {
  if (!comparison) return null;
  return (
    <section className="wrapped-panel wrapped-comparison">
      <div className="wrapped-panel-head">
        <div><h2>How this term changed</h2><p>Compared only with courses you had saved in {comparison.previousLabel}.</p></div>
        <span className="wrapped-comparison-badge"><BadgeCheck size={14} aria-hidden="true" /> Term over term</span>
      </div>
      <div className="wrapped-comparison-grid">
        {comparison.metrics.map((metric) => (
          <div className="wrapped-comparison-item" key={metric.id}>
            <span>{metric.label}</span>
            <strong>{compact(metric.current, metric.unit)}</strong>
            <Delta metric={metric} />
            <small>{compact(metric.previous, metric.unit)} in {comparison.previousLabel}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

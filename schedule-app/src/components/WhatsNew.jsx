import { X, Sparkles, ChevronRight, ArrowRight, BellRing, AlarmClock, Sunrise, ClipboardCheck, Link2, CalendarDays, Megaphone, Zap, Users, GraduationCap } from "lucide-react";

// "What's New" feature announcements. Entries come from
// system_config.flags.whatsNew (managed in Admin Tools):
//   { id, date: "YYYY-MM-DD", emoji, title, desc }

// One accent color per feature family — used sparingly (icon + date badge
// only, both at low opacity) rather than as a loud gradient fill. This is
// the restrained, monochrome-with-a-hint-of-color treatment of a SaaS
// changelog (Linear/Stripe-style), not an onboarding-screen icon pack.
const FAMILIES = {
  violet: "#6d5bd0",
  orange: "#e8702a",
  yellow: "#c98a1f",
  green: "#1fa971",
  blue: "#3498db",
};

// The admin-entered emoji doubles as a lookup key for a proper vector icon +
// accent color, so the list reads as designed rather than emoji soup.
// Unmapped emojis fall back to a violet Sparkles icon.
const ICON_MAP = [
  { match: ["🔔", "📣", "📢"], Icon: BellRing, family: "violet" },
  { match: ["⏰", "⏱️", "⏱", "🕙", "⌛"], Icon: AlarmClock, family: "orange" },
  { match: ["🌅", "☀️", "🌞", "🌄"], Icon: Sunrise, family: "yellow" },
  { match: ["✅", "☑️", "✔️"], Icon: ClipboardCheck, family: "green" },
  { match: ["🔗"], Icon: Link2, family: "blue" },
  { match: ["📅", "🗓️", "🗓"], Icon: CalendarDays, family: "blue" },
  { match: ["📋"], Icon: Megaphone, family: "violet" },
  { match: ["⚡", "🚀"], Icon: Zap, family: "orange" },
  { match: ["👥", "🧑‍🤝‍🧑"], Icon: Users, family: "blue" },
  { match: ["🎓"], Icon: GraduationCap, family: "violet" },
];

function iconFor(emoji) {
  const hit = ICON_MAP.find((m) => m.match.includes((emoji || "").trim()));
  const { Icon, family } = hit || { Icon: Sparkles, family: "violet" };
  return { Icon, solid: FAMILIES[family] };
}

function prettyDate(iso) {
  try {
    const [Y, M, D] = iso.split("-").map(Number);
    return new Date(Y, M - 1, D).toLocaleDateString([], { day: "numeric", month: "short" });
  } catch {
    return iso;
  }
}

export function WhatsNewPill({ item, count, onOpen }) {
  if (!item) return null;
  const { Icon, solid } = iconFor(item.emoji);
  return (
    <button className="wn-pill" onClick={onOpen}>
      <span className="wn-pill-tag">NEW</span>
      <Icon size={14} strokeWidth={2.2} style={{ color: solid, flexShrink: 0 }} />
      <span className="wn-pill-title">
        {item.title}
        {count > 1 && <span className="wn-pill-more"> +{count - 1} more</span>}
      </span>
      <ChevronRight size={14} className="wn-pill-arrow" />
    </button>
  );
}

export function WhatsNewModal({ items, onClose }) {
  return (
    <div className="wn-overlay" role="dialog" aria-modal="true" aria-labelledby="wn-title" onClick={onClose}>
      <div className="wn-modal" onClick={(e) => e.stopPropagation()}>
        <button className="wn-close" onClick={onClose} aria-label="Close">
          <X size={15} />
        </button>
        <div className="wn-head">
          <div className="wn-head-icon">
            <Sparkles size={18} color={FAMILIES.violet} strokeWidth={2} />
          </div>
          <div className="wn-head-text">
            <h3 id="wn-title">What&rsquo;s New</h3>
            <p className="wn-head-sub">Stay updated with the latest in TermFlow</p>
          </div>
        </div>
        <div className="wn-body">
          {(!items || items.length === 0) ? (
            <p className="wn-empty">Nothing new right now — check back soon!</p>
          ) : (
            <ul className="wn-list">
              {items.map((it, i) => {
                const { Icon, solid } = iconFor(it.emoji);
                return (
                  <li key={it.id} className="wn-item" style={{ "--i": i, borderLeftColor: solid }}>
                    <span className="wn-item-icon" style={{ background: `${solid}12`, border: `1px solid ${solid}28`, color: solid }}>
                      <Icon size={18} strokeWidth={2} />
                    </span>
                    <div className="wn-item-body">
                      <div className="wn-item-toprow">
                        <span className="wn-item-title">{it.title}</span>
                        {it.date && (
                          <span className="wn-item-date" style={{ background: `${solid}14`, color: solid }}>
                            {prettyDate(it.date)}
                          </span>
                        )}
                      </div>
                      {it.desc && <div className="wn-item-desc">{it.desc}</div>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="wn-footer-note">
            <Sparkles size={15} className="wn-footer-icon" />
            <div className="wn-footer-text">
              <div className="wn-footer-title">More updates coming soon</div>
              <div className="wn-footer-sub">We&rsquo;re always working to make TermFlow better for you.</div>
            </div>
          </div>
        </div>
        <button className="wn-got-it" onClick={onClose}>
          Got it <ArrowRight size={15} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

import { Check, Moon, Monitor, Palette, Smartphone, Sun } from "lucide-react";

const APPEARANCES = [
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "system", label: "System", Icon: Monitor },
];

export default function MobileUiVersionMenu({ version, onVersionChange, theme, onThemeChange, showAppearance = false }) {
  return (
    <div className="mobile-ui-version-menu">
      <div className="mobile-ui-menu-heading">
        <span className="mobile-ui-menu-icon"><Smartphone size={15} /></span>
        <span>
          <strong>Mobile interface</strong>
          <small>Choose your phone layout</small>
        </span>
      </div>
      <div className="mobile-ui-version-options" role="radiogroup" aria-label="Mobile interface">
        {[
          ["v1", "V1", "Classic"],
          ["v2", "V2", "Modern"],
        ].map(([id, name, detail]) => (
          <button
            type="button"
            key={id}
            className={version === id ? "is-selected" : ""}
            role="radio"
            aria-checked={version === id}
            onClick={() => onVersionChange(id)}
          >
            <span><strong>{name}</strong><small>{detail}</small></span>
            {version === id && <Check size={15} aria-hidden="true" />}
          </button>
        ))}
      </div>

      {showAppearance && (
        <>
          <div className="mobile-ui-menu-heading mobile-ui-menu-heading--appearance">
            <span className="mobile-ui-menu-icon"><Palette size={15} /></span>
            <span>
              <strong>Appearance</strong>
              <small>Independent of interface version</small>
            </span>
          </div>
          <div className="mobile-ui-appearance-options" role="radiogroup" aria-label="Appearance">
            {APPEARANCES.map(({ id, label, Icon }) => (
              <button
                type="button"
                key={id}
                className={theme === id ? "is-selected" : ""}
                role="radio"
                aria-checked={theme === id}
                onClick={() => onThemeChange(id)}
              >
                <Icon size={15} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

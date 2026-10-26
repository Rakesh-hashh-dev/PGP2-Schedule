import { useState } from "react";
import { Bell, BellOff, BellRing, Smartphone, Share, SquarePlus, Info, X } from "lucide-react";
import { isIOS } from "../../lib/push.js";
import { usePushStatus } from "../../hooks/usePushStatus.js";
import { useBackClose } from "../../lib/backClose.js";
import { useDialog } from "../../hooks/useDialog.js";

export function PushHelpSheet({ mode, onClose }) {
  useBackClose(onClose);
  const dialogRef = useDialog(true, onClose);
  const iosDevice = isIOS();
  const steps =
    mode === "ios-install"
      ? [
          { Icon: Share, text: <>Tap the <b>Share</b> button in Safari's toolbar</> },
          { Icon: SquarePlus, text: <>Choose <b>Add to Home Screen</b>, then <b>Add</b></> },
          { Icon: Smartphone, text: <>Open <b>TermFlow</b> from your Home Screen icon</> },
          { Icon: Bell, text: <>Come back here and tap <b>Enable push</b></> },
        ]
      : iosDevice
        ? [
            { Icon: Smartphone, text: <>Open iPhone <b>Settings → Notifications</b></> },
            { Icon: Bell, text: <>Find <b>TermFlow</b> and turn on <b>Allow Notifications</b></> },
            { Icon: BellRing, text: <>Return here and tap <b>Enable push</b> again</> },
          ]
        : [
            { Icon: Info, text: <>Tap the <b>lock / tune icon</b> next to the address bar</> },
            { Icon: Bell, text: <>Open <b>Permissions → Notifications</b> and choose <b>Allow</b></> },
            { Icon: BellRing, text: <>Reload the page and tap <b>Enable push</b> again</> },
          ];

  return (
    <div className="push-help-overlay" onClick={onClose}>
      <div className="push-help-sheet" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="How to enable notifications" onClick={(e) => e.stopPropagation()}>
        <div className="push-help-head">
          <div className="push-help-ico"><BellRing size={17} /></div>
          <h3>{mode === "ios-install" ? "Get notifications on iPhone" : "Notifications are blocked"}</h3>
          <button className="push-help-close" aria-label="Close" onClick={onClose}><X size={15} /></button>
        </div>
        <p className="push-help-sub">
          {mode === "ios-install"
            ? "iPhones only deliver push alerts to installed web apps. Install TermFlow once (takes ~10 seconds) — no App Store needed."
            : "Push was turned off for TermFlow on this device. Re-allow it in settings, then enable push here."}
        </p>
        <ol className="push-help-steps">
          {steps.map(({ Icon, text }, i) => (
            <li key={i}>
              <span className="push-help-step-num">{i + 1}</span>
              <Icon size={15} />
              <span>{text}</span>
            </li>
          ))}
        </ol>
        {mode === "ios-install" && (
          <p className="push-help-foot">Requires iOS 16.4 or newer. Class reminders, morning summaries and announcements all arrive on your lock screen once enabled.</p>
        )}
        <button className="push-help-done" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}

export function PushToggle({ userId, onStatusChange }) {
  const { status, toggle } = usePushStatus(userId, onStatusChange);
  const [helpOpen, setHelpOpen] = useState(false);

  if (status === "unsupported") return null;

  const needsHelp = status === "ios-install" || status === "denied";
  const label =
    status === "on" ? "Push on"
    : status === "ios-install" ? "Get notifications"
    : status === "denied" ? "Push blocked"
    : "Enable push";
  return (
    <>
      <button
        className={`notif-push-toggle${status === "on" ? " notif-push-on" : ""}`}
        onClick={needsHelp ? () => setHelpOpen(true) : toggle}
        disabled={status === "busy"}
        aria-label={label}
        title={
          status === "ios-install" ? "See how to get TermFlow alerts on your iPhone"
          : status === "denied" ? "See how to unblock notifications on this device"
          : "Get push alerts for schedule changes and announcements"
        }
      >
        {status === "on" ? <Bell size={13} /> : status === "ios-install" ? <Smartphone size={13} /> : <BellOff size={13} />}
        <span className="notif-btn-label">{label}</span>
      </button>
      {helpOpen && (
        <PushHelpSheet
          mode={status === "ios-install" ? "ios-install" : "denied"}
          onClose={() => setHelpOpen(false)}
        />
      )}
    </>
  );
}

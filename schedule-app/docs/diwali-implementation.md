# Diwali: Light Up Your Day

Implemented locally on 8 November 2026. No deployment or live notification send.

## Experience

- The Today screen has a warm, responsive Diwali corner, vector diya, geometric rangoli motif, and personal greeting. Academic cards and deadlines remain unchanged.
- Tap the diya to light it and replay a short companion greeting. Lit state, local mode opt-out, and temporary outfit choice are stored per signed-in account and event on the current device. Other accounts do not inherit those choices.
- The student's existing companion can wear a temporary rose-and-gold scarf in the greeting, festive corner, and companion page. Saved wardrobe, identity, unlocks, progression, and care actions are preserved. The scarf respects the cohort wardrobe switch. Turning the mode off or leaving the event window restores the saved appearance.
- Motion honors reduced-motion and companion motion-off settings. The festive corner pauses animation while offscreen or in a hidden tab; it does not play sound.
- App-wide background motion adds floating vector lanterns, drifting golden lights and a slowly rotating rangoli behind page content, alongside the existing fireworks. One stationary diya sits at the bottom-right, above phone navigation. Turning off Diwali mode disables the ambience. Hidden tabs pause animation; reduced motion retains the stationary diya while suppressing moving elements. Phone layouts reduce the decorative elements.
- Greeting-card downloads are 1200 × 1200 PNGs rendered locally with the actual visible companion vector layers and the diya. No card data is sent to a server. If pets are disabled or unadopted, the card uses the diya alone. Download errors are shown rather than reported as success.
- Campus Board has a Celebrations category for wishes and up to three photos, using existing upload, comment, owner edit/delete, report, and moderator flows. Celebration posts have no price or contact-number fields, enforced in PostgreSQL. Photos retain the existing shareable storage URLs; the composer explains this.

## Event and notification rules

The verified 2026 date is **8 November** ([India Post](https://www.indiapost.gov.in/holidays-list)). The visual window is the day before through the day after, evaluated in IST. No future-year date is guessed.

Admin configuration: `flags.features.diwaliDecor` is the independent Diwali on/off switch. Admin Tools → System → Features shows it alongside the separate Independence/Republic Day décor switch (`features.specialDayTheme`). The detailed Diwali panel uses the same switch and configures `flags.diwali.date` and `flags.diwali.greetingPush`. Review and publish the System area to apply staged changes. The older `flags.diwali.enabled` value is respected only when no explicit `features.diwaliDecor` choice exists. No new public configuration permissions are added.

`class-reminders` queues a `festive_greeting` for subscribed students only on the event day, 09:00–22:00 IST. The stable key `festival:diwali:<event-date>` permits one event per account across cron runs and multiple subscriptions. The Notification Settings **Festive greetings** toggle persists `push_prefs.prefs.festive_greeting.push`; opt-outs are excluded at production and suppression is checked again at dispatch. Quiet hours apply. Provider acceptance is not proof of display. Nothing is sent by the local preview or verification scripts.

The on-device visual-mode switch is separate from the cross-device notification preference; its label explicitly says "on this device". Existing notification scan-window/expiry rules still apply.

## Validation and preview

- 307 focused tests passed, covering campaign dates/IST boundaries, account/event isolation, blocked storage, notification opt-outs/deduplication, dispatch-time campaign switches, local export success/error paths, and existing companion transitions/artwork.
- `node scripts/verify-diwali.mjs` verifies category constraints, ownership, reports, automatic hiding, and moderation privacy in isolated in-memory PostgreSQL. It uses the optional runtime already installed under ignored `.local/notification-sql-runtime`.
- `node scripts/diwali-preview.mjs` generates `.local/diwali-preview.html` from the actual React components, with sample data and desktop/tablet/phone container controls. It does not connect to a live account.
- Production compilation uses `npx vite build --outDir .local/diwali-build`, avoiding the snapshot-mutating prebuild hook.
- Automated browser inspection timed out waiting for app approval. Actual rendered screenshots, native device rendering, and a real PNG visual inspection remain unverified.

## Release

Apply `20261108130000_campus_celebrations.sql` after the existing Board and moderation migrations. Deploy `class-reminders` with the shared `diwali.js`, deploy `dispatch` for the contextual greeting action, and release the web app. Existing notification/admin changes in the checkout remain release dependencies; this feature does not discard or publish them.

After release, verify the actual Today screen, every companion selected by users, reduced motion, mode/scarf toggles, persisted diya state, card download, and a reported celebration post. Use only an authorized targeted test for real push verification. Festival activation never means that academic commitments are cancelled.

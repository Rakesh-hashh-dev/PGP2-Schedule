# Private drafts and shortcuts — source-based UX review

Reviewed and implemented 8 November 2026. The user explicitly approved proceeding from source after browser and native screenshot capture were unavailable. These findings are based on the current components and state logic, not screenshots. Rendered layout, real signed-in interaction, focus behavior, and native-device performance remain unverified.

## Findings and changes

1. **Open Admin Tools.** Shortcuts originally had no heading/count/empty-state action. Draft recovery could expand into an otherwise unexplained empty panel because clean areas returned nothing. Added named cards, an explicit empty state, a pin count, and a status for each publication area, including read-only roles.
2. **Customize shortcuts.** The previous flat checkbox list had no search or grouping and silently truncated a ninth selection. Added grouped selectable cards, search, visible selection count/limit, and explicit role filtering. Pinned commands retain their existing navigation handlers and device/account persistence.
3. **Clear or reset preferences.** Resetting all preferences was mixed into shortcut selection and also erased saved filters. Added a clear-shortcuts action that preserves filters; full workspace reset is separated and requires an inline confirmation explaining what it clears.
4. **Edit settings.** An old `savedAt` timestamp could outrank newer unsaved edits in the displayed status. Added state precedence: read-only, error, loading, recovery required, unsaved changes, saved current edits, no pending edits. Current edits are only described as saved when they match the persisted draft payload.
5. **Recover an earlier session.** Resume and discard previously looked equally prominent, and discard acted immediately. Resume is the primary action. Discard uses a confirmation that distinguishes the saved copy from editor changes and published settings. Resuming over current edits uses an inline confirmation instead of a browser dialog.
6. **Handle failures.** Each affected area now has contextual reload/retry controls and an explicit unsaved/error state. Status updates use accessible live regions. Existing revision checks, serialized autosave, private storage, navigation guards, and server capability checks remain in place. Read-only areas do not start autosave or unnecessarily load writable drafts.

## Layout

Existing app typography, colors, borders, and Lucide icons are reused. Workspace columns now give both panels usable space, stack below 1100px, and adapt their internal grids using container queries. Small containers stack shortcut options and allow status badges and recovery actions to wrap. Native details/summary and checkbox controls preserve keyboard operation; controls have visible focus styling. These are implementation rules, not evidence of visual acceptance.

## Verification

Focused tests cover stale-save status precedence, errors/recovery, read-only states, pin limits and capability filtering, saved-filter preservation, existing autosave/revision/merge/navigation guards, and command permissions. The production build and targeted lint are checked separately. `node scripts/admin-workspace-preview.mjs` creates an offline preview using the actual components and synthetic RPCs; no production data is read, modified, or published.

## Related festive changes

The Diwali banner now ends with “With warm wishes, Rakesh”. Optional background fireworks are limited to the active campaign, draw behind app content, respect motion-off/reduced motion, pause in hidden tabs, cap particle counts and pixel density, use fewer particles/lower frame rate on phones, and stop the animation loop between bursts. The per-account/event/device fireworks toggle is saved with the existing festive preferences. The greeting-card sender remains the student who downloads it.

No deployment or live notification send was performed.

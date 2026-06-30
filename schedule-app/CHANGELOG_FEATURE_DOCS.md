# Changelog Feature — System Architecture & Implementation

This document saves the complete architecture and code for the "What's New / Changelog" feature that integrates into the Service Worker Update popup.

## Architecture Overview

- **Storage**: Driven by `system_config` table in Supabase. The `flags` JSON object stores an array of `changelog` releases.
- **Frontend Tracking**: `localStorage` key (`pgp2.sw-dismissed-version`) is used to ensure the popup only shows **once per release**.
- **Admin Management**: A UI within `AdminDashboard.jsx` to let the admin add new releases, manage entries, tag them (NEW, UI, FIX, PERF), and save to the database.

## How to restore this feature later

All the code changes have been safely saved into a Git patch file named `changelog_feature.patch` in the root of the `schedule-app` folder.

When you are ready to re-add this feature, simply open your terminal in the `schedule-app` directory and run:

```bash
git apply changelog_feature.patch
```

This will automatically add the Changelog Editor back to the Admin Dashboard, re-add the CSS styles, and restore the SW popup integration in `App.jsx`.

### If the patch fails (due to other code changes over time):
You can read the `changelog_feature.patch` file directly to see exactly what lines of code need to be added to `App.jsx`, `AdminDashboard.jsx`, and `styles.css`.

---

*Feature temporarily removed as per request on June 30, 2026. The patch file safely contains all the work.*

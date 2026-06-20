# Migrate Storage to Google Drive to Bypass the 500KB Limit

Currently, the change-tracking algorithm uses Google Apps Script's `PropertiesService` to store the historical baseline of the timetable. `PropertiesService` has a strict quota of 500KB across the entire script.

While your current timetable only consumes about ~80KB, if you want to make the system completely future-proof against this limit, we can migrate the storage backend to use a hidden text file in Google Drive. 

## Proposed Changes

We will modify the core storage logic in `google_apps_script.js` to rely on `DriveApp` instead of `PropertiesService`.

### [google_apps_script.js]

We will remove the `PropertiesService` implementation and implement the following:

```javascript
/* ---------- persistence (Google Drive file) ---------- */
// This eliminates the 500KB limit by storing the system data in a tiny JSON file in Google Drive.

const DB_FILENAME = "schedule_baseline_db.json";

function _getDb() {
  const files = DriveApp.getFilesByName(DB_FILENAME);
  if (files.hasNext()) {
    try {
      return JSON.parse(files.next().getBlob().getDataAsString());
    } catch(e) { }
  }
  return { changes: [] };
}

function _saveDb(data) {
  const files = DriveApp.getFilesByName(DB_FILENAME);
  if (files.hasNext()) {
    files.next().setContent(JSON.stringify(data));
  } else {
    DriveApp.createFile(DB_FILENAME, JSON.stringify(data), MimeType.PLAIN_TEXT);
  }
}

function loadChanges() {
  return _getDb().changes || [];
}

function appendChanges(events) {
  const db = _getDb();
  db.changes = events.concat(db.changes || []).slice(0, MAX_CHANGES);
  _saveDb(db);
}

function saveChunked(prefix, obj) {
  const db = _getDb();
  db[prefix] = obj;
  _saveDb(db);
}

function loadChunked(prefix) {
  return _getDb()[prefix] || null;
}
```

## User Review Required

> [!WARNING]
> Because the script will interact directly with Google Drive files instead of internal property stores, when you deploy this new code, **Google will prompt you to authorize a new permission: "View and manage Google Drive files"**. You will need to explicitly grant this permission.

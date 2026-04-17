# Rinchan vs Kokun Weight Loss Challenge

Simple mobile-friendly weekly challenge tracker for two players using plain HTML, CSS, and vanilla JavaScript. It is designed to deploy as a static site on GitHub Pages and store one shared JSON app state online through a hosted JSON storage API.

## Files

- `index.html`: UI structure
- `styles.css`: mobile-friendly styling
- `app.js`: scoring logic, rendering, interactions, weekly calculations
- `storage.js`: hosted JSON storage provider integration, isolated for easy swapping
- `config.example.js`: storage credentials and sample initial state
- `README.md`: setup and deployment guide

## Default players and rules

The sample initial state already includes:

- Rinchan
- Kokun
- Every 30 minutes of workout = +1 point
- Every 5,000 steps = +1 point
- Under daily calorie goal = +3 points
- Every 100 calories over daily calorie goal = -1 point

## How app state works

The app stores everything in one JSON document:

```json
{
  "meta": {
    "revision": 0,
    "updatedAt": null,
    "lastResetAt": null,
    "weekLabel": "Current Week"
  },
  "players": [],
  "rules": [],
  "entries": {},
  "adjustments": [],
  "history": []
}
```

This makes it easier to swap providers later because `storage.js` only reads and writes one document.

## Storage provider setup

This project is prewired for JSONBin in `storage.js`, but the provider logic is isolated so you can replace it later with another hosted JSON storage API that supports browser `fetch()` and CORS.

### JSONBin setup

1. Create a JSONBin account.
2. Create a new bin containing the sample state from `window.APP_DEFAULT_STATE` in `config.example.js`.
3. If you want GitHub Pages to be public and safe, make the bin visibility `Public`.
4. Copy the public bin ID into `config.example.js`.
5. If you want local editing, copy `config.local.example.js` to `config.local.js`.
6. Put your write-capable JSONBin access key only in `config.local.js`.
7. Do not commit `config.local.js`.
8. Deploy only the tracked files.

### Safe production pattern

- `config.example.js`: commit only a public read-only bin ID here
- `config.local.js`: keep your private access key here for local/private editing only
- GitHub Pages deployment: view-only by default when no write key is present

### Important security rule

Any key shipped to a browser-accessible static site is exposed to anyone who can open developer tools.

That means:

- a real write-capable key must never be committed
- a real write-capable key must never be deployed to GitHub Pages
- if you need secure public editing, you need a backend or serverless proxy

### Important JSONBin note

This app supports:

- public read-only bin access using only `binId`
- authenticated writes using `X-Access-Key` or `X-Master-Key`
- local fallback storage when remote write access is not configured

## Deploy on GitHub Pages

1. Put these files in your repo root.
2. Commit and push the repo to GitHub.
3. In GitHub, open the repository.
4. Go to `Settings`.
5. Go to `Pages`.
6. Under `Build and deployment`, set:
   - `Source`: `Deploy from a branch`
   - `Branch`: `main` or your preferred branch
   - `Folder`: `/ (root)`
7. Click `Save`.
8. Wait for GitHub Pages to publish the site.
9. Open the Pages URL GitHub shows.

If you update `config.example.js`, commit and push again so GitHub Pages republishes the new credentials and default state.

## How to change players

Open `config.example.js` and edit `window.APP_DEFAULT_STATE.players`.

Example:

```js
players: [
  { id: "rinchan", name: "Rinchan" },
  { id: "kokun", name: "Kokun" }
]
```

Player IDs should stay unique and stable.

## How to change or add rules

You have two options:

### Option 1: Change the default rules in code

Open `config.example.js` and edit `window.APP_DEFAULT_STATE.rules`.

Supported rule types in the current rules engine:

- `threshold_increment`
  - Example: every 30 workout minutes = +1
  - Fields: `metric`, `threshold`, `points`
- `below_goal_bonus`
  - Example: calories eaten below calorie goal = +3
  - Fields: `metric`, `goalMetric`, `points`
- `above_goal_penalty`
  - Example: every 100 calories over calorie goal = -1
  - Fields: `metric`, `goalMetric`, `threshold`, `points`

### Option 2: Add rules from the app UI

Use the Rules Manager section in the site to add, disable, or delete rules without rewriting the whole app.

## How weekly reset works

The `Reset week` button:

- clears `entries`
- clears `adjustments`
- clears `history`
- updates `meta.lastResetAt`
- keeps `players`
- keeps `rules`

If you want reset to preserve history instead, change `handleResetWeek()` in `app.js`.

## Live shared data behavior

The app tries to stay safe for simple shared usage by:

- loading the latest remote state before each save
- incrementing a `revision` number on each write
- showing a `last updated` timestamp
- refreshing automatically on an interval
- refreshing when the tab becomes active again

This is still a simple frontend-only shared editing model, not a full multi-user database with strong locking.

## Security limitations

This project is frontend-only, so any storage credential placed in `config.example.js` is visible to anyone who can load the site in the browser.

That means:

- users can inspect the API key in browser developer tools
- users with the key can read or overwrite the shared data
- this is not appropriate for sensitive or private health data
- this is best only for lightweight personal projects with low security needs

For stronger security, use a small backend or serverless function that hides the provider key and validates writes.

## Swapping storage providers later

To change providers later:

1. Keep the same JSON document shape.
2. Replace the provider implementation in `storage.js`.
3. Keep the public `load(defaultState)` and `save(state)` methods the same.
4. Update `window.APP_CONFIG.storage` to match the new provider.

The rest of the app should keep working without major rewrites.

# challenge

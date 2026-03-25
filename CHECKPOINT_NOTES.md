# Super Cool Fantasy Baseball Dashboard — Checkpoint Notes
## March 25, 2026

---

## Project Status: ✅ LIVE & AUTHENTICATED

**URL**: https://supercoolfantasybaseballdashboard.xyz
**Repo**: https://github.com/jjoshkaplan/supercoolfantasybaseballdashboard
**Hosting**: Vercel (free tier, auto-deploys from GitHub main branch)
**Domain**: supercoolfantasybaseballdashboard.xyz

---

## What's Working

- Landing page loads at root URL with animated gradient branding
- Yahoo OAuth2 login flow completes successfully (PKCE, public client)
- User is redirected to /dashboard.html after authentication
- Session persists via encrypted JWE cookie (30-day expiry)
- Auth check endpoint (/api/auth-me) returns authenticated status
- Logout clears session and redirects to home
- Live tracker page (/live.html) loads — calls MLB Stats API directly from browser
- Vercel auto-deploys on every push to main

## What's Next to Test / Build

- Dashboard data loading (leagues, roster, standings, matchups, transactions)
- Yahoo API proxy (/api/yahoo) — needs live testing with authenticated session
- Live tracker player tracking during actual MLB games (season opens tonight 3/25)
- Statcast panel (strike zone, spray chart, pitch log, exit velo) — built but needs live game data
- Multi-game simultaneous tracking

---

## Architecture

```
supercoolfantasybaseballdashboard/
├── index.html              Landing page (public)
├── dashboard.html          Yahoo Fantasy dashboard (requires auth)
├── live.html               MLB live tracker + Statcast (no auth needed)
├── package.json            Dependencies (jose for JWE encryption)
├── vercel.json             Routing rewrites + cache headers
└── api/
    ├── _auth.js            Shared auth helper (underscore = hidden from routes)
    ├── auth-login.js       → /api/auth-login (redirects to Yahoo OAuth + PKCE)
    ├── auth-callback.js    → /api/auth-callback (exchanges code for tokens)
    ├── auth-logout.js      → /api/auth-logout (clears session cookie)
    ├── auth-me.js          → /api/auth-me (returns { authenticated: true/false })
    └── yahoo.js            → /api/yahoo?endpoint=... (Yahoo API proxy)
```

### Key Design Decisions

1. **Public client (no client_secret)**: Yahoo app is "Installed Application" type. Uses PKCE (S256 code challenge) instead of client secret. The `client_secret` must NOT be sent in any API call.

2. **JWE encrypted cookies**: Yahoo tokens (access + refresh) are encrypted using `jose` library with AES-256-GCM and stored in an httpOnly secure cookie. No database needed. Vercel env var `TOKEN_SECRET` is the encryption key.

3. **PKCE flow**: Login generates a random `code_verifier`, hashes it to `code_challenge` (SHA-256, base64url), stores verifier in a temporary cookie (`scfbd_verifier`), sends challenge to Yahoo. Callback reads verifier from cookie and sends it with the token exchange.

4. **Flat file structure**: All serverless functions are in a single `api/` folder (no subfolders). Vercel requires `api/` at repo root. Files use `require('./_auth')` for the shared helper. The underscore prefix prevents Vercel from exposing `_auth.js` as a route.

5. **Static HTML + vanilla JS**: No build step, no framework. HTML files at repo root are served as static files. Dashboard JS calls `/api/yahoo?endpoint=...` which proxies to Yahoo's Fantasy API.

6. **MLB Stats API (free)**: Live tracker calls `statsapi.mlb.com` directly from the browser. No API key, no proxy needed. Polls every 12 seconds. Returns full GUMBO game state including batter/onDeck/inHole, pitch data, hit data.

---

## Environment Variables (Vercel Dashboard)

| Variable | Value | Notes |
|----------|-------|-------|
| `YAHOO_CLIENT_ID` | dj0yJmk9Q1J1aVhwdE... | From Yahoo Developer app |
| `YAHOO_CLIENT_SECRET` | (not used for public client) | Can be removed |
| `TOKEN_SECRET` | (32+ char random hex) | Encrypts session cookies |
| `NEXT_PUBLIC_BASE_URL` | https://supercoolfantasybaseballdashboard.xyz | Used for OAuth redirect URI |

### Yahoo Developer App Settings

- **App ID**: 4DYLAPSh
- **App Type**: Installed Application (public client)
- **Redirect URI**: https://supercoolfantasybaseballdashboard.xyz/api/auth-callback
- **API Permissions**: Fantasy Sports → Read
- **Portal**: https://developer.yahoo.com/apps/

---

## Lessons Learned / Gotchas

1. **Vercel requires `api/` folder at repo root** — files outside this folder are not detected as serverless functions

2. **File naming = URL routing** — `api/auth-login.js` → `/api/auth-login`. No nested folders needed; use hyphens instead of slashes

3. **`_` prefix hides helpers** — `api/_auth.js` is importable but not exposed as a route

4. **Yahoo OAuth now requires PKCE** — plain OAuth2 without `code_challenge` returns "invalid code challenge or method"

5. **Yahoo public clients reject `client_secret`** — sending it returns "client secret not required". Must omit from both token exchange and refresh calls

6. **GitHub dropped password auth** — use Personal Access Token or SSH key for `git push`

7. **`require()` paths must match actual file locations** — when restructuring files, every import path must be updated. `require('../../lib/auth')` → `require('./_auth')` when files move to same folder

8. **HTML href paths must match API filenames** — `/api/auth/login` (slash) ≠ `/api/auth-login` (hyphen). Both HTML files and JS fetch calls need matching paths

9. **Vercel caches old deployments** — after pushing, check Vercel dashboard Deployments tab to confirm new build triggered. Old cached pages may persist briefly.

---

## Features Reference

### Dashboard (/dashboard.html)
- **My Roster**: Player positions, headshots, injury status, team abbreviations
- **Standings**: Full league table with W-L record, win %, PF/PA, games back
- **Matchups**: Head-to-head scoreboard with team logos and points
- **Transactions**: Recent adds, drops, trades with dates
- League selector dropdown for multiple leagues

### Live Tracker (/live.html)
- **Player status tracking**: AT BAT (green pulse), ON DECK (yellow), IN HOLE (orange), PITCHING (purple)
- **Multi-game grid**: All today's games sorted by your players' activity
- **Count display**: Ball/strike/out pips with visual indicators
- **Base runners**: Mini diamond showing occupied bases
- **Alert banners**: Top-of-screen alerts when your player bats or pitches
- **Statcast panel** (per game, toggleable):
  - Strike zone SVG (catcher's view, 3×3 grid, numbered color-coded pitch dots)
  - Pitch log (type abbreviation, velocity, call result)
  - Spray chart (overhead field view with hit dots, your players highlighted)
  - Stats bar (velocity, spin rate, exit velo, launch angle, distance)
  - Balls in play log (recent 6 with EV, LA, distance, result)
  - Pitch type legend (auto-generated from current AB)
- **Configurable polling**: 8s / 12s / 20s / 30s refresh interval
- **localStorage persistence**: Player list saved between sessions

---

## Files Inventory (11 files total)

| File | Lines | Purpose |
|------|-------|---------|
| `index.html` | ~210 | Landing page with OAuth sign-in |
| `dashboard.html` | ~340 | Yahoo Fantasy dashboard |
| `live.html` | ~310 | Live tracker + Statcast |
| `api/_auth.js` | ~100 | Token encryption, cookies, refresh |
| `api/auth-login.js` | ~35 | OAuth redirect with PKCE |
| `api/auth-callback.js` | ~65 | Token exchange + session creation |
| `api/auth-logout.js` | ~8 | Clear session |
| `api/auth-me.js` | ~20 | Auth status check |
| `api/yahoo.js` | ~55 | Yahoo API proxy |
| `package.json` | ~7 | Dependencies (jose) |
| `vercel.json` | ~15 | Routing + headers |

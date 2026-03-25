# supercoolfantasybaseballdashboard.xyz

A public fantasy baseball dashboard that lets anyone connect their Yahoo Fantasy account and view their leagues, rosters, standings, matchups, and live MLB Statcast data.

## Deploy to Vercel

### 1. Set up Yahoo Developer App

1. Go to **https://developer.yahoo.com/apps/**
2. Click **Create an App**
3. Settings:
   - **App Name**: Super Cool Fantasy Baseball Dashboard
   - **App Type**: Web Application
   - **Redirect URI**: `https://supercoolfantasybaseballdashboard.xyz/api/auth/callback`
   - **API Permissions**: Fantasy Sports → Read
4. Save your **Client ID** and **Client Secret**

### 2. Deploy

```bash
# Install Vercel CLI if you don't have it
npm i -g vercel

# Clone/navigate to this project
cd supercoolfantasybaseballdashboard

# Install dependencies
npm install

# Deploy
vercel
```

### 3. Set Environment Variables

In Vercel dashboard → Settings → Environment Variables, add:

| Variable | Value |
|----------|-------|
| `YAHOO_CLIENT_ID` | Your Yahoo app Client ID |
| `YAHOO_CLIENT_SECRET` | Your Yahoo app Client Secret |
| `TOKEN_SECRET` | Random 32+ char string (run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `NEXT_PUBLIC_BASE_URL` | `https://supercoolfantasybaseballdashboard.xyz` |

### 4. Connect Domain

In Vercel dashboard → Settings → Domains → add `supercoolfantasybaseballdashboard.xyz`.

Then in your domain registrar, point DNS:
- **A record**: `76.76.21.21`
- **CNAME**: `cname.vercel-dns.com` (for www subdomain)

---

## Architecture

```
public/
  index.html        Landing page with Yahoo OAuth sign-in
  dashboard.html     Main dashboard (roster, standings, matchups, transactions)
  live.html          Standalone live game tracker with Statcast

api/
  auth/
    login.js         → Redirects to Yahoo OAuth consent
    callback.js      → Exchanges auth code for tokens, encrypts into cookie
    logout.js        → Clears session cookie
    me.js            → Returns { authenticated: true/false }
  yahoo.js           → Generic Yahoo API proxy (reads token from cookie)

lib/
  auth.js            → Shared token encryption/decryption (JWE via jose)
```

**Token storage**: Yahoo access + refresh tokens are encrypted into a JWE (JSON Web Encryption) and stored in an httpOnly, secure cookie. No database needed. Tokens never hit Vercel's servers in plaintext — they're encrypted/decrypted in the serverless function runtime only.

**Yahoo API proxy**: All Yahoo Fantasy API calls go through `/api/yahoo?endpoint=...` which reads the encrypted cookie, decrypts the access token, and forwards the request to Yahoo. If the token is expired, it auto-refreshes using the refresh token and updates the cookie.

**Live tracker**: The `/live` page calls the MLB Stats API directly from the browser — no server-side proxy needed. This means:
- Zero auth required for live game tracking
- No API key needed (MLB Stats API is public)
- Polling at ~12 second intervals (configurable)
- Statcast data including pitch coordinates, velocity, spin, exit velo, launch angle, spray chart

---

## Local Development

```bash
# Install
npm install

# Create .env from template
cp .env.example .env
# Fill in your Yahoo credentials + a random TOKEN_SECRET

# Run with Vercel dev
vercel dev
```

Opens at `http://localhost:3000`. Note: Yahoo OAuth callback must point to your production domain, so for local dev you may need to temporarily update the redirect URI in your Yahoo app settings.

---

## Stack

- **Hosting**: Vercel (static + serverless)
- **Auth**: Yahoo OAuth2 → JWE encrypted cookies
- **Frontend**: Vanilla HTML/CSS/JS (no build step, no framework)
- **APIs**: Yahoo Fantasy Sports API + MLB Stats API (GUMBO)
- **Crypto**: jose (JWE for token encryption)

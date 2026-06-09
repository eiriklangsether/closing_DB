# SalesScreen Finance Dashboard

Internal finance dashboard for the SalesScreen group. Shows live connectivity status across Tripletex (NO), Fortnox (SE), and QuickBooks (US).

---

## Deploy to Vercel (5 minutes)

### 1. Push to GitHub

Create a new private GitHub repo and push this folder:

```bash
git init
git add .
git commit -m "Initial dashboard"
git remote add origin https://github.com/YOUR_USERNAME/salesscreen-dashboard.git
git push -u origin main
```

### 2. Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New → Project**
3. Import your GitHub repo
4. Click **Deploy** (default settings are fine)

### 3. Add environment variables

In your Vercel project → **Settings → Environment Variables**, add:

| Variable | Value | Notes |
|---|---|---|
| `DASHBOARD_SECRET` | Any long random string | e.g. `openssl rand -hex 32`. All visitors need this to load data. |
| `TRIPLETEX_TOKEN` | Your Tripletex session token | See below |
| `TRIPLETEX_COMPANY_ID` | `1914191` | Dogu SalesScreen AS company ID |
| `FORTNOX_ACCESS_TOKEN` | Your Fortnox access token | See below |
| `QB_ACCESS_TOKEN` | Your QuickBooks access token | See below |
| `QB_REALM_ID` | Your QuickBooks company/realm ID | Found in QBO URL |

After adding variables, go to **Deployments → Redeploy** so they take effect.

### 4. Set the dashboard secret in the HTML

In `public/index.html`, find this line near the bottom of the script:

```js
const SECRET = window.__DASHBOARD_SECRET__ || '';
```

Replace it with your chosen secret:

```js
const SECRET = 'your-secret-here';
```

Redeploy after saving.

> **Note:** This is an internal tool for a small team — the secret in the HTML is acceptable for this use case. For stricter access control, consider Vercel's password protection (Pro) or basic auth middleware.

---

## Getting API tokens

### Tripletex
1. Log in to Tripletex
2. Go to **My profile → API access**
3. Create a new session token
4. The token format is `{employeeId}:{token}` — only paste the token part into the env var (the proxy prepends `0:`)

### Fortnox
1. Log in to Fortnox as admin
2. Go to **Settings → Integrations → API**
3. Generate an access token with read access to accounting data

### QuickBooks
QuickBooks uses OAuth 2.0 with short-lived tokens (1 hour). For a persistent dashboard you have two options:
- Use the [Intuit Developer Portal](https://developer.intuit.com) to create an app and implement token refresh (more setup)
- For now, the dashboard will show "Disconnected" for QBO until this is configured — which matches the current state (auth incomplete)

---

## Local development

```bash
npm i -g vercel
vercel dev
```

Set the env vars in a `.env.local` file (same keys as above). Vercel CLI picks them up automatically.

---

## Extending the dashboard

The site is a single `public/index.html` with three API proxy functions in `/api/`. To add more data:

1. Add a new function in `/api/` (copy the pattern from `tripletex.js`)
2. Call it from the frontend with the `x-dashboard-secret` header
3. Render the result in the HTML

Future tabs to add: close status, cost variances, salary summary, MRR snapshot.

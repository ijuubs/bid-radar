# Bid Radar — deploy to Cloudflare Pages

This is the standalone version of the dashboard (same design, but running as
its own site instead of inside Claude — needed because Claude's artifact
sandbox can't call external APIs directly).

## Deploy (no local install needed)

1. Go to https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** tab
2. Choose **Upload assets** (not "Connect to Git" — simplest path, no GitHub needed)
3. You need a *built* folder to upload — see "Build" below
4. Drag that folder in, name the project (e.g. `bid-radar`), deploy
5. You'll get a URL like `https://bid-radar.pages.dev` — that's your live dashboard

## Build

You'll need Node.js installed on your own machine for this one step
(download from nodejs.org if you don't have it):

```
cd bid-radar
npm install
npm run build
```

This creates a `dist/` folder — that's what you drag into Cloudflare Pages
in step 4 above.

## First-time setup on the live site

Open your new `https://bid-radar.pages.dev` URL, click **Setup**, and fill in:

- **Freelancer.com OAuth token** — from freelancer.com → Settings → API
- **Proxy URL** — your Worker URL (`https://shrill-forest-be0c.kavi-kavinay.workers.dev`)
- **Anthropic API key** — from console.anthropic.com → API Keys (used to draft proposals)

Everything is stored in your browser's local storage only — nothing is sent
anywhere except Freelancer.com (through your Worker) and Anthropic's API.

## Why this fixes the earlier "Failed to fetch" error

Claude's in-chat artifact preview only allows outbound requests to a small
allowlist of domains. It doesn't matter how correctly the Worker or CORS
headers are set up — the sandbox itself blocks the call. Once this runs as
its own deployed site, that restriction doesn't apply.

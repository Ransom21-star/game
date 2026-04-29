# SOVEREIGN — Production Deployment Guide

## File Structure
```
sovereign-vercel/
├── api/
│   └── chat.js        ← Serverless function: Claude → Gemini fallback
├── index.html         ← Full SOVEREIGN frontend (zero API keys)
├── package.json       ← Node 24.x, ESM
├── vercel.json        ← Routing, function config, CORS headers
└── README.md
```

## Environment Variables
Set in Vercel Dashboard → Project → Settings → Environment Variables:

| Variable        | Value                  |
|-----------------|------------------------|
| CLAUDE_API_KEY  | your Anthropic API key |
| GEMINI_API_KEY  | your Google API key    |

## How AI routing works
```
Frontend → POST /api/chat
              ↓
         Try Claude first
              ↓ fails (quota / timeout / error)
         Try Gemini fallback
              ↓ fails
         Return { engine: 'none', error: true }
              ↓
         Frontend never crashes
```

## Deploy Steps

1. Install Vercel CLI
   npm install -g vercel

2. Deploy
   cd sovereign-vercel
   vercel

   - Framework: Other
   - Root directory: . (current)

3. Set env vars (either CLI or dashboard)
   vercel env add CLAUDE_API_KEY
   vercel env add GEMINI_API_KEY

4. Redeploy to production
   vercel --prod

## Local development
   vercel dev

Create .env.local in project root:
   CLAUDE_API_KEY=your_key_here
   GEMINI_API_KEY=your_key_here

## Status dot
🟢 Green  = Claude active
🟡 Yellow = Gemini fallback active
🔴 Red    = Both offline

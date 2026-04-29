# SOVEREIGN — Production Deployment Guide

## File Structure
```
sovereign-vercel/
├── api/
│   └── chat.js        ← Serverless function: Gemini only
├── index.html         ← Full SOVEREIGN frontend (zero API keys)
├── package.json       ← Node 24.x, ESM
├── vercel.json        ← Routing, function config, CORS headers
└── README.md
```

## Environment Variables
Set in Vercel Dashboard → Project → Settings → Environment Variables:

| Variable        | Value                  |
|-----------------|------------------------|
| GEMINI_API_KEY  | your Google API key    |

## How AI routing works
```
Frontend → POST /api/chat
              ↓
         Gemini only
              ↓
         Return { text: 'AI response here' }
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
   vercel env add GEMINI_API_KEY

4. Redeploy to production
   vercel --prod

## Local development
   vercel dev

Create .env.local in project root:
   GEMINI_API_KEY=your_key_here

## Status dot
🟡 Yellow = Gemini active
🔴 Red    = Offline

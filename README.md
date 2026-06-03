# Ursa LinkedIn Profile Builder

Internal brand tool for generating consistent, brand-aligned LinkedIn profiles for Ursa Mobile employees from their resumes.

## What it does
1. Employee uploads or pastes their resume
2. Sets brand voice and SEO keywords (defaults to Ursa Mobile brand)
3. Claude generates: headline, About section, experience bullets, skills, connection note
4. Employee copies each section into LinkedIn

## Architecture
- Static HTML frontend (`public/index.html`)
- Vercel Edge Function backend (`api/generate.js`) — proxies Anthropic API to keep the key server-side
- No database, no state, fully stateless

## Deploy
See `HANDOFF.md` for full Claude Code deployment instructions.

## Local dev
```bash
npm i -g vercel
vercel dev
```
Set `ANTHROPIC_API_KEY` in `.env.local` first.

## Files
```
ursa-linkedin-profiles/
├── api/
│   └── generate.js       # Edge function — calls Anthropic API
├── public/
│   └── index.html        # Frontend (single-file)
├── vercel.json           # Vercel routing config
├── .env.example          # Environment variable template
├── .gitignore
├── package.json
├── README.md
└── HANDOFF.md            # Claude Code deployment guide
```

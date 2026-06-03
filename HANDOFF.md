# Claude Code Handoff: Deploy Ursa LinkedIn Profile Builder to Vercel

> This is a handoff document for Claude Code (or any developer). Follow the steps in order. Everything you need is in this folder.

## Context

This is an internal brand tool for **Ursa Mobile** (ursamobile.com). Employees upload their resume, the tool generates a complete LinkedIn profile (headline, About, bullets, skills, connection note) aligned to the company brand voice and SEO keywords. Built as a static site + one Vercel Edge Function.

**Tech stack:**
- Static HTML frontend (no framework)
- Vercel Edge Function (Node 18+) for the Anthropic API proxy
- Anthropic Claude Sonnet 4 as the LLM
- Deploys to Vercel free or Pro tier

**Why a proxy:** The Anthropic API key must stay server-side. The frontend calls `/api/generate` with the resume content; the edge function adds the API key and forwards to Anthropic.

---

## Prerequisites (gather BEFORE deploying)

Ask Ramesh for these. Do NOT proceed without them.

- [ ] **Anthropic API key** (`sk-ant-...`) — from https://console.anthropic.com
- [ ] **GitHub access** — either an existing org/repo or permission to create `ursa-mobile/ursa-linkedin-profiles`
- [ ] **Vercel account access** — assumed to be Ramesh's existing account (same one used for the platform/SSP project)
- [ ] **Target domain confirmation** — default is `linkedin.ursamobile.com` (subdomain of existing ursamobile.com). Confirm DNS for ursamobile.com is managed in Vercel or a known DNS provider.

---

## Deployment steps

### Step 1: Initialize git and push to GitHub

```bash
cd ursa-linkedin-profiles
git init
git add .
git commit -m "Initial commit: LinkedIn profile builder"

# Create GitHub repo (using gh CLI; install with 'brew install gh' if needed)
gh repo create ursa-mobile/ursa-linkedin-profiles --private --source=. --remote=origin --push
```

If `gh` is not authenticated, run `gh auth login` first. If the `ursa-mobile` org doesn't exist or you don't have access, use Ramesh's personal account: `gh repo create ursa-linkedin-profiles --private --source=. --remote=origin --push`.

### Step 2: Deploy to Vercel

```bash
# Install Vercel CLI globally if not present
npm i -g vercel

# Log in (opens browser)
vercel login

# Link & deploy
vercel
```

Follow the prompts:
- **Set up and deploy?** Yes
- **Which scope?** Select Ramesh's team/account
- **Link to existing project?** No
- **Project name?** `ursa-linkedin-profiles`
- **In which directory is your code located?** `./`
- **Override settings?** No

This creates a preview deployment at something like `ursa-linkedin-profiles-abc123.vercel.app`. Don't share this URL yet — it has no API key.

### Step 3: Add the Anthropic API key

```bash
# Add the env var for all environments (production, preview, development)
vercel env add ANTHROPIC_API_KEY

# When prompted, paste the sk-ant-... key
# Select: Production, Preview, Development (all three with space, then Enter)
```

Then redeploy so the env var is picked up:

```bash
vercel --prod
```

The production URL will print at the end — typically `ursa-linkedin-profiles.vercel.app`.

### Step 4: Add custom domain `linkedin.ursamobile.com`

```bash
vercel domains add linkedin.ursamobile.com
```

Vercel will print DNS instructions. You need to add a CNAME record at the DNS provider for `ursamobile.com`:

```
Type:  CNAME
Name:  linkedin
Value: cname.vercel-dns.com
```

If DNS for `ursamobile.com` is already managed in Vercel (likely, given the platform deployment): the domain will verify automatically within a minute. If it's elsewhere (Cloudflare, Route53, GoDaddy), add the CNAME there.

Verify with:
```bash
vercel domains inspect linkedin.ursamobile.com
```

When status shows "Valid Configuration", the domain is live with auto-issued SSL.

### Step 5: Test end-to-end

1. Open `https://linkedin.ursamobile.com` in a browser
2. Paste this sample resume text (or upload a real one):
   ```
   Jordan Martinez
   Senior Software Engineer | Washington, DC

   Experience:
   Senior Software Engineer @ Acme Corp (2021-Present)
   - Led migration to microservices, cut deploy time 60%
   - Built auth platform serving 50k users
   - Reduced AWS costs 35%

   Skills: React, Node.js, AWS, TypeScript, Docker, Kubernetes
   Education: BS Computer Science, Virginia Tech 2016
   ```
3. Click "Continue" → keep default brand settings → "Generate"
4. Confirm: headline, About, bullets, skills, and connection note all appear
5. Click "Copy complete profile" — check clipboard has the full output

If generation fails:
- Open browser console (F12) — look for the `/api/generate` request and its response
- Check `vercel logs ursa-linkedin-profiles --since=10m` for server-side errors
- Most common issue: env var not set in production. Run `vercel env ls` to confirm `ANTHROPIC_API_KEY` is present in Production.

### Step 6 (optional): Lock down access

This tool is internal — Ursa employees only. Two options:

**Option A — Vercel Password Protection (Pro plan, ~$20/mo):**
Project Settings → Deployment Protection → Password Protection → Set a shared password. Ramesh distributes it to the team.

**Option B — Cloudflare Access (free, more flexible):**
- Put Cloudflare in front of the Vercel deployment
- Configure a Zero Trust Access policy allowing only `@ursamobile.com` emails
- Documentation: https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/

Pick A if you want it done in 5 minutes. Pick B if Ramesh wants single sign-on with company email.

---

## Post-deployment checklist

- [ ] `https://linkedin.ursamobile.com` loads
- [ ] Resume upload works (PDF + paste both)
- [ ] Generation completes successfully (under 15 seconds)
- [ ] All sections populate (headline, About, bullets, skills, connection note)
- [ ] Copy buttons work
- [ ] `ANTHROPIC_API_KEY` is set in Vercel Production env vars
- [ ] Access control is in place (or Ramesh has explicitly waived it)
- [ ] Share the URL + brief usage instructions with the Ursa team

---

## Architecture diagram (for context)

```
Browser (public/index.html)
    │
    │ POST /api/generate
    │ { prompt, company, mission, keywords, tone }
    ▼
Vercel Edge Function (api/generate.js)
    │
    │ + injects ANTHROPIC_API_KEY (from env var)
    │
    ▼
Anthropic API
    │
    │ returns JSON LinkedIn profile
    ▼
Edge Function (passes through)
    │
    ▼
Browser (renders preview + copy buttons)
```

**Why this design:**
- No build step needed — pure static + one edge function
- API key never reaches the client
- CORS is handled by serving everything from the same origin
- Stateless — no database, no auth, no session

---

## Future enhancements (in priority order)

If Ramesh asks for more features, here's the suggested order:

1. **Multi-employee dashboard** — store generated profiles in Vercel KV or Supabase, let admin view all team profiles in one place
2. **Brand template library** — preset brand configs (Ursa Mobile, WAYPOINT-CG client, etc.) employees can pick from
3. **Headshot guidance** — generate a brand-aligned headshot prompt for image generators
4. **LinkedIn banner generator** — auto-generate matching banner images
5. **Quarterly refresh reminder** — email cron job to remind employees to update profiles
6. **OAuth + direct profile sync** — requires LinkedIn API partner approval (not trivial — see notes in code comments)

---

## Common issues & fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| 500 error on `/api/generate` | Missing or wrong API key | `vercel env ls`, confirm `ANTHROPIC_API_KEY` is set in Production. Redeploy: `vercel --prod` |
| "Generation failed" in UI | Network/CORS issue | Check browser console; confirm `vercel.json` routes are correct |
| PDF upload extracts garbage | Scanned PDF (image-based) | Tell user to use Word/text version, or paste text directly |
| Custom domain not resolving | DNS not propagated | Wait 5 min; verify with `dig linkedin.ursamobile.com CNAME` |
| Edge function timeout | Anthropic API slow | Default Vercel timeout is 10s on Hobby; upgrade to Pro for 60s, or switch to `runtime: 'nodejs'` in `api/generate.js` |

---

## Hand-back to Ramesh

When complete, send Ramesh:
1. The production URL: `https://linkedin.ursamobile.com`
2. The GitHub repo URL
3. Confirmation that env vars are set and access control is in place
4. The sample resume test result so he can verify quality

That's it. The full deployment should take ~15 minutes if all credentials are ready.

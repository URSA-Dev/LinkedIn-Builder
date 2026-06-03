# Chat-to-Tweak Feature — Design

Date: 2026-06-03
Status: Approved (backend + approach), UI defaults accepted

## Goal
Let users refine a generated LinkedIn profile after generation, two ways:
1. **Conversational chat panel** — broad/multi-section changes AND advice (Claude decides edit vs reply per message).
2. **Per-section Tweak buttons** — targeted edits to a single section.

## Backend — `api/tweak.js`
Node serverless function (same runtime/pattern/key as `generate.js`).

**Request**
```json
{
  "profile": { ...current generatedProfile... },
  "message": "make the headline punchier",
  "history": [ {"role":"user","text":"..."}, {"role":"assistant","text":"..."} ],
  "targetSection": "headline"
}
```
`targetSection` optional; set only by per-section buttons.

**Response (validated JSON)**
```json
{
  "action": "edit",
  "reply": "Punched up the headline — leads with impact now.",
  "changes": { "headline": "..." }
}
```
- `action:"reply"` for questions/advice → `changes:{}`, profile unchanged.
- `action:"edit"` → `changes` holds ONLY changed fields (keys match profile schema).
- `targetSection` set → only that key may appear in `changes`.
- Model `claude-sonnet-4-6`, max_tokens ~1500. Same-origin only (no CORS wildcard).

**Allowed change keys:** name, title, location, headline, headline_alt, about,
experience_bullets, skills_featured, connection_note.

## Frontend — `public/index.html` (single file)
- **Chat panel** in the right column of step 4 (below the LinkedIn preview + skills);
  stacks below on mobile via existing `.output-grid` media query.
  Transcript (user/assistant bubbles) + input + Send. Keeps `chatHistory` array
  (last ~6 turns sent). On `edit`, `Object.assign(generatedProfile, changes)` →
  `renderOutput()` → flash changed sections.
- **Per-section Tweak buttons** beside each Copy button (headline, About, bullets,
  connect, alt) + a Tweak control for skills. Click → inline one-line input →
  same `/api/tweak` call with `targetSection` → merge that field → re-render → flash.
  The exchange is echoed into the chat transcript (one shared history).
- **Reuse** existing `renderOutput()` (no parallel render path). Add `flashSection(id)`
  highlight; skills updates already XSS-safe via `renderPills()`.
- Styling uses existing design tokens; no new dependencies.

## Field → element map (for re-render + flash)
- headline → out-headline, prev-hl
- headline_alt → out-alt
- about → out-about, prev-about
- experience_bullets → out-bullets
- connection_note → out-connect
- skills_featured → out-skills, prev-skills
- name/location → prev-name/prev-meta

## Error handling
- Network/API failure → assistant bubble with a short error, profile untouched.
- Non-JSON / invalid response → caught, shown as "Couldn't apply that — try rephrasing."
- Empty `changes` on an `edit` → treated as reply.

## Testing
- `/api/tweak` edit path (returns changed field only).
- `/api/tweak` advice path (action=reply, no changes).
- `/api/tweak` targetSection path (constrained to one key).
- End-to-end on production after deploy.

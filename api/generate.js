// Node.js serverless function (Vercel). Reliably exposes process.env at runtime.
// Same-origin only: the frontend is served from this same deployment, so no
// cross-origin CORS headers are emitted. This keeps the credentialed
// (API-key-bearing) proxy from being usable by other sites.
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'API key not configured' });
    return;
  }

  // Vercel auto-parses JSON bodies, but fall back to manual parsing just in case.
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }
  }
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const { prompt, company, mission, keywords, tone } = body;

  if (!prompt || prompt.length < 50) {
    res.status(400).json({ error: 'Resume content too short' });
    return;
  }

  const systemPrompt = `You are a world-class LinkedIn profile writer and personal branding expert for ${company || 'a startup'}. Your job is to read resumes and produce highly optimized, brand-aligned LinkedIn profiles. Always return valid JSON only — no markdown, no backticks, no preamble.`;

  const userPrompt = `Read the resume below and generate a complete, optimized LinkedIn profile.

Return ONLY a valid JSON object with this exact structure:
{
  "name": "full name from resume",
  "title": "current or most recent job title",
  "location": "location if found in resume",
  "headline": "max 220 chars, SEO-optimized, use · or | separators",
  "headline_alt": "alternative headline variation",
  "about": "3-4 paragraphs, first-person, ${tone || 'professional'} tone, starts with a hook, ends with CTA, ~220 words",
  "experience_bullets": ["5 bullets for most recent role, power verbs + metrics"],
  "skills_featured": ["10 prioritized skills from resume"],
  "connection_note": "personalized connection request, max 280 chars",
  "score": 0-100,
  "score_rationale": "one sentence",
  "quick_wins": ["3 specific improvements beyond the resume content"]
}

Company: ${company || 'not specified'}
Mission: ${mission || 'not specified'}
Keywords to include: ${keywords || 'professional growth, innovation'}
Tone: ${tone || 'Professional & authoritative'}

Resume:
---
${prompt.slice(0, 6000)}
---

Return ONLY the JSON object.`;

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      res.status(502).json({ error: 'Anthropic API error', detail: err });
      return;
    }

    const data = await anthropicRes.json();
    const raw = data.content?.find(b => b.type === 'text')?.text || '{}';
    const clean = raw.replace(/```json|```/g, '').trim();

    // Validate it's parseable JSON before returning.
    const parsed = JSON.parse(clean);

    res.status(200).json(parsed);
  } catch (e) {
    res.status(500).json({ error: 'Generation failed', detail: e.message });
  }
}

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { prompt, company, mission, keywords, tone } = body;

  if (!prompt || prompt.length < 50) {
    return new Response(JSON.stringify({ error: 'Resume content too short' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
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
      return new Response(JSON.stringify({ error: 'Anthropic API error', detail: err }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await anthropicRes.json();
    const raw = data.content?.find(b => b.type === 'text')?.text || '{}';
    const clean = raw.replace(/```json|```/g, '').trim();

    // Validate it's parseable JSON before returning
    JSON.parse(clean);

    return new Response(clean, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Generation failed', detail: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

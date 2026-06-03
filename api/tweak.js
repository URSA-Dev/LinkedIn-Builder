// Node.js serverless function (Vercel). Refines an existing LinkedIn profile via
// chat: either EDITS the profile (returns only changed fields) or REPLIES with
// advice. Same-origin only — no cross-origin CORS headers on this credentialed proxy.
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

  const { profile, message, history, targetSection } = body;

  if (!profile || typeof profile !== 'object') {
    res.status(400).json({ error: 'Missing current profile' });
    return;
  }
  if (!message || typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: 'Empty message' });
    return;
  }

  const EDITABLE = [
    'name', 'title', 'location', 'headline', 'headline_alt',
    'about', 'experience_bullets', 'skills_featured', 'connection_note',
  ];

  const sectionRule = (targetSection && EDITABLE.includes(targetSection))
    ? `The user is editing ONE section only: "${targetSection}". If this is an edit, "changes" may contain ONLY the "${targetSection}" key.`
    : 'If this is an edit, include in "changes" ONLY the fields that actually change.';

  // Compact recent conversation for context (advice + pronoun resolution).
  const turns = Array.isArray(history) ? history.slice(-6) : [];
  const historyText = turns.length
    ? turns.map(t => `${t.role === 'assistant' ? 'Assistant' : 'User'}: ${String(t.text || '').slice(0, 600)}`).join('\n')
    : '(none)';

  const systemPrompt = `You are an expert LinkedIn profile editor and personal-branding coach. You help the user refine an EXISTING LinkedIn profile through conversation. On each message you do exactly one of:
- EDIT: apply the requested change to the profile, OR
- REPLY: answer a question / give advice without changing the profile.
Always return valid JSON only — no markdown, no backticks, no preamble.`;

  const userPrompt = `Here is the user's current LinkedIn profile as JSON:
${JSON.stringify(profile, null, 2)}

Recent conversation:
${historyText}

New message from the user:
"${message.slice(0, 2000)}"

Decide whether this message asks you to CHANGE the profile (an edit) or just asks a question / wants advice (a reply).

${sectionRule}

Editable fields and their types:
- name (string), title (string), location (string)
- headline (string, max ~220 chars), headline_alt (string)
- about (string, first-person)
- experience_bullets (array of strings)
- skills_featured (array of strings)
- connection_note (string, max ~280 chars)

Return ONLY a valid JSON object with this exact shape:
{
  "action": "edit" | "reply",
  "reply": "one or two short sentences describing what you changed, or your advice",
  "changes": { }
}

Rules:
- For an edit: action="edit", and "changes" contains ONLY the changed fields with their full new values (full new array for list fields). Keep every other field unchanged by omitting it.
- For advice/questions: action="reply", "changes" is an empty object {}.
- Never invent facts not supported by the existing profile; refine wording, structure, emphasis, and keywords.
- "reply" is always present and human-friendly.

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
        model: 'claude-sonnet-4-6',
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

    const parsed = JSON.parse(clean);

    // Normalize + guard the response shape.
    const out = {
      action: parsed.action === 'edit' ? 'edit' : 'reply',
      reply: typeof parsed.reply === 'string' ? parsed.reply : '',
      changes: {},
    };

    if (out.action === 'edit' && parsed.changes && typeof parsed.changes === 'object') {
      for (const [k, v] of Object.entries(parsed.changes)) {
        if (!EDITABLE.includes(k)) continue;
        if (targetSection && EDITABLE.includes(targetSection) && k !== targetSection) continue;
        out.changes[k] = v;
      }
    }

    // An "edit" that changed nothing is really a reply.
    if (out.action === 'edit' && Object.keys(out.changes).length === 0) {
      out.action = 'reply';
    }

    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: 'Tweak failed', detail: e.message });
  }
}

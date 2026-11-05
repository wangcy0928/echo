// Echo — vision proxy. The browser sends 1–2 JPEG data URLs; this calls DeepSeek and returns one short sentence.
// GET /api/vision  → {"ok":true} when the key is set (quick health check)

const PROMPTS = {
  point:
    'You help a blind person who is pointing at something with one finger. ' +
    'Image 1 is a close crop of the spot they are pointing at. Image 2 is their whole view, with that spot outlined in yellow. ' +
    'In ONE short sentence (max 15 words) say what the object is and roughly how far it is (e.g. "arm\'s length", "2 steps", "across the room"). ' +
    'Mention colour or text on it only if useful. Never mention the hand, finger, outline or images.',
  ask:
    'You are the eyes of a blind person walking. The image is what is in front of them right now (phone camera at chest height). ' +
    'Answer their question in at most 2 short sentences. Say what is ahead, then the next move: go straight, turn left, turn right, or stop. ' +
    'Give distances in steps. Mention obstacles, steps/stairs, doors and people if present. Never mention the image or camera.'
};

module.exports = async (req, res) => {
  const key = process.env.DEEPSEEK_API_KEY;
  if (req.method === 'GET') return res.status(200).json({ ok: !!key });
  if (!key) return res.status(500).json({ error: 'DEEPSEEK_API_KEY is not set' });

  try {
    const { mode = 'point', images = [], question = '' } = req.body || {};
    if (!images.length) return res.status(400).json({ error: 'no image' });

    const content = [{ type: 'text', text: PROMPTS[mode] + (question ? `\n\nTheir question: "${question}"` : '') }];
    for (const url of images.slice(0, 2)) content.push({ type: 'image_url', image_url: { url } });

    const r = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || 'deepseek-flash',
        messages: [{ role: 'user', content }],          // images must be in a user message
        max_tokens: 120,
        temperature: 0.3,
        thinking: { type: 'disabled' }
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data.error?.message || `DeepSeek ${r.status}` });
    const text = (data.choices?.[0]?.message?.content || '').trim();
    return res.status(200).json({ text: text || 'I could not tell.' });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};

// api/chat.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ text: '' }); return; }

  const { system = '', messages = [], maxTokens = 1000 } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ text: '' });
    return;
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) { res.status(500).json({ text: '' }); return; }

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  if (system) {
    contents.unshift({ role: 'user', parts: [{ text: `[SYSTEM]:\n${system}` }] });
    contents.splice(1, 0, { role: 'model', parts: [{ text: 'Understood.' }] });
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.85 },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT',       threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        }),
        signal: AbortSignal.timeout(25000),
      }
    );

    const data = await geminiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.status(200).json({ text });
  } catch (err) {
    console.error('[chat] Gemini error:', err.message);
    res.status(200).json({ text: '' });
  }
}

// api/chat.js
// Unified AI router: Claude (primary) → Gemini (fallback)
// All keys are environment variables — never exposed to frontend

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ── Claude call ──────────────────────────────────────────────────────────────
async function callClaude({ system, messages, maxTokens }) {
  const key = process.env.CLAUDE_API_KEY;
  if (!key) throw new Error('CLAUDE_API_KEY not set');

  const body = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens || 1000,
    messages,
  };
  if (system) body.system = system;

  const res = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000), // 25s — under Vercel's 30s limit
  });

  // Treat rate-limit / quota / overload as fallback-eligible
  if (res.status === 429 || res.status === 529 || res.status === 402) {
    throw new Error(`claude_quota:${res.status}`);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`claude_error:${res.status}:${err}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(`claude_api_error:${data.error.type}`);

  return {
    text: data.content.map(b => b.text || '').join(''),
    engine: 'claude',
  };
}

// ── Gemini call ──────────────────────────────────────────────────────────────
async function callGemini({ system, messages, maxTokens }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');

  // Convert Anthropic message format → Gemini contents format
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  // Inject system prompt as a synthetic opening exchange
  if (system) {
    contents.unshift({
      role: 'user',
      parts: [{ text: `[SYSTEM INSTRUCTIONS — follow for entire conversation]:\n${system}` }],
    });
    contents.splice(1, 0, {
      role: 'model',
      parts: [{ text: 'Understood. I will follow these instructions completely.' }],
    });
  }

  const res = await fetch(`${GEMINI_API_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens || 1000,
        temperature: 0.85,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',        threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',  threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT',  threshold: 'BLOCK_NONE' },
      ],
    }),
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`gemini_error:${res.status}:${err}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(`gemini_api_error:${data.error.message}`);

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return { text, engine: 'gemini' };
}

// ── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  setCORSHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { system = '', messages = [], maxTokens = 1000 } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages array is required and must not be empty' });
    return;
  }

  let claudeError = null;

  // 1. Try Claude
  try {
    const result = await callClaude({ system, messages, maxTokens });
    res.status(200).json({ text: result.text, engine: result.engine });
    return;
  } catch (err) {
    claudeError = err.message;
    console.warn('[AEON] Claude failed, switching to Gemini fallback:', claudeError);
  }

  // 2. Fallback to Gemini
  try {
    const result = await callGemini({ system, messages, maxTokens });
    res.status(200).json({
      text: result.text,
      engine: result.engine,
      fallback: true,
      claudeError,
    });
    return;
  } catch (err) {
    console.error('[AEON] Both Claude and Gemini failed:', err.message);
    // Never crash the frontend — return a safe response
    res.status(200).json({
      text: '',
      engine: 'none',
      error: true,
      claudeError,
      geminiError: err.message,
    });
  }
}

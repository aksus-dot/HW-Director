// HW Director local server: Gemini 3.8 Flash edition. Needs Node 18+ (no npm install).
// 1) Get a key at https://aistudio.google.com  ("Get API key")
// 2) Create a file named .env next to this file:   GEMINI_API_KEY=your-key-here
// 3) Run:  node server.js      4) Open:  http://localhost:3000
const http = require('http'), fs = require('fs'), path = require('path');

try { // minimal .env loader
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(\w+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const PORT = process.env.PORT || 3000;
const PAGE = path.join(__dirname, 'Direct_Homework_Generator.html');
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const THINKING = process.env.GEMINI_THINKING || 'low'; // low | medium | high
const API_BASE = process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com';
const RETRY_DELAYS = process.env.GEMINI_NO_RETRY ? [] : [1500, 3500]; // retry busy (503) / rate-limited (429) calls

const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const fail = (res, code, message) => send(res, code, { error: { message } });
const sleep = ms => new Promise(r => setTimeout(r, ms));

// The page sends Anthropic-style content blocks; convert them to Gemini parts.
function toGeminiParts(content) {
  if (typeof content === 'string') return [{ text: content }];
  return (content || []).map(b => {
    if (b.type === 'text') return { text: b.text };
    if ((b.type === 'image' || b.type === 'document') && b.source?.data) {
      return { inlineData: { mimeType: b.source.media_type, data: b.source.data } };
    }
    return null;
  }).filter(Boolean);
}

async function callGemini(payload, key) {
  let r, data;
  for (let attempt = 0; ; attempt++) {
    r = await fetch(`${API_BASE}/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(payload)
    });
    data = await r.json().catch(() => ({}));
    if ((r.status === 503 || r.status === 429) && attempt < RETRY_DELAYS.length) { await sleep(RETRY_DELAYS[attempt]); continue; }
    return { r, data };
  }
}

http.createServer(async (req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(PAGE));
  }

  if (req.method === 'POST' && req.url === '/api/claude') { // path kept so the page needs no change
    const key = process.env.GEMINI_API_KEY;
    if (!key) return fail(res, 500, 'GEMINI_API_KEY is missing. Add it to a .env file and restart the server.');

    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > 30e6) return fail(res, 413, 'File too large'); }
    let body;
    try { body = JSON.parse(raw); } catch { return fail(res, 400, 'Bad request'); }

    // maxOutputTokens also covers the model's thinking, so leave headroom above the answer length.
    const wanted = Number(body.max_tokens) || 3500;
    const payload = {
      contents: (body.messages || []).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: toGeminiParts(m.content)
      })),
      generationConfig: {
        maxOutputTokens: Math.min(wanted + 4096, 65536),
        thinkingConfig: { thinkingLevel: THINKING }
      }
    };
    if (body.system) payload.systemInstruction = { parts: [{ text: body.system }] };
    const useSearch = !!body.search; // Google Search grounding (research mode)
    if (body.json) payload.generationConfig.responseMimeType = 'application/json';
    if (useSearch) payload.tools = [{ google_search: {} }];

    try {
      let { r, data } = await callGemini(payload, key);
      let note = '';
      if (!r.ok && useSearch && r.status !== 429 && r.status !== 503) { // search tool refused: retry without it
        delete payload.tools;
        ({ r, data } = await callGemini(payload, key));
        note = '*Live web search was unavailable, so this report is written from the AI\'s own knowledge. Please verify the facts.*\n\n';
      }
      if (!r.ok) {
        let msg = data?.error?.message || `Gemini request failed (${r.status})`;
        if (r.status === 429) msg = 'Free-tier limit reached. Wait a minute and try again. (' + msg + ')';
        if (r.status === 503) msg = 'Gemini is busy right now. Please try again in a moment.';
        return fail(res, r.status, msg);
      }
      if (data.promptFeedback?.blockReason) return fail(res, 400, 'The request was blocked by Gemini (' + data.promptFeedback.blockReason + ')');
      const cand = data.candidates?.[0];
      let text = (cand?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('');
      const links = [], seen = new Set();
      for (const c of cand?.groundingMetadata?.groundingChunks || []) {
        const u = c.web?.uri;
        if (u && !seen.has(u)) { seen.add(u); links.push(`- [${(c.web.title || u).replace(/[\[\]]/g, '')}](${u})`); }
      }
      if (!text.trim()) return fail(res, 502, 'Gemini returned an empty response' + (cand?.finishReason ? ' (' + cand.finishReason + ')' : ''));
      if (!body.json) text = note + text + (links.length ? '\n\n## Sources\n' + links.slice(0, 10).join('\n') : '');
      return send(res, 200, { content: [{ type: 'text', text }] }); // shape the page already understands
    } catch (e) {
      return fail(res, 502, 'Could not reach Gemini: ' + e.message);
    }
  }

  res.writeHead(404); res.end('Not found');
}).listen(PORT, () => console.log(`HW Director (${MODEL}) running at http://localhost:${PORT}`));
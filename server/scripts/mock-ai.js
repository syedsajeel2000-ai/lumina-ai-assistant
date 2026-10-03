/**
 * DEV/TEST FIXTURE — not part of the application runtime.
 *
 * A tiny OpenAI-compatible mock AI server (SSE streaming + non-streaming).
 * Use it to exercise the full chat pipeline without a real provider key:
 *
 *   node server/scripts/mock-ai.js            # listens on :3099
 *   # then in .env:
 *   # AI_API_URL=http://localhost:3099/v1
 *   # AI_API_KEY=test
 *   # AI_MODEL=mock-model
 *
 * Useful for integration tests and offline demos of the plumbing.
 */
import http from 'node:http';

const PORT = Number(process.env.MOCK_AI_PORT || 3099);

const REPLIES = [
  'Here is a draft you can use:\n\n**Subject:** Meeting request\n\nHi [Name],\n\nI hope you are doing well. I would like to request a short meeting to discuss [topic]. Would sometime this week work for you?\n\nBest regards,\n[Your name]',
  'Sure! Here is a JavaScript example:\n\n```javascript\nfunction debounce(fn, delay = 300) {\n  let t;\n  return (...args) => {\n    clearTimeout(t);\n    t = setTimeout(() => fn(...args), delay);\n  };\n}\n```\n\nThis delays the call until the user stops triggering events.',
  'React is a JavaScript library for building user interfaces with components. For a 10-year-old: imagine building with LEGO bricks — each component is a brick you can reuse to build big apps!'
];

let n = 0;

function pickReply(messages) {
  const sys = messages.find((m) => m.role === 'system')?.content || '';
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
  // Title-generation calls carry a system prompt mentioning "title".
  if (/title/i.test(sys)) {
    return lastUser.replace(/\s+/g, ' ').trim().split(' ').slice(0, 5).join(' ') || 'New chat';
  }
  if (/10-year-old|child|simple terms/i.test(lastUser)) return REPLIES[2];
  if (/code|javascript|python|function|debug/i.test(lastUser)) return REPLIES[1];
  return REPLIES[0];
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || !req.url.includes('/chat/completions')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: { message: 'not found' } }));
  }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    let parsed = {};
    try { parsed = JSON.parse(body); } catch { /* ignore */ }
    const stream = Boolean(parsed.stream);
    const reply = pickReply(parsed.messages || []);

    console.log(`[mock-ai] ${stream ? 'stream' : 'complete'} · ${parsed.messages?.length ?? 0} messages · model=${parsed.model}`);
    for (const m of parsed.messages || []) {
      console.log(`[mock-ai]   (${m.role}) ${String(m.content).slice(0, 80).replace(/\n/g, ' ')}`);
    }

    if (!stream) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: reply } }] }));
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });
    // Stream the reply in word chunks, like a real provider.
    const words = reply.split(/(\s+)/);
    let i = 0;
    const timer = setInterval(() => {
      if (i >= words.length) {
        clearInterval(timer);
        res.write('data: [DONE]\n\n');
        return res.end();
      }
      const chunk = words[i++] || '';
      const payload = { choices: [{ delta: { content: chunk } }] };
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }, 18);
    // Only stop on a premature client disconnect (res 'close' + not finished).
    res.on('close', () => {
      if (!res.writableEnded) clearInterval(timer);
    });
  });
});

server.listen(PORT, () => console.log(`[mock-ai] fixture listening on http://localhost:${PORT}/v1`));

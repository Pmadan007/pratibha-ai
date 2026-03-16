// server.js — WebSocket proxy: browser ↔ this server ↔ Vertex AI Live API
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleAuth } from 'google-auth-library';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, 'dist');
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.json':'application/json' };

const PROJECT = 'ai-tutor-40345';
const LOCATION = 'us-central1';
const MODEL = 'gemini-live-2.5-flash-native-audio';
const VERTEX_WS = `wss://${LOCATION}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

const auth = new GoogleAuth({
  keyFile: './service-account.json',
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

async function firestoreWrite(collection, docId, fields) {
  const token = await auth.getAccessToken();
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { stringValue: String(v) }])) };
  const mask = Object.keys(fields).map(k => `updateMask.fieldPaths=${k}`).join('&');
  const res = await fetch(`${FIRESTORE_BASE}/${collection}/${docId}?${mask}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function firestoreRead(collection, docId) {
  const token = await auth.getAccessToken();
  const res = await fetch(`${FIRESTORE_BASE}/${collection}/${docId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (data.error) return null;
  return Object.fromEntries(Object.entries(data.fields ?? {}).map(([k, v]) => [k, v.stringValue ?? v.integerValue ?? '']));
}

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'POST' && url.pathname === '/api/profile') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', async () => {
      try {
        const { userId, ...fields } = JSON.parse(body);
        await firestoreWrite('students', userId, fields);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/profile') {
    const userId = url.searchParams.get('userId');
    const profile = await firestoreRead('students', userId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(profile));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/generate-image') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', async () => {
      try {
        const { prompt } = JSON.parse(body);
        const token = await auth.getAccessToken();
        const apiRes = await fetch(
          `https://us-central1-aiplatform.googleapis.com/v1/projects/ai-tutor-40345/locations/us-central1/publishers/google/models/gemini-2.5-flash-image:generateContent`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
            }),
          }
        );
        const data = await apiRes.json();
        const parts = data.candidates?.[0]?.content?.parts ?? [];
        const image = parts.find(p => p.inlineData)?.inlineData?.data ?? null;
        res.writeHead(image ? 200 : 500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(image ? { image } : { error: 'No image returned' }));
      } catch (e) {
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Serve static files from dist/
  if (req.method === 'GET') {
    let filePath = join(DIST, url.pathname === '/' ? 'index.html' : url.pathname);
    if (!existsSync(filePath)) filePath = join(DIST, 'index.html');
    try {
      const data = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' });
      res.end(data);
      return;
    } catch { /* fall through */ }
  }

  res.writeHead(404); res.end();
});

const wss = new WebSocketServer({ server });

wss.on('connection', async (clientWs) => {
  const token = await auth.getAccessToken();

  const vertexWs = new WebSocket(VERTEX_WS, {
    headers: { Authorization: `Bearer ${token}` },
  });

  vertexWs.on('open', () => console.log('[proxy] connected to Vertex'));
  vertexWs.on('message', (data) => clientWs.readyState === 1 && clientWs.send(data));
  vertexWs.on('close', (code, reason) => clientWs.close(code, reason));
  vertexWs.on('error', (e) => console.error('[vertex error]', e.message));

  clientWs.on('message', (data) => vertexWs.readyState === 1 && vertexWs.send(data));
  clientWs.on('close', () => vertexWs.close());
  clientWs.on('error', (e) => console.error('[client error]', e.message));
});

server.listen(3001, () => console.log('[proxy] listening on :3001'));

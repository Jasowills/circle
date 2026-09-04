/* E2E WebSocket test: two sessions, one circle.
 * B (ada) listens in the room. A (james) contributes over REST.
 * Pass = B receives contribution.created with the exact entry id + amount,
 * and B's circle balance moves. Run: node ws-e2e.mjs
 */
import { io } from 'socket.io-client';
import { randomUUID } from 'crypto';

const BASE = 'http://localhost:3000';
const fail = (m) => { console.error('FAIL:', m); process.exit(1); };
const ok = (m) => console.log('ok:', m);

async function devLogin(email, password) {
  const body = password ? { email, password } : { email };
  const path = password ? '/auth/login' : '/auth/dev-login';
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r.ok) fail(`${path} ${email} -> ${r.status}`);
  return (await r.json()).accessToken;
}

function joinRoom(circleId, token) {
  return new Promise((resolve, reject) => {
    const s = io(BASE, { transports: ['websocket'] });
    const t = setTimeout(() => { s.close(); reject(new Error('join timeout')); }, 8000);
    s.on('connect', () => s.emit('join', { circleId, token }));
    s.on('joined', () => { clearTimeout(t); resolve(s); });
    s.on('error', (e) => { clearTimeout(t); s.close(); reject(new Error('join error: ' + JSON.stringify(e))); });
  });
}

const tokenA = await devLogin('james@circle.com', '12345678');
const tokenB = await devLogin('ada@circle.com');
ok('both sessions logged in (james + ada)');

const circles = await (await fetch(`${BASE}/circles`, { headers: { Authorization: `Bearer ${tokenA}` } })).json();
const circle = circles.find((c) => c.name.includes('Demo Day'));
if (!circle) fail('Demo Day circle not found for james');
const before = Number(circle.balance);
ok(`shared circle: ${circle.name} (balance ${before})`);

const sockA = await joinRoom(circle.id, tokenA);
const sockB = await joinRoom(circle.id, tokenB);
ok('both sessions joined the room');

const evt = new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('event timeout (8s) — no live update received')), 8000);
  sockB.on('contribution.created', (p) => { clearTimeout(t); resolve(p); });
});

const amount = 50000;
const key = randomUUID();
const t0 = Date.now();
const res = await fetch(`${BASE}/circles/${circle.id}/contribute`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ amount, idempotencyKey: key }),
});
if (res.status !== 200) fail(`contribute -> ${res.status} ${(await res.text()).slice(0, 120)}`);
const created = await res.json();
ok(`james contributed ${amount} (replayed=${created.replayed})`);

const p = await evt;
const dt = Date.now() - t0;
if (p.amount !== String(amount)) fail(`event amount ${p.amount} != ${amount}`);
if (p.entryId !== created.entry.id) fail('event entryId does not match the created entry');
if (p.userId !== created.entry.userId) fail('event userId mismatch');
ok(`ada received contribution.created in ${dt}ms (entry + amount match)`);

const after = await (await fetch(`${BASE}/circles/${circle.id}`, { headers: { Authorization: `Bearer ${tokenB}` } })).json();
if (Number(after.balance) !== before + amount) fail(`ada sees balance ${after.balance}, expected ${before + amount}`);
ok(`ada's read model moved ${before} -> ${after.balance}`);

sockA.close();
sockB.close();
console.log('PASS: two-session live update end to end');
process.exit(0);

import assert from 'node:assert/strict';
import test from 'node:test';
import { TokenVerifier } from 'livekit-server-sdk';

process.env.LIVEKIT_API_KEY = 'test-key';
process.env.LIVEKIT_API_SECRET = 'offline-test-secret-at-least-32-characters';
const tokenRoute = await import('../src/app/api/livekit/token/route.ts');
const conciergeRoute = await import('../src/app/api/concierge/route.ts');
const verifier = new TokenVerifier(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);

function request(body) {
  return new Request('http://localhost/api/test', { method: 'POST', body });
}

test('matching display names receive different identities with valid room grants', async () => {
  const first = await tokenRoute.POST(request(JSON.stringify({ name: ' Jon ' })));
  const second = await tokenRoute.POST(request(JSON.stringify({ name: 'Jon' })));
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  const a = await first.json();
  const b = await second.json();
  assert.notEqual(a.identity, b.identity);
  assert.equal(a.room, b.room);
  const claims = await verifier.verify(a.token);
  assert.equal(claims.sub, a.identity);
  assert.equal(claims.name, 'Jon');
  assert.equal(claims.video.room, a.room);
  assert.equal(claims.video.roomJoin, true);
  const remaining = claims.exp - Math.floor(Date.now() / 1000);
  assert.ok(remaining > 0 && remaining <= 600);
});

test('omitted names remain usable as guest sessions', async () => {
  const response = await tokenRoute.POST(request('{}'));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).displayName, 'Guest');
});

for (const body of ['null', '[]', '42', '"text"', '{']) {
  test(`both endpoints reject invalid object bodies: ${body}`, async () => {
    assert.equal((await tokenRoute.POST(request(body))).status, 400);
    assert.equal((await conciergeRoute.POST(request(body))).status, 400);
  });
}

test('token endpoint rejects invalid and oversized names', async () => {
  for (const name of [42, null, 'x'.repeat(81)]) {
    assert.equal((await tokenRoute.POST(request(JSON.stringify({ name })))).status, 400);
  }
});

test('concierge rejects empty, invalid and oversized messages before calling providers', async () => {
  for (const message of ['', '  ', null, 42, 'x'.repeat(2001)]) {
    assert.equal((await conciergeRoute.POST(request(JSON.stringify({ message })))).status, 400);
  }
});

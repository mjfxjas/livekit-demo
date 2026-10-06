import { AccessToken } from 'livekit-server-sdk';
import { randomUUID } from 'crypto';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_ROOM_PREFIX = process.env.LIVEKIT_ROOM_PREFIX || 'livekit-demo';

export async function POST(request: Request) {
  try {
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return Response.json(
        { error: 'Missing LiveKit server credentials in environment.' },
        { status: 500 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'A JSON object is required.' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ error: 'A JSON object is required.' }, { status: 400 });
    }
    const name = (body as { name?: unknown }).name;
    if (name !== undefined && (typeof name !== 'string' || name.length > 80)) {
      return Response.json({ error: 'Name must be a string of at most 80 characters.' }, { status: 400 });
    }
    const displayName = (typeof name === 'string' ? name.trim() : '') || 'Guest';
    // A display name is not unique: sharing an identity evicts the first session.
    const identity = `guest-${randomUUID()}`;
    const room = `${LIVEKIT_ROOM_PREFIX}-${new Date().toISOString().slice(0, 10)}`;

    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      ttl: '10m',
      name: displayName,
    });

    token.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });

    return Response.json({
      token: await token.toJwt(),
      room,
      identity,
      displayName,
      url: process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL || '',
    });
  } catch (error) {
    console.error('livekit token route error', error);
    return Response.json({ error: 'Failed to create session token.' }, { status: 500 });
  }
}

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

    const body = await request.json().catch(() => ({}));
    const requestedName = typeof body.name === 'string' ? body.name.trim() : '';
    const identity = requestedName || `guest-${randomUUID().slice(0, 8)}`;
    const room = `${LIVEKIT_ROOM_PREFIX}-${new Date().toISOString().slice(0, 10)}`;

    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      ttl: '10m',
      name: identity,
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
      url: process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL || '',
    });
  } catch (error) {
    console.error('livekit token route error', error);
    return Response.json({ error: 'Failed to create session token.' }, { status: 500 });
  }
}

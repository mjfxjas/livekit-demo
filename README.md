# LiveKit Voice Concierge

Next.js demo that joins a LiveKit room, publishes microphone audio, and sends
browser-transcribed speech to a text-response API. Responses are displayed and
read aloud using browser speech synthesis. Typed chat uses the same API.

## Architecture

- Next.js, React, and TypeScript frontend in `app/`.
- `/api/livekit/token` signs short-lived LiveKit room tokens.
- LiveKit carries microphone audio; browser speech recognition produces transcripts.
- `/api/concierge` calls Bedrock, then optionally OpenAI, with canned replies as a fallback.
- The browser displays the reply and reads it aloud.

Speech recognition and playback run in the browser. This demo does not run a
server-side voice agent over LiveKit.

## Local Setup

Requirements: Node.js 20+, LiveKit server credentials, and AWS credentials with
Bedrock access. Browser speech-recognition support varies; the demo was developed
for Chrome.

```bash
cd app
npm install
```

Create `app/.env.local` with the following values:

```env
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
NEXT_PUBLIC_LIVEKIT_URL=
LIVEKIT_ROOM_PREFIX=livekit-demo
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
```

If using the LiveKit CLI, run this from `app/`:

```bash
lk app env --write --destination .env.local
```

Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` to enable the OpenAI fallback.
Keep server credentials in `.env.local`.

```bash
npm run dev
```

Open `http://localhost:3000`.

## Checks

From `app/`:

```bash
npm run lint
npm run build
```

To check the voice flow: create a session, join the room, publish the microphone,
and start transcription. With auto-send enabled, a finalized transcript should
produce a response and browser playback. The interface identifies the response
provider, including fallback responses.

## Project Files

- `app/`: application and API routes.
- `docs/ARCHITECTURE.md`: architecture notes.
- `docs/LOOM_SCRIPT.md`: recorded-demo outline.

# LiveKit Voice Concierge Demo

A small but real **pre-sales / solutions engineering demo** built around LiveKit.

This project shows how I would frame, prototype, and explain a customer-facing realtime voice experience for a technical buyer evaluating LiveKit.

## What it does

This demo supports a full working voice loop:

1. creates a signed LiveKit session token server-side
2. joins a LiveKit room from the browser
3. publishes microphone audio
4. shows live mic activity
5. transcribes speech in the browser
6. sends finalized transcript to a concierge backend
7. gets a response from **AWS Bedrock (Claude 3 Haiku)**
8. reads the response back aloud with browser speech synthesis

It also supports typed chat against the same concierge path.

## Why this exists

This was built as a **solutions-engineering proof piece** for a LiveKit pre-sales style role.

The goal was not to build a giant production app. The goal was to prove that I can:
- understand the platform quickly
- design a useful customer-facing prototype
- wire together the critical realtime flow
- explain the architecture in business + technical terms
- choose pragmatic low-cost implementation paths

## Demo architecture

### Core components
- **Frontend:** Next.js + React + TypeScript
- **Realtime layer:** LiveKit client SDK
- **Session auth:** Next.js API route signs short-lived room tokens
- **LLM backend:** AWS Bedrock using `anthropic.claude-3-haiku-20240307-v1:0`
- **Speech in:** browser-native speech recognition
- **Speech out:** browser-native speech synthesis

### Request / response loop
1. Browser requests a token from `/api/livekit/token`
2. Backend signs a short-lived LiveKit room token
3. Browser joins the room and publishes mic audio
4. Browser speech recognition captures finalized transcript
5. Transcript is sent to `/api/concierge`
6. Concierge route calls Bedrock (with fallback paths available)
7. Text response is rendered in the transcript panel and spoken aloud locally

## Current capabilities

- LiveKit token generation
- Room join / disconnect
- Local microphone publish / unpublish
- Mic activity visualization
- Browser transcription
- Auto-send transcript to concierge
- Bedrock-backed concierge responses
- Provider / model visibility in UI
- Browser speech playback

## Why Bedrock Haiku

For this demo, I chose **Claude 3 Haiku on Bedrock** because it is a strong low-cost option for concise, customer-facing responses.

That choice reflects a real pre-sales / prototype mindset:
- keep the prototype cheap
- keep latency reasonable
- use something good enough to demonstrate the interaction loop
- leave room to upgrade the model later if needed

## Local setup

### Requirements
- Node.js 20+
- LiveKit CLI configured for your project
- AWS credentials with Bedrock access
- Chrome recommended for browser speech recognition

### Install
```bash
cd app
npm install
```

### Environment
Create `app/.env.local` from `app/.env.example`.

Key variables:
```env
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
NEXT_PUBLIC_LIVEKIT_URL=
LIVEKIT_ROOM_PREFIX=livekit-demo
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
```

If using the LiveKit CLI, you can often populate the local env automatically:

```bash
cd app
lk app env --write --destination .env.local
```

### Run
```bash
cd app
npm run dev
```

Then open:

```text
http://localhost:3000
```

## How to test the MVP

1. Create LiveKit session
2. Join room
3. Publish mic
4. Start browser transcription
5. Leave **Auto-send transcript** on
6. Ask a question aloud
7. Watch transcript finalize, auto-send, return a Bedrock response, and play spoken output

## What I would improve next

If I were taking this from demo to stronger pilot / customer-facing POC, the next upgrades would be:
- realtime agent audio over LiveKit instead of browser speech synthesis
- streaming tokens / partial response rendering
- intent routing and richer domain-specific prompting
- retrieval / FAQ grounding
- human handoff path
- persisted session history
- deployment + auth polish

## Demo / Loom Checklist
For a fast pre-sales walkthrough, show this sequence:
1. create session
2. join room
3. publish mic
4. start browser transcription
5. ask one customer-style question aloud
6. let the concierge respond
7. point out provider/model visibility and low-cost architecture choices

## Repo structure

- `app/` — Next.js application
- `docs/ARCHITECTURE.md` — architecture + demo framing
- `docs/LOOM_SCRIPT.md` — short pre-sales walkthrough script

## Positioning

This is intentionally a **small, legible, high-signal demo**.

It is meant to show technical depth, product sense, and presales thinking — not just raw code volume.

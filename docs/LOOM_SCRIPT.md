# Loom Script — 60 to 90 seconds

## Goal
Sound like a pre-sales / solutions engineer, not just a developer showing a side project.

## Short version

Hi — I built this small LiveKit voice concierge demo to show how I’d approach a customer-facing proof-of-concept for a realtime voice use case.

The core loop is fully working: the browser requests a signed LiveKit session token, joins a room, publishes microphone audio, transcribes speech in the browser, sends finalized transcript to a concierge backend, gets a response from AWS Bedrock using Claude 3 Haiku, and then plays the answer back aloud.

What I wanted to demonstrate here wasn’t just that I could wire up the SDK, but that I could turn the platform into a clean evaluation experience for a technical buyer. It’s intentionally small, low-cost, and easy to reason about, with clear upgrade paths to a more production-ready version like realtime agent audio, retrieval, or human handoff.

If I were using this in a customer conversation, I’d position it as a fast proof-of-concept that validates interaction quality, architecture shape, and integration approach before a larger rollout.

## Demo click path

1. Briefly show the landing screen
2. Point out provider/model visibility
3. Create session / join room if needed
4. Show mic meter moving
5. Start transcription
6. Ask one good customer-style question aloud
7. Let the concierge answer aloud
8. End on the architecture / low-cost / upgrade-path framing

## Good spoken example prompt

“How would you scope a LiveKit proof of concept for an enterprise customer evaluating realtime voice support?”

## Final sentence options

- "This is the kind of small, legible prototype I’d use to help a customer get to technical confidence quickly."
- "The point here is fast validation: prove the interaction, clarify the architecture, and create a clean path to production."
- "I built this to show not just platform familiarity, but how I think about customer adoption and technical evaluation."

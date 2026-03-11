# Architecture

## Objective

Build a small but credible realtime voice concierge demo that shows how a pre-sales / solutions engineer could prototype a LiveKit-powered customer interaction flow.

## Design priorities

1. **Fast to understand**
2. **Fast to demo**
3. **Low cost to run**
4. **Clear enough to discuss with technical buyers**
5. **Modular enough to extend into a richer POC**

## System overview

```mermaid
flowchart TD
    A[Browser UI] --> B[/api/livekit/token]
    B --> C[LiveKit token signing]
    A --> D[LiveKit room]
    A --> E[Browser speech recognition]
    E --> F[/api/concierge]
    F --> G[AWS Bedrock - Claude 3 Haiku]
    G --> F
    F --> A
    A --> H[Browser speech synthesis]
```

## Components

### 1) Browser UI
Responsibilities:
- collect display name
- create/join LiveKit session
- publish microphone
- show mic activity
- show live transcript
- display conversation history
- read concierge replies aloud

### 2) Token route
`/api/livekit/token`

Responsibilities:
- hold LiveKit API credentials server-side
- issue short-lived room token
- keep auth material out of the browser

### 3) LiveKit room connection
Responsibilities:
- connect browser client to room
- publish mic audio
- support future remote participants / true voice agents

### 4) Browser transcription
Responsibilities:
- convert speech to text cheaply for demo purposes
- generate finalized transcript segments
- optionally auto-send them into the concierge loop

Tradeoff:
- very cheap / often free
- browser-dependent
- not the same as production-grade server transcription

### 5) Concierge route
`/api/concierge`

Responsibilities:
- accept typed or transcribed input
- call the selected backend provider
- return concise response text plus provider/model metadata

Provider order:
1. AWS Bedrock
2. OpenAI fallback
3. local fallback response

### 6) Bedrock model choice
Default:
- `anthropic.claude-3-haiku-20240307-v1:0`

Why:
- cheap enough for demo use
- fast enough for interaction loops
- good enough for concise solutions-engineering style responses

## Current demo loop

1. User joins room
2. User publishes mic
3. Browser transcription starts
4. Finalized speech becomes transcript text
5. Transcript auto-sends to concierge
6. Concierge calls Bedrock
7. Response is rendered in UI
8. Browser speaks the answer aloud

## Why this is strong for a pre-sales role

This demo gives you multiple layers to talk through:

### Customer conversation layer
- what the user experiences
- how quickly they can validate the concept
- where the proof-of-concept boundary sits

### Technical architecture layer
- auth boundary
- client vs server responsibilities
- model/provider decisions
- cost/latency tradeoffs

### Production discussion layer
- security and token scope
- better transcription path
- move from browser speech to realtime agent audio
- analytics, persistence, routing, human handoff

## Suggested next upgrades

### Near-term polish
- tighten UI copy and visual hierarchy
- refine concierge system prompt
- add explicit example prompts

### Stronger technical demo
- stream response tokens
- add retrieval / FAQ grounding
- show customer-specific architecture recommendations

### More production-like version
- replace browser speech synthesis with true LiveKit agent audio
- server-side transcription / speech pipeline
- conversation persistence
- deployment with demo URL

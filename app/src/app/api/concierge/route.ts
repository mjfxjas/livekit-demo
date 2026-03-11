import OpenAI from 'openai';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const BEDROCK_REGION = process.env.BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1';
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';

const bedrock = new BedrockRuntimeClient({ region: BEDROCK_REGION });

const systemPrompt = `You are a concise, sharp presales voice concierge for a LiveKit demo.
Your job is to sound like a strong sales engineer / solutions architect.
Be helpful, concrete, and customer-facing.
Focus on: discovery, architecture framing, proof-of-concept design, rollout concerns, scale, latency, SDK/API integration, and handoff to humans when appropriate.
Keep answers to 2-5 sentences unless the user asks for more.`;

const cannedReplies = [
  'Welcome in — I can help route a visitor to sales, support, or a product specialist.',
  'For a production rollout, I would usually ask about expected concurrency, latency sensitivity, and deployment constraints.',
  'A common presales path here is: discovery call, architecture sketch, proof-of-concept, and then production handoff.',
  'If this were a real concierge agent, I would next capture intent and hand you to the right workflow or human owner.',
];

function pickFallback(input: string) {
  const lower = input.toLowerCase();

  if (lower.includes('pricing') || lower.includes('cost')) {
    return 'For pricing conversations, I would usually gather expected usage first — especially concurrency, minutes streamed, regions, and support requirements.';
  }
  if (lower.includes('architecture') || lower.includes('scale')) {
    return 'At a high level, I would frame the solution around a browser client, a token service, LiveKit media transport, and downstream application or AI services.';
  }
  if (lower.includes('demo') || lower.includes('proof') || lower.includes('poc')) {
    return 'A strong proof-of-concept should stay narrow: one interaction path, clear success criteria, and a short route to production learnings.';
  }

  return cannedReplies[Math.floor(Math.random() * cannedReplies.length)];
}

async function tryBedrock(message: string) {
  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 220,
    system: systemPrompt,
    messages: [{ role: 'user', content: [{ type: 'text', text: message }] }],
  };

  const command = new InvokeModelCommand({
    modelId: BEDROCK_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  });

  const response = await bedrock.send(command);
  const raw = response.body?.transformToString ? await response.body.transformToString() : new TextDecoder().decode(response.body);
  const json = JSON.parse(raw);
  const text = json?.content?.map((item: { type?: string; text?: string }) => item?.text || '').join('\n').trim();
  return text || null;
}

async function tryOpenAI(message: string) {
  if (!openai) return null;

  const completion = await openai.responses.create({
    model: MODEL,
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ],
    max_output_tokens: 180,
  });

  return completion.output_text?.trim() || null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    if (!message) {
      return Response.json({ error: 'Message is required.' }, { status: 400 });
    }

    let reply = pickFallback(message);
    let mode = 'mock-concierge';
    let provider = 'fallback';
    let model = 'mock-concierge';

    try {
      const bedrockReply = await tryBedrock(message);
      if (bedrockReply) {
        reply = bedrockReply;
        mode = `bedrock:${BEDROCK_MODEL_ID}`;
        provider = 'bedrock';
        model = BEDROCK_MODEL_ID;
      }
    } catch (bedrockError) {
      console.error('bedrock concierge fallback', bedrockError);
    }

    if (mode === 'mock-concierge' && openai) {
      try {
        const openaiReply = await tryOpenAI(message);
        if (openaiReply) {
          reply = openaiReply;
          mode = `llm:${MODEL}`;
          provider = 'openai';
          model = MODEL;
        }
      } catch (llmError) {
        console.error('openai concierge fallback', llmError);
      }
    }

    return Response.json({
      reply,
      mode,
      provider,
      model,
      received: message,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('concierge route error', error);
    return Response.json({ error: 'Failed to generate concierge reply.' }, { status: 500 });
  }
}

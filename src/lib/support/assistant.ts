import 'server-only'

import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { serverEnv } from '@/lib/env'

/**
 * The support assistant.
 *
 * A club administrator who needs the platform's help first talks to this. It
 * asks the handful of questions a good support engineer would ask, and when it
 * has enough it writes a structured report the platform operator can act on
 * without a back-and-forth. The administrator can hand over to a person at any
 * point; the assistant never decides that for them.
 *
 * What it is given is deliberately narrow: the club's name and the words the
 * administrator typed. No member record, booking or payment ever reaches the
 * model — the report is free of member data by construction, which is what
 * lets the operator (who may not see member data) read it.
 */

export const SUPPORT_CATEGORIES = ['bug', 'question', 'billing', 'feature', 'urgent', 'other'] as const
export const SUPPORT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const

export const supportReportSchema = z.object({
  title: z.string().min(3).max(120),
  category: z.enum(SUPPORT_CATEGORIES),
  severity: z.enum(SUPPORT_SEVERITIES),
  summary: z.string().min(10).max(1500),
  where: z.string().max(300).describe('The screen or feature involved'),
  steps: z.array(z.string().max(300)).max(12).describe('How to see it happen, in order'),
  expected: z.string().max(500),
  actual: z.string().max(500),
  impact: z.string().max(500).describe('Who is affected and how much'),
  started: z.string().max(200).describe('When it began, in the administrator’s words'),
  tried: z.array(z.string().max(300)).max(8).describe('What the club has already tried'),
})

export type SupportReport = z.infer<typeof supportReportSchema>

const turnSchema = z.object({
  reply: z.string().min(1).max(2000),
  ready: z.boolean(),
  report: supportReportSchema.nullable(),
})

export type AssistantTurn = z.infer<typeof turnSchema>

export interface TranscriptMessage {
  role: 'admin' | 'bot'
  body: string
}

export function assistantEnabled(): boolean {
  return Boolean(serverEnv().ANTHROPIC_API_KEY)
}

const MODEL = 'claude-opus-5'

// The JSON the model is required to produce. Mirrors turnSchema; kept as a
// plain literal because the API wants a JSON Schema, not a Zod one.
const TURN_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'ready', 'report'],
  properties: {
    reply: { type: 'string', description: 'What to say to the administrator next' },
    ready: {
      type: 'boolean',
      description: 'True only when the report is complete enough for a support engineer to act on',
    },
    report: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: [
            'title', 'category', 'severity', 'summary', 'where', 'steps',
            'expected', 'actual', 'impact', 'started', 'tried',
          ],
          properties: {
            title: { type: 'string' },
            category: { type: 'string', enum: [...SUPPORT_CATEGORIES] },
            severity: { type: 'string', enum: [...SUPPORT_SEVERITIES] },
            summary: { type: 'string' },
            where: { type: 'string' },
            steps: { type: 'array', items: { type: 'string' } },
            expected: { type: 'string' },
            actual: { type: 'string' },
            impact: { type: 'string' },
            started: { type: 'string' },
            tried: { type: 'array', items: { type: 'string' } },
          },
        },
      ],
    },
  },
} as const

function systemPrompt(clubName: string): string {
  return `You are the support assistant for Surfer Live, a booking and inventory platform used by surf clubs. You are talking with the administrator of the club "${clubName}". Your job is to understand their problem or question well enough to write a support report that the platform's engineer can act on immediately, without asking anything further.

How to work:
- Ask one or two focused questions at a time. Ask only what a good support engineer would need: what they were doing, what they expected, what happened instead, where in the app, since when, how many people it affects, what they have tried.
- If the administrator's first message already answers most of this, do not interrogate them — fill the report and ask only what is genuinely missing.
- Set "ready" to true as soon as the report is good enough to act on, and say in your reply that the report is ready and they can send it to the platform, or keep talking. Fill "report" whenever ready is true; otherwise leave it null.
- If the matter is urgent — members cannot book, payments failing, the club cannot sign in — mark it urgent/critical and get to "ready" quickly.
- Simple how-to questions you can answer with confidence: answer them, and still offer to file the question for the platform.
- Never ask for, and never write into the report, a member's name, phone, email, payment details or any other personal detail. If the administrator volunteers one, leave it out of the report and refer to "a member" instead.
- You cannot see the club's data, change settings, or promise fixes or timelines. Say so plainly if asked.
- Write to the administrator in the language they write in. Write the report in English.
- Keep replies short and warm. No bullet lists in replies unless listing questions. Do not include internal or system XML tags in your response.`
}

let client: Anthropic | null = null
function anthropic(): Anthropic {
  client ??= new Anthropic({ apiKey: serverEnv().ANTHROPIC_API_KEY, maxRetries: 2, timeout: 60_000 })
  return client
}

export class AssistantUnavailable extends Error {}

/**
 * One turn of the conversation. The transcript ends with the administrator's
 * latest message. Throws AssistantUnavailable when the assistant cannot answer
 * (no key, model declined, malformed output) — the caller falls back to the
 * human pipeline; it never fails the administrator's message.
 */
export async function assistantTurn(clubName: string, transcript: TranscriptMessage[]): Promise<AssistantTurn> {
  if (!assistantEnabled()) throw new AssistantUnavailable('ANTHROPIC_API_KEY is not set')

  // Fold the transcript into alternating user/assistant turns. Consecutive
  // messages from the same side are merged so the API sees a clean dialogue.
  const messages: Anthropic.Beta.BetaMessageParam[] = []
  for (const m of transcript) {
    const role = m.role === 'admin' ? 'user' : 'assistant'
    const last = messages.at(-1)
    if (last && last.role === role && typeof last.content === 'string') {
      last.content = `${last.content}\n\n${m.body}`
    } else {
      messages.push({ role, content: m.body })
    }
  }
  if (messages.length === 0 || messages.at(-1)?.role !== 'user') {
    throw new AssistantUnavailable('transcript must end with the administrator')
  }

  let response: Anthropic.Beta.BetaMessage
  try {
    response = await anthropic().beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ['structured-outputs-2025-11-13', 'server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: systemPrompt(clubName),
      messages,
      output_config: { format: { type: 'json_schema', schema: TURN_JSON_SCHEMA } },
    })
  } catch (cause) {
    throw new AssistantUnavailable(cause instanceof Error ? cause.message : 'request failed')
  }

  if (response.stop_reason === 'refusal') {
    throw new AssistantUnavailable('the assistant declined to answer')
  }

  const text = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new AssistantUnavailable('the assistant returned something that was not a report')
  }

  const turn = turnSchema.safeParse(parsed)
  if (!turn.success) throw new AssistantUnavailable('the assistant’s report did not validate')

  // A report is only a report when the assistant says it is ready.
  return turn.data.ready ? turn.data : { ...turn.data, report: null }
}

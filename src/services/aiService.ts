import type { AIConfig, Message } from '../types/game'

type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }

function buildApiMessages(systemPrompt: string, messages: Message[], charContext?: string) {
  const apiMessages: { role: 'system' | 'user' | 'assistant'; content: string | ContentPart[] }[] = []

  // Merge all system content into a single message at index 0 (required by many APIs)
  let systemContent = systemPrompt
  if (charContext) {
    systemContent += charContext
  }
  apiMessages.push({ role: 'system', content: systemContent })

  for (const m of messages) {
    const parts: ContentPart[] = []
    if (m.content) {
      parts.push({ type: 'text', text: m.content })
    }
    if (m.attachments?.length) {
      for (const att of m.attachments) {
        if (att.type === 'image' && att.data) {
          parts.push({ type: 'image_url', image_url: { url: `data:${att.mimeType};base64,${att.data}` } })
        }
      }
    }
    apiMessages.push({
      role: (m.sender === 'player' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: parts.length > 0 ? parts : m.content,
    })
  }

  return apiMessages
}

let lastResponseId: string | null = null

export function getLastResponseId(): string | null {
  return lastResponseId
}

export function clearLastResponseId(): void {
  lastResponseId = null
}

async function fetchApi(config: AIConfig, body: Record<string, unknown>): Promise<Response> {
  if (config.apiKey) {
    return fetch(`${config.endpoint}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify(body),
    })
  }
  return fetch('/api/proxy/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function sendChat(
  config: AIConfig,
  systemPrompt: string,
  messages: Message[]
): Promise<string> {
  const body = {
    model: config.model,
    messages: buildApiMessages(systemPrompt, messages),
    temperature: config.temperature,
  }

  const response = await fetchApi(config, body)
  if (!response.ok) throw new Error(`Error API (${response.status}): ${await response.text().catch(() => '') || response.statusText}`)
  const data = await response.json()
  return data.choices[0].message.content
}

export async function sendChatStream(
  config: AIConfig,
  systemPrompt: string,
  messages: Message[],
  charContext?: string
): Promise<string> {
  const apiMessages = buildApiMessages(systemPrompt, messages, charContext)

  const body: Record<string, unknown> = {
    model: config.model,
    messages: apiMessages,
    temperature: config.temperature,
    stream: true,
  }

  // Use previous response ID for context caching (OpenAI-specific optimization)
  if (lastResponseId && config.endpoint.includes('api.openai.com')) {
    body.previous_response_id = lastResponseId
  }

  const response = await fetchApi(config, body)
  if (!response.ok) throw new Error(`Error API (${response.status}): ${await response.text().catch(() => '') || response.statusText}`)

  const reader = response.body?.getReader()
  if (!reader) {
    const data = await response.json()
    lastResponseId = data.id || null
    return data.choices[0].message.content
  }

  const decoder = new TextDecoder()
  let accumulated = ''
  let buffer = ''
  let firstChunk = true

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') continue

      try {
        const parsed = JSON.parse(data)
        if (firstChunk && parsed.id) {
          lastResponseId = parsed.id
          firstChunk = false
        }
        const delta = parsed.choices?.[0]?.delta?.content
        if (delta) accumulated += delta
      } catch {
        // Skip malformed SSE lines
      }
    }
  }

  return accumulated
}

export async function validateConnection(config: AIConfig): Promise<boolean> {
  try {
    const body = {
      model: config.model,
      messages: [{ role: 'user', content: 'Respond with: OK' }],
      max_tokens: 10,
    }

    const response = await fetchApi(config, body)
    return response.ok
  } catch {
    return false
  }
}

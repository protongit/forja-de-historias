import type { AIConfig, Message } from '../types/game'
import { proxyAuthHeaders } from './proxyToken'

type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }

export function buildApiMessages(systemPrompt: string, messages: Message[], charContext?: string) {
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
          // Tolerate legacy data stored as a full data URL
          const url = att.data.startsWith('data:') ? att.data : `data:${att.mimeType};base64,${att.data}`
          parts.push({ type: 'image_url', image_url: { url } })
        }
      }
    }
    // Plain string when the message is text-only (required by some OpenAI-compatible servers)
    const hasImage = parts.some((p) => p.type === 'image_url')
    apiMessages.push({
      role: (m.sender === 'player' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: hasImage ? parts : m.content,
    })
  }

  return apiMessages
}

async function fetchApi(config: AIConfig, body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
  if (config.apiKey) {
    return fetch(`${config.endpoint}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify(body),
      signal,
    })
  }
  return fetch('/api/proxy/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...proxyAuthHeaders() },
    body: JSON.stringify(body),
    signal,
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

export interface ChatStreamOptions {
  onDelta?: (accumulated: string) => void
  signal?: AbortSignal
}

export async function sendChatStream(
  config: AIConfig,
  systemPrompt: string,
  messages: Message[],
  charContext?: string,
  options?: ChatStreamOptions
): Promise<string> {
  const { onDelta, signal } = options ?? {}
  const apiMessages = buildApiMessages(systemPrompt, messages, charContext)

  const body: Record<string, unknown> = {
    model: config.model,
    messages: apiMessages,
    temperature: config.temperature,
    stream: true,
  }

  const response = await fetchApi(config, body, signal)
  if (!response.ok) throw new Error(`Error API (${response.status}): ${await response.text().catch(() => '') || response.statusText}`)

  const reader = response.body?.getReader()
  if (!reader) {
    const data = await response.json()
    return data.choices[0].message.content
  }

  const decoder = new TextDecoder()
  let accumulated = ''
  let buffer = ''

  const cancelReader = () => { reader.cancel().catch(() => {}) }
  signal?.addEventListener('abort', cancelReader)

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done || signal?.aborted) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      let changed = false
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) {
            accumulated += delta
            changed = true
          }
        } catch {
          // Skip malformed SSE lines
        }
      }
      if (changed) onDelta?.(accumulated)
    }
  } finally {
    signal?.removeEventListener('abort', cancelReader)
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

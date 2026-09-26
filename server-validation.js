// Validación de payloads del proxy (whitelist, nunca reenvío arbitrario)
// Separada de server.js para poder testearla con Vitest.

export const MAX_MESSAGES = 200
export const MAX_MESSAGE_CHARS = 100_000
export const MAX_ATTACHMENT_CHARS = 8_000_000

export function toInt(value, min, max, fallback = 0) {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.floor(n)))
}

export function sanitizeApiMessages(raw) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) return null
  const clean = []
  for (const m of raw) {
    if (!m || typeof m !== 'object') return null
    if (!['system', 'user', 'assistant'].includes(m.role)) return null
    let content
    if (typeof m.content === 'string') {
      content = m.content.slice(0, MAX_MESSAGE_CHARS)
    } else if (Array.isArray(m.content)) {
      if (m.content.length > 20) return null
      content = m.content.map((part) => {
        if (part?.type === 'text' && typeof part.text === 'string') {
          return { type: 'text', text: part.text.slice(0, MAX_MESSAGE_CHARS) }
        }
        if (part?.type === 'image_url' && typeof part.image_url?.url === 'string') {
          const url = part.image_url.url
          if (url.length > MAX_ATTACHMENT_CHARS) return null
          return { type: 'image_url', image_url: { url } }
        }
        return null
      })
      if (content.some((p) => p === null)) return null
    } else {
      return null
    }
    clean.push({ role: m.role, content })
  }
  return clean
}

export function validateChatBody(req, res, next) {
  const b = req.body || {}
  const messages = sanitizeApiMessages(b.messages)
  if (!messages) {
    return res.status(400).json({ error: 'Payload inválido: campo "messages" requerido (array de {role, content})' })
  }
  req.body = {
    model: typeof b.model === 'string' ? b.model.slice(0, 200) : 'gpt-4o-mini',
    messages,
    temperature: Number.isFinite(b.temperature) ? Math.min(2, Math.max(0, b.temperature)) : 0.8,
    ...(b.max_tokens !== undefined && Number.isInteger(b.max_tokens) && b.max_tokens > 0
      ? { max_tokens: Math.min(32768, b.max_tokens) }
      : {}),
    ...(b.stream === true ? { stream: true } : {}),
  }
  next()
}

export function validateTtsBody(req, res, next) {
  const b = req.body || {}
  if (typeof b.input !== 'string' || !b.input.trim()) {
    return res.status(400).json({ error: 'Campo "input" requerido' })
  }
  req.body = {
    model: typeof b.model === 'string' ? b.model.slice(0, 200) : 'tts-1',
    input: b.input.slice(0, 4096),
    voice: typeof b.voice === 'string' ? b.voice.slice(0, 100) : 'alloy',
    ...(Number.isFinite(b.speed) ? { speed: Math.min(4, Math.max(0.25, b.speed)) } : {}),
    ...(typeof b.response_format === 'string' ? { response_format: b.response_format.slice(0, 40) } : {}),
  }
  next()
}

export function validateImageBody(req, res, next) {
  const b = req.body || {}
  if (typeof b.prompt !== 'string' || !b.prompt.trim()) {
    return res.status(400).json({ error: 'Campo "prompt" requerido' })
  }
  req.body = {
    model: typeof b.model === 'string' ? b.model.slice(0, 200) : 'flux-2-klein',
    prompt: b.prompt.slice(0, 2000),
    ...(typeof b.size === 'string' ? { size: b.size.slice(0, 40) } : {}),
    ...(Number.isInteger(b.n) && b.n > 0 ? { n: Math.min(4, b.n) } : {}),
  }
  next()
}

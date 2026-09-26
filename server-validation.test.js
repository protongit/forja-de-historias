import { describe, it, expect, vi } from 'vitest'
import { toInt, sanitizeApiMessages, validateChatBody, validateTtsBody, validateImageBody, MAX_MESSAGES } from './server-validation.js'

function mockRes() {
  const res = { statusCode: 200, body: null }
  res.status = (c) => { res.statusCode = c; return res }
  res.json = (b) => { res.body = b; return res }
  return res
}

function runMiddleware(fn, body) {
  const req = { body }
  const res = mockRes()
  const next = vi.fn()
  fn(req, res, next)
  return { req, res, next }
}

describe('toInt', () => {
  it('clampa a los límites', () => {
    expect(toInt(-5, 1, 100, 1)).toBe(1)
    expect(toInt(999999999999, 0, 1_000_000_000)).toBe(1_000_000_000)
    expect(toInt('abc', 0, 100)).toBe(0)
    expect(toInt(undefined, 0, 100, 7)).toBe(7)
    expect(toInt(3.7, 0, 10)).toBe(3)
    expect(toInt(null, 1, 5, 2)).toBe(1)  // Number(null)=0 → clampa a min
    expect(toInt(Infinity, 0, 5)).toBe(0)
  })
})

describe('sanitizeApiMessages', () => {
  it('acepta mensajes de texto válidos', () => {
    const out = sanitizeApiMessages([{ role: 'user', content: 'hola' }])
    expect(out).toEqual([{ role: 'user', content: 'hola' }])
  })

  it('rechaza roles desconocidos', () => {
    expect(sanitizeApiMessages([{ role: 'hacker', content: 'x' }])).toBeNull()
  })

  it('rechaza vacío, no-array y exceso de mensajes', () => {
    expect(sanitizeApiMessages([])).toBeNull()
    expect(sanitizeApiMessages('nope')).toBeNull()
    expect(sanitizeApiMessages(Array.from({ length: MAX_MESSAGES + 1 }, () => ({ role: 'user', content: 'x' })))).toBeNull()
  })

  it('trunca texto excesivo', () => {
    const out = sanitizeApiMessages([{ role: 'user', content: 'a'.repeat(200_000) }])
    expect(out[0].content.length).toBeLessThanOrEqual(100_000)
  })

  it('permite partes text + image_url y rechaza tipos arbitrarios', () => {
    const ok = sanitizeApiMessages([{ role: 'user', content: [
      { type: 'text', text: 'mira' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } },
    ] }])
    expect(ok[0].content.length).toBe(2)
    expect(sanitizeApiMessages([{ role: 'user', content: [{ type: 'evil', data: {} }] }])).toBeNull()
  })

  it('rechaza imágenes que exceden el límite de adjuntos', () => {
    const huge = { type: 'image_url', image_url: { url: 'x'.repeat(8_000_001) } }
    expect(sanitizeApiMessages([{ role: 'user', content: [huge] }])).toBeNull()
  })
})

describe('validateChatBody', () => {
  it('normaliza el payload y elimina campos arbitrarios', () => {
    const { req, next, res } = runMiddleware(validateChatBody, {
      messages: [{ role: 'user', content: 'hola' }],
      temperature: 99,
      evil: 'inject',
      stream: true,
    })
    expect(res.statusCode).toBe(200)
    expect(next).toHaveBeenCalled()
    expect(req.body).toEqual({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'hola' }],
      temperature: 2,
      stream: true,
    })
  })

  it('rechaza sin messages', () => {
    const { next, res } = runMiddleware(validateChatBody, { foo: 1 })
    expect(res.statusCode).toBe(400)
    expect(next).not.toHaveBeenCalled()
  })

  it('limita max_tokens', () => {
    const { req } = runMiddleware(validateChatBody, { messages: [{ role: 'user', content: 'x' }], max_tokens: 999999999 })
    expect(req.body.max_tokens).toBe(32768)
  })
})

describe('validateTtsBody', () => {
  it('recorta input y voz', () => {
    const { req } = runMiddleware(validateTtsBody, { input: 'hola', voice: 'v'.repeat(200), speed: 99 })
    expect(req.body.input).toBe('hola')
    expect(req.body.voice.length).toBe(100)
    expect(req.body.speed).toBe(4)
  })

  it('rechaza input vacío', () => {
    const { res, next } = runMiddleware(validateTtsBody, { input: '   ' })
    expect(res.statusCode).toBe(400)
    expect(next).not.toHaveBeenCalled()
  })
})

describe('validateImageBody', () => {
  it('recorta prompt y limita n', () => {
    const { req } = runMiddleware(validateImageBody, { prompt: 'p'.repeat(3000), n: 12 })
    expect(req.body.prompt.length).toBe(2000)
    expect(req.body.n).toBe(4)
  })

  it('rechaza sin prompt', () => {
    const { res, next } = runMiddleware(validateImageBody, {})
    expect(res.statusCode).toBe(400)
    expect(next).not.toHaveBeenCalled()
  })
})

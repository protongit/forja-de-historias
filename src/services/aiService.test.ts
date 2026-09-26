import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildApiMessages } from './aiService'
import type { Message } from '../types/game'

describe('buildApiMessages', () => {
  it('coloca el system prompt en primer lugar y mapea sender a roles', () => {
    const messages: Message[] = [
      { id: '1', sender: 'player', content: 'hola', timestamp: 1 },
      { id: '2', sender: 'gm', content: 'saludos', timestamp: 2 },
    ]
    const api = buildApiMessages('Eres el GM', messages)
    expect(api[0]).toEqual({ role: 'system', content: 'Eres el GM' })
    expect(api[1]).toEqual({ role: 'user', content: 'hola' })
    expect(api[2]).toEqual({ role: 'assistant', content: 'saludos' })
  })

  it('concatena charContext al system prompt', () => {
    const api = buildApiMessages('Eres el GM', [], '\n\nESTADO DEL JUEGO')
    expect(api[0].content).toContain('ESTADO DEL JUEGO')
  })

  it('convierte adjuntos de imagen a image_url con prefijo data correcto', () => {
    const messages: Message[] = [
      {
        id: '1',
        sender: 'player',
        content: '',
        timestamp: 1,
        attachments: [{ type: 'image', data: 'QUJD', mimeType: 'image/png', name: 'a.png' }],
      },
    ]
    const api = buildApiMessages('sys', messages)
    const parts = api[1].content as { type: string; image_url?: { url: string } }[]
    expect(parts[0]).toEqual({ type: 'image_url', image_url: { url: 'data:image/png;base64,QUJD' } })
  })

  it('tolera adjuntos legacy con data URL completo (sin duplicar prefijo)', () => {
    const messages: Message[] = [
      {
        id: '1',
        sender: 'player',
        content: '',
        timestamp: 1,
        attachments: [{ type: 'image', data: 'data:image/png;base64,QUJD', mimeType: 'image/png', name: 'a.png' }],
      },
    ]
    const api = buildApiMessages('sys', messages)
    const parts = api[1].content as { type: string; image_url?: { url: string } }[]
    expect(parts[0]).toEqual({ type: 'image_url', image_url: { url: 'data:image/png;base64,QUJD' } })
  })

  it('usa content string cuando no hay adjuntos', () => {
    const messages: Message[] = [{ id: '1', sender: 'player', content: 'texto', timestamp: 1 }]
    const api = buildApiMessages('sys', messages)
    expect(api[1].content).toBe('texto')
  })
})
import { sendChatStream } from './aiService'

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c))
      controller.close()
    },
  })
  return new Response(stream, { status: 200 })
}

function sseChunk(text: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`
}

const cfg = { endpoint: '', apiKey: 'test-key', model: 'm', temperature: 0.8 }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sendChatStream', () => {
  it('acumula el texto completo del stream SSE', async () => {
    vi.stubGlobal('fetch', async () => sseResponse([sseChunk('Hola '), sseChunk('mundo'), 'data: [DONE]\n\n']))
    const out = await sendChatStream(cfg, 'sys', [])
    expect(out).toBe('Hola mundo')
  })

  it('invoca onDelta con el texto acumulado', async () => {
    vi.stubGlobal('fetch', async () => sseResponse([sseChunk('ta'), sseChunk('ct')]))
    const seen: string[] = []
    const out = await sendChatStream(cfg, 'sys', [], undefined, { onDelta: (acc) => seen.push(acc) })
    expect(out).toBe('tact')
    expect(seen.length).toBeGreaterThan(0)
    expect(seen[seen.length - 1]).toBe('tact')
  })

  it('lanza error si el fetch es abortado antes de recibir la respuesta', async () => {
    const ac = new AbortController()
    ac.abort()
    vi.stubGlobal('fetch', async (_url: string, opts?: { signal?: AbortSignal }) => {
      if (opts?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      return sseResponse([])
    })
    await expect(sendChatStream(cfg, 'sys', [], undefined, { signal: ac.signal })).rejects.toThrow()
  })
})

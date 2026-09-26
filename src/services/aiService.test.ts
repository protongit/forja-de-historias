import { describe, it, expect } from 'vitest'
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

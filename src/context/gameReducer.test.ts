import { describe, it, expect } from 'vitest'
import { gameReducer, initialState } from './gameReducer'
import { buildSummaryMessage } from '../utils/contextSummarizer'
import type { GameState, Message } from '../types/game'

function msg(content: string, sender: Message['sender'] = 'gm'): Message {
  return { id: crypto.randomUUID(), sender, content, timestamp: Date.now() }
}

function stateWithMessages(messages: Message[]): GameState {
  return { ...initialState, messages }
}

describe('COMPACT_MESSAGES', () => {
  it('inserta el resumen y elimina el lote más antiguo', () => {
    const messages = Array.from({ length: 60 }, (_, i) => msg(`m${i}`))
    const next = gameReducer(stateWithMessages(messages), {
      type: 'COMPACT_MESSAGES',
      summaryMessage: buildSummaryMessage('resumen de prueba'),
    })
    expect(next.messages[0].content).toContain('resumen de prueba')
    expect(next.messages.length).toBeLessThan(messages.length + 1)
    expect(next.messages.some((m) => m.content === 'm0')).toBe(false)
  })

  it('mantiene los mensajes añadidos después de los 35 primeros (sin índice obsoleto)', () => {
    const messages = Array.from({ length: 60 }, (_, i) => msg(`m${i}`))
    // 5 mensajes nuevos llegaron mientras se generaba el resumen
    const late = [msg('m60 nuevo'), msg('m61 nuevo'), msg('m62 nuevo'), msg('m63 nuevo'), msg('m64 nuevo')]
    const withLate = [...messages, ...late]
    const next = gameReducer(stateWithMessages(withLate), {
      type: 'COMPACT_MESSAGES',
      summaryMessage: buildSummaryMessage('resumen'),
    })
    for (const l of late) {
      expect(next.messages.some((m) => m.content === l.content)).toBe(true)
    }
  })

  it('descarta el resumen anterior', () => {
    const messages = [
      buildSummaryMessage('viejo'),
      ...Array.from({ length: 50 }, (_, i) => msg(`m${i}`)),
    ]
    const next = gameReducer(stateWithMessages(messages), {
      type: 'COMPACT_MESSAGES',
      summaryMessage: buildSummaryMessage('nuevo'),
    })
    const summaries = next.messages.filter((m) => m.content.startsWith('[Resumen de eventos anteriores'))
    expect(summaries.length).toBe(1)
    expect(summaries[0].content).toContain('nuevo')
  })

  it('no compacta con pocos mensajes', () => {
    const messages = Array.from({ length: 8 }, (_, i) => msg(`m${i}`))
    const next = gameReducer(stateWithMessages(messages), {
      type: 'COMPACT_MESSAGES',
      summaryMessage: buildSummaryMessage('x'),
    })
    expect(next.messages).toEqual(messages)
  })
})

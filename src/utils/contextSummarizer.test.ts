import { describe, it, expect } from 'vitest'
import { shouldSummarize, getMessagesToSummarize, buildSummaryMessages } from './contextSummarizer'
import type { Message } from '../types/game'

function msg(content: string, sender: Message['sender'] = 'gm'): Message {
  return { id: crypto.randomUUID(), sender, content, timestamp: Date.now() }
}

describe('shouldSummarize', () => {
  it('false por debajo del límite', () => {
    expect(shouldSummarize(50)).toBe(false)
  })
  it('true por encima del límite', () => {
    expect(shouldSummarize(51)).toBe(true)
  })
})

describe('getMessagesToSummarize', () => {
  it('excluye mensajes de resumen existentes', () => {
    const messages = [
      msg('[Resumen de eventos anteriores: algo]'),
      ...Array.from({ length: 45 }, (_, i) => msg(`mensaje ${i}`)),
    ]
    const toSummarize = getMessagesToSummarize(messages)
    expect(toSummarize.every((m) => !m.content.startsWith('[Resumen'))).toBe(true)
  })

  it('nunca resume más que el lote máximo', () => {
    const messages = Array.from({ length: 100 }, (_, i) => msg(`mensaje ${i}`))
    expect(getMessagesToSummarize(messages).length).toBeLessThanOrEqual(35)
  })

  it('deja al menos 10 mensajes sin resumir', () => {
    const messages = Array.from({ length: 60 }, (_, i) => msg(`mensaje ${i}`))
    const all = getMessagesToSummarize(messages)
    const remaining = messages.length - all.length
    expect(remaining).toBeGreaterThanOrEqual(10)
  })
})

describe('buildSummaryMessages', () => {
  it('devuelve keepFromIndex dentro de los límites', () => {
    const messages = Array.from({ length: 60 }, (_, i) => msg(`mensaje ${i}`))
    const { summaryMessage, keepFromIndex } = buildSummaryMessages(messages)
    expect(summaryMessage.sender).toBe('system')
    expect(keepFromIndex).toBeGreaterThan(0)
    expect(keepFromIndex).toBeLessThanOrEqual(messages.length)
  })
})

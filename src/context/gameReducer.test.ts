import { describe, it, expect } from 'vitest'
import { gameReducer, initialState } from './gameReducer'
import { buildSummaryMessage } from '../utils/contextSummarizer'
import type { GameState, Message, Enemy } from '../types/game'

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

function enemy(name: string, hp = 20): Enemy {
  return { name, hp, maxHp: hp, ac: 12, isAlive: true, description: '' }
}

describe('UPDATE_ENEMY — coincidencia de nombres', () => {
  const withEnemies = (enemies: Enemy[]): GameState => ({ ...initialState, enemies })

  it('actualiza por nombre exacto', () => {
    const next = gameReducer(withEnemies([enemy('Gatón'), enemy('Acompañante A')]), {
      type: 'UPDATE_ENEMY', name: 'Gatón', updates: { hp: 12 },
    })
    expect(next.enemies.find((e) => e.name === 'Gatón')?.hp).toBe(12)
  })

  it('ignora mayúsculas y acentos', () => {
    const next = gameReducer(withEnemies([enemy('Gatón')]), {
      type: 'UPDATE_ENEMY', name: 'gaton', updates: { hp: 5 },
    })
    expect(next.enemies[0].hp).toBe(5)
  })

  it('coincide por subcadena', () => {
    const next = gameReducer(withEnemies([enemy('Acompañante A'), enemy('Acompañante B')]), {
      type: 'UPDATE_ENEMY', name: 'Acompañante A', updates: { hp: 3 },
    })
    expect(next.enemies[0].hp).toBe(3)
    expect(next.enemies[1].hp).toBe(20)
  })

  it('coincide por solapamiento de tokens', () => {
    const next = gameReducer(withEnemies([enemy('el bruto de la cicatriz')]), {
      type: 'UPDATE_ENEMY', name: 'bruto cicatriz', updates: { hp: 7 },
    })
    expect(next.enemies[0].hp).toBe(7)
  })

  it('con un único enemigo aplica aunque el nombre difiera', () => {
    const next = gameReducer(withEnemies([enemy('Gañón')]), {
      type: 'UPDATE_ENEMY', name: 'el de la cicatriz', updates: { hp: 9 },
    })
    expect(next.enemies[0].hp).toBe(9)
  })

  it('con varios enemigos y nombre irreconocible no actualiza a ciegas', () => {
    const next = gameReducer(withEnemies([enemy('Uno'), enemy('Dos')]), {
      type: 'UPDATE_ENEMY', name: 'desconocido xyz', updates: { hp: 1 },
    })
    expect(next.enemies.every((e) => e.hp === 20)).toBe(true)
  })
})

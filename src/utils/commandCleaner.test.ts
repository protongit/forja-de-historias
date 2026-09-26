import { describe, it, expect } from 'vitest'
import { processRawResponse, cleanBracketCommands, cleanContentMarkers, parseStats, parseSkills } from './commandCleaner'

describe('cleanBracketCommands', () => {
  it('elimina comandos con corchetes simples y dobles', () => {
    expect(cleanBracketCommands('Hola [ADD_ITEM: espada] mundo')).toBe('Hola  mundo')
    expect(cleanBracketCommands('Hola [[ADD_ITEM: espada]] mundo')).toBe('Hola  mundo')
  })
})

describe('cleanContentMarkers', () => {
  it('elimina marcadores de contenido', () => {
    expect(cleanContentMarkers('[CHARACTER]texto[/CHARACTER]')).toBe('texto')
  })
})

describe('processRawResponse — items', () => {
  it('parsea ADD_ITEM y genera notificación', () => {
    const r = processRawResponse('Encuentras [ADD_ITEM: Espada de acero] en el cofre.', 1)
    expect(r.actions).toContainEqual({ type: 'ADD_ITEM', item: 'Espada de acero' })
    expect(r.actions.some((a) => a.type === 'ADD_NOTIFICATION')).toBe(true)
    expect(r.cleaned).not.toContain('ADD_ITEM')
  })

  it('parsea REMOVE_ITEM', () => {
    const r = processRawResponse('[REMOVE_ITEM: antorcha]', 1)
    expect(r.actions).toContainEqual({ type: 'REMOVE_ITEM', item: 'antorcha' })
  })
})

describe('processRawResponse — dados y XP', () => {
  it('parsea DICE_CHECK', () => {
    const r = processRawResponse('[DICE_CHECK: stat: Fuerza, dc: 15, dice: d20]', 1)
    expect(r.actions).toContainEqual({
      type: 'SET_DICE_CHECK',
      check: { stat: 'Fuerza', dc: 15, dice: 'd20', resolved: false },
    })
  })

  it('parsea ADD_XP y LEVEL_UP', () => {
    const r = processRawResponse('[ADD_XP: 50] [LEVEL_UP]', 3)
    expect(r.actions).toContainEqual({ type: 'ADD_XP', amount: 50 })
    expect(r.actions).toContainEqual({ type: 'SET_LEVEL', level: 4 })
  })
})

describe('processRawResponse — combate', () => {
  it('parsea COMBAT_START con múltiples enemigos', () => {
    const r = processRawResponse('[COMBAT_START: enemigos: Goblin|20|12|criatura verde, Ogro|40|14|grande y lento]', 1)
    expect(r.actions).toContainEqual({
      type: 'SET_ENEMIES',
      enemies: [
        { name: 'Goblin', hp: 20, maxHp: 20, ac: 12, isAlive: true, description: 'criatura verde' },
        { name: 'Ogro', hp: 40, maxHp: 40, ac: 14, isAlive: true, description: 'grande y lento' },
      ],
    })
    expect(r.actions).toContainEqual({ type: 'SET_COMBAT_ACTIVE', active: true })
  })

  it('parsea COMBAT_END con contador de bajas', () => {
    const r = processRawResponse('[COMBAT_END: count: 3]', 1)
    const increments = r.actions.filter((a) => a.type === 'INCREMENT_STAT')
    expect(increments).toHaveLength(3)
    expect(r.actions).toContainEqual({ type: 'SET_COMBAT_ACTIVE', active: false })
  })

  it('ENEMY_DAMAGE tolera comas en el nombre', () => {
    const r = processRawResponse('[ENEMY_DAMAGE: Goblin jefe, gruñendo, 5]', 1)
    expect(r.actions).toContainEqual({ type: 'UPDATE_ENEMY', name: 'Goblin jefe, gruñendo', updates: { hp: 5 } })
  })
})

describe('processRawResponse — parsing robusto con comas', () => {
  it('JOURNAL_ENTRY tolera comas en el resumen', () => {
    const r = processRawResponse('[JOURNAL_ENTRY: El bosque oscuro, Exploramos el bosque, lucha, magia y misterio, discovery]', 1)
    const entry = r.actions.find((a) => a.type === 'ADD_JOURNAL_ENTRY')
    expect(entry).toMatchObject({
      entry: expect.objectContaining({
        title: 'El bosque oscuro',
        summary: 'Exploramos el bosque, lucha, magia y misterio',
        eventType: 'discovery',
      }),
    })
  })

  it('JOURNAL_ENTRY con tipo desconocido no pierde la entrada', () => {
    const r = processRawResponse('[JOURNAL_ENTRY: Título, Resumen con, comas, combate]', 1)
    const entry = r.actions.find((a) => a.type === 'ADD_JOURNAL_ENTRY')
    expect(entry).toBeDefined()
  })

  it('ADD_NPC tolera comas en la descripción', () => {
    const r = processRawResponse('[ADD_NPC: Mira, mercader alta, siempre sonriente, Posada, 2]', 1)
    const npc = r.actions.find((a) => a.type === 'ADD_WORLD_NPC')
    expect(npc).toMatchObject({
      npc: expect.objectContaining({
        name: 'Mira',
        description: 'mercader alta, siempre sonriente',
        location: 'Posada',
        relationship: 2,
      }),
    })
  })

  it('DISCOVER_LOCATION tolera comas en la descripción', () => {
    const r = processRawResponse('[DISCOVER_LOCATION: Cueva, oscura, húmeda y fría]', 1)
    const loc = r.actions.find((a) => a.type === 'ADD_LOCATION')
    expect(loc).toMatchObject({
      location: expect.objectContaining({ name: 'Cueva', description: 'oscura, húmeda y fría' }),
    })
  })

  it('UPDATE_NPC tolera comas en el valor', () => {
    const r = processRawResponse('[UPDATE_NPC: Mira, description, amable, generosa y valiente]', 1)
    const upd = r.actions.find((a) => a.type === 'UPDATE_WORLD_NPC')
    expect(upd).toMatchObject({
      name: 'Mira',
      updates: { description: 'amable, generosa y valiente' },
    })
  })
})

describe('processRawResponse — mundo y HP', () => {
  it('SET_TIME valida valores permitidos', () => {
    const ok = processRawResponse('[SET_TIME: noche]', 1)
    expect(ok.actions).toContainEqual({ type: 'SET_TIME_OF_DAY', time: 'noche' })
    const bad = processRawResponse('[SET_TIME: madrugada]', 1)
    expect(bad.actions.filter((a) => a.type === 'SET_TIME_OF_DAY')).toHaveLength(0)
  })

  it('PLAYER_DAMAGE y PLAYER_HEAL actualizan HP con notificación', () => {
    const r = processRawResponse('[PLAYER_DAMAGE: 5] [PLAYER_HEAL: 2]', 1)
    expect(r.actions).toContainEqual({ type: 'UPDATE_PLAYER_HP', delta: -5 })
    expect(r.actions).toContainEqual({ type: 'UPDATE_PLAYER_HP', delta: 2 })
    expect(r.actions.filter((a) => a.type === 'ADD_NOTIFICATION')).toHaveLength(2)
  })
})

describe('processRawResponse — imágenes', () => {
  it('extrae pendingImages y las quita del texto', () => {
    const r = processRawResponse('Ves algo horrible [IMG: un horror ancestral] y huyes.', 1)
    expect(r.pendingImages).toEqual([{ prompt: 'un horror ancestral' }])
    expect(r.cleaned).not.toContain('un horror ancestral')
  })
})

describe('parseStats y parseSkills', () => {
  it('parsea stats desde bloque [STATS]', () => {
    const stats = parseStats('[STATS]\nFuerza: 16\nInteligencia: 12\nmalo\n[/STATS]')
    expect(stats).toEqual([
      { name: 'Fuerza', value: 16 },
      { name: 'Inteligencia', value: 12 },
    ])
  })

  it('parsea skills desde bloque [SKILLS]', () => {
    const skills = parseSkills('[SKILLS]\nSigilo: te permite moverte sin ser visto\n[/SKILLS]')
    expect(skills).toEqual([{ name: 'Sigilo', description: 'te permite moverte sin ser visto' }])
  })
})

import { describe, it, expect } from 'vitest'
import { buildArtStyle, pickAutoImage } from './autoImages'
import type { WorldLocation, WorldNPC } from '../types/game'

const loc = (name: string, extra = {}): WorldLocation => ({ name, description: 'lugar', discovered: true, exits: [], ...extra })
const npc = (name: string, extra = {}): WorldNPC => ({ name, description: 'sujeto', location: 'x', isAlive: true, relationship: 0, attitude: 0, ...extra })

function pick(overrides: Partial<Parameters<typeof pickAutoImage>[0]> = {}) {
  return pickAutoImage({
    imageEnabled: true,
    actions: [],
    locations: [],
    npcs: [],
    transition: 'normal',
    sceneText: '',
    ...overrides,
  })
}

describe('buildArtStyle', () => {
  it('deriva prefijo de respuestas del setup', () => {
    expect(buildArtStyle({ ambientacion: 'bosque sombrío', tono_narrador: 'Misteriosa' })).toBe(
      'ilustración de fantasía (bosque sombrío, Misteriosa): '
    )
    expect(buildArtStyle(undefined)).toBe('ilustración de fantasía: ')
  })
})

describe('pickAutoImage', () => {
  it('nueva ubicación → imagen con marca', () => {
    const job = pick({ actions: [{ type: 'ADD_LOCATION', location: loc('Cripta', { description: 'puerta de piedra' }) }] })
    expect(job?.prompt).toContain('Cripta')
    expect(job?.mark).toEqual({ type: 'MARK_LOCATION_IMAGE', name: 'Cripta' })
  })

  it('ubicación ya existente → sin imagen', () => {
    expect(pick({ actions: [{ type: 'ADD_LOCATION', location: loc('Cripta') }], locations: [loc('Cripta')] })).toBeNull()
  })

  it('ya ilustrada (hasImage) → sin imagen de nuevo NPC si existe', () => {
    expect(pick({ actions: [{ type: 'ADD_WORLD_NPC', npc: npc('Mira') }], npcs: [npc('Mira')] })).toBeNull()
  })

  it('nuevo NPC → imagen de retrato', () => {
    const job = pick({ actions: [{ type: 'ADD_WORLD_NPC', npc: npc('Mira', { description: 'tabernera' }) }] })
    expect(job?.prompt).toContain('Retrato de Mira')
    expect(job?.mark).toEqual({ type: 'MARK_NPC_IMAGE', name: 'Mira' })
  })

  it('preferencia: ubicación sobre NPC', () => {
    const job = pick({ actions: [{ type: 'ADD_WORLD_NPC', npc: npc('Mira') }, { type: 'ADD_LOCATION', location: loc('Plaza') }] })
    expect(job?.prompt).toContain('Plaza')
  })

  it('momentos: level-up, milestone, fin de combate y transiciones', () => {
    const scene = 'El héroe brilla con poder ancestral...'
    expect(pick({ actions: [{ type: 'SET_LEVEL', level: 2 }], sceneText: scene })?.prompt).toContain('poder ancestral')
    expect(pick({
      actions: [{ type: 'ADD_JOURNAL_ENTRY', entry: { id: '1', title: 't', summary: 's', eventType: 'milestone', timestamp: 1, isFavorite: false } }],
      sceneText: scene,
    })).not.toBeNull()
    expect(pick({
      actions: [{ type: 'SET_COMBAT_ACTIVE', active: false }, { type: 'INCREMENT_STAT', stat: 'enemiesDefeated' }],
      sceneText: scene,
    })).not.toBeNull()
    expect(pick({ transition: 'quest-complete', sceneText: scene })).not.toBeNull()
    expect(pick({ transition: 'generation-complete', sceneText: scene })).not.toBeNull()
  })

  it('sin momento ni entidad nueva → null', () => {
    expect(pick({ actions: [{ type: 'SET_COMBAT_ACTIVE', active: false }], sceneText: 'nada' })).toBeNull()
    expect(pick({ sceneText: 'nada' })).toBeNull()
  })

  it('imagen deshabilitada → null', () => {
    expect(pick({ imageEnabled: false, actions: [{ type: 'ADD_LOCATION', location: loc('X') }] })).toBeNull()
  })

  it('limita la longitud del prompt', () => {
    const job = pick({ actions: [{ type: 'ADD_LOCATION', location: loc('L', { description: 'x'.repeat(2000) }) }] })
    expect(job!.prompt.length).toBeLessThan(260)
  })

  it('sanitiza markdown en el prompt de escena', () => {
    const job = pick({ transition: 'quest-complete', sceneText: '# **Victoria** final > épico' })
    expect(job!.prompt).not.toMatch(/[*#>]/)
  })
})

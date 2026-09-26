import type { GameAction, WorldLocation, WorldNPC } from '../types/game'

export interface ImageJob {
  prompt: string
  mark?: GameAction
}

export function buildArtStyle(setupAnswers?: Record<string, string>): string {
  const bits = [setupAnswers?.ambientacion, setupAnswers?.tono_narrador].filter(Boolean)
  return bits.length ? `ilustración de fantasía (${bits.join(', ')}): ` : 'ilustración de fantasía: '
}

function scenePrompt(sceneText: string, style: string, cap = 220): string {
  const clean = sceneText.replace(/[#*_>`[\]]/g, ' ').replace(/\s+/g, ' ').trim()
  return style + clean.slice(0, cap)
}

export function pickAutoImage(opts: {
  imageEnabled: boolean
  actions: GameAction[]
  locations: WorldLocation[]
  npcs: WorldNPC[]
  transition: string
  sceneText: string
  setupAnswers?: Record<string, string>
}): ImageJob | null {
  if (!opts.imageEnabled) return null
  const style = buildArtStyle(opts.setupAnswers)

  for (const a of opts.actions) {
    if (a.type === 'ADD_LOCATION' && !opts.locations.some((l) => l.name === a.location.name)) {
      return {
        prompt: style + `${a.location.name}. ${a.location.description}`.replace(/\s+/g, ' ').slice(0, 220),
        mark: { type: 'MARK_LOCATION_IMAGE', name: a.location.name },
      }
    }
  }
  for (const a of opts.actions) {
    if (a.type === 'ADD_WORLD_NPC' && !opts.npcs.some((n) => n.name === a.npc.name)) {
      return {
        prompt: style + `Retrato de ${a.npc.name}: ${a.npc.description}`.replace(/\s+/g, ' ').slice(0, 220),
        mark: { type: 'MARK_NPC_IMAGE', name: a.npc.name },
      }
    }
  }

  const isMoment =
    opts.transition === 'generation-complete' ||
    opts.transition === 'quest-complete' ||
    opts.actions.some((a) => a.type === 'SET_LEVEL') ||
    opts.actions.some((a) => a.type === 'ADD_JOURNAL_ENTRY' && a.entry.eventType === 'milestone') ||
    (opts.actions.some((a) => a.type === 'SET_COMBAT_ACTIVE' && a.active === false) &&
      opts.actions.some((a) => a.type === 'INCREMENT_STAT' && a.stat === 'enemiesDefeated'))
  if (isMoment && opts.sceneText.trim()) {
    return { prompt: scenePrompt(opts.sceneText, style) }
  }
  return null
}

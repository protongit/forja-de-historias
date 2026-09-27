import type { GameState, GameAction } from '../../types/game'

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
}

// Resuelve una entidad por nombre tolerando variaciones del modelo:
// exacto → contiene → solapamiento de tokens → único elemento.
function resolveByName<T extends { name: string }>(items: T[], name: string): T | undefined {
  const target = normalizeName(name)
  if (!target) return undefined

  const exact = items.find((i) => normalizeName(i.name) === target)
  if (exact) return exact

  const contains = items.find((i) => {
    const n = normalizeName(i.name)
    return n.includes(target) || target.includes(n)
  })
  if (contains) return contains

  const targetTokens = target.split(/\s+/).filter((t) => t.length >= 3)
  if (targetTokens.length > 0) {
    let best: { item: T; score: number } | undefined
    for (const item of items) {
      const tokens = new Set(normalizeName(item.name).split(/\s+/).filter((t) => t.length >= 3))
      let score = 0
      for (const t of targetTokens) if (tokens.has(t)) score++
      if (score > 0 && (!best || score > best.score)) best = { item, score }
    }
    if (best) return best.item
  }

  if (items.length === 1) return items[0]
  return undefined
}

export function combatReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_COMBAT_MODE':
      return { ...state, combatMode: action.mode }
    case 'SET_COMBAT_ACTIVE':
      return { ...state, combatActive: action.active }
    case 'SET_COMBAT_TURN':
      return { ...state, combatTurn: action.turn }
    case 'SET_ENEMIES':
      return { ...state, enemies: action.enemies }
    case 'UPDATE_ENEMY': {
      const target = resolveByName(state.enemies, action.name)
      if (!target) return state
      return {
        ...state,
        enemies: state.enemies.map((e) =>
          e === target ? { ...e, ...action.updates } : e
        ),
      }
    }
    case 'ADD_XP':
      return {
        ...state,
        xp: state.xp + action.amount,
        gameStats: { ...state.gameStats, xpEarned: state.gameStats.xpEarned + action.amount },
      }
    case 'SET_LEVEL':
      return action.level > state.level
        ? {
            ...state,
            level: action.level,
            gameStats: { ...state.gameStats, levelsGained: state.gameStats.levelsGained + 1 },
          }
        : { ...state, level: action.level }
    case 'ADD_COMPANION':
      return state.companions.find((c) => c.name === action.companion.name)
        ? state
        : { ...state, companions: [...state.companions, action.companion] }
    case 'REMOVE_COMPANION':
      return { ...state, companions: state.companions.filter((c) => c.name !== action.name) }
    case 'SET_COMPANION_ACTIVE':
      return {
        ...state,
        companions: state.companions.map((c) =>
          c.name === action.name ? { ...c, isActive: action.active } : c
        ),
      }
    case 'UPDATE_PLAYER_HP': {
      if (!state.character) return state
      const currentMaxHp = action.maxHp ?? state.character.maxHp
      const newHp = Math.max(0, Math.min(state.character.hp + action.delta, currentMaxHp))
      return {
        ...state,
        character: {
          ...state.character,
          hp: newHp,
          maxHp: currentMaxHp,
        },
      }
    }
    case 'SET_PLAYER_HP':
      return state.character
        ? {
            ...state,
            character: {
              ...state.character,
              hp: Math.max(0, Math.min(action.hp, action.maxHp)),
              maxHp: action.maxHp,
            },
          }
        : state

    default:
      return state
  }
}

import type { GameState, GameAction } from '../../types/game'

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
    case 'ADD_ENEMY':
      return state.enemies.find((e) => e.name === action.enemy.name)
        ? state
        : { ...state, enemies: [...state.enemies, action.enemy] }
    case 'UPDATE_ENEMY': {
      return {
        ...state,
        enemies: state.enemies.map((e) =>
          e.name === action.name ? { ...e, ...action.updates } : e
        ),
      }
    }
    case 'REMOVE_ENEMY':
      return { ...state, enemies: state.enemies.filter((e) => e.name !== action.name) }
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
    case 'SET_COMPANIONS':
      return { ...state, companions: action.companions }
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

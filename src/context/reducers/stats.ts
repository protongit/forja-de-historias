import type { GameState, GameAction } from '../../types/game'

export function statsReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_STATS_SESSION_ID':
      return { ...state, statsSessionId: action.id }
    case 'SET_ADVENTURE_RESULT':
      return { ...state, gameStats: { ...state.gameStats, adventureResult: action.result } }
    case 'INCREMENT_STAT':
      return { ...state, gameStats: { ...state.gameStats, [action.stat]: (state.gameStats[action.stat] as number) + 1 } }
    case 'UPDATE_STATS_BATCH':
      return { ...state, gameStats: { ...state.gameStats, ...action.stats } }

    default:
      return state
  }
}

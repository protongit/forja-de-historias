import type { GameState, GameAction } from '../types/game'
import { coreReducer } from './reducers/core'
import { combatReducer } from './reducers/combat'
import { worldReducer } from './reducers/world'
import { statsReducer } from './reducers/stats'

export { initialState, initialStats, initialWorldState } from './initialState'

export function gameReducer(state: GameState, action: GameAction): GameState {
  return statsReducer(worldReducer(combatReducer(coreReducer(state, action), action), action), action)
}

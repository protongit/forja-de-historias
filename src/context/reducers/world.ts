import type { GameState, GameAction } from '../../types/game'

export function worldReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'ADD_JOURNAL_ENTRY':
      return { ...state, journal: [...state.journal, action.entry] }
    case 'COMPLETE_OBJECTIVE':
      if (!state.quest) return state
      return {
        ...state,
        quest: {
          ...state.quest,
          objectives: state.quest.objectives.map((o) =>
            o.name === action.name ? { ...o, completed: true } : o
          ),
        },
      }
    case 'ADD_OBJECTIVE':
      if (!state.quest) return state
      return {
        ...state,
        quest: {
          ...state.quest,
          objectives: [...state.quest.objectives, action.objective],
        },
      }
    case 'SET_CURRENT_LOCATION':
      return { ...state, worldState: { ...state.worldState, currentLocation: action.name } }
    case 'ADD_LOCATION':
      return state.worldState.locations.find((l) => l.name === action.location.name)
        ? state
        : { ...state, worldState: { ...state.worldState, locations: [...state.worldState.locations, action.location] } }
    case 'ADD_WORLD_NPC':
      return state.worldState.npcs.find((n) => n.name === action.npc.name)
        ? state
        : { ...state, worldState: { ...state.worldState, npcs: [...state.worldState.npcs, action.npc] } }
    case 'UPDATE_WORLD_NPC':
      return {
        ...state,
        worldState: {
          ...state.worldState,
          npcs: state.worldState.npcs.map((n) =>
            n.name === action.name ? { ...n, ...action.updates } : n
          ),
        },
      }
    case 'REMOVE_WORLD_NPC':
      return { ...state, worldState: { ...state.worldState, npcs: state.worldState.npcs.filter((n) => n.name !== action.name) } }
    case 'MARK_LOCATION_IMAGE':
      return {
        ...state,
        worldState: {
          ...state.worldState,
          locations: state.worldState.locations.map((l) =>
            l.name === action.name ? { ...l, hasImage: true } : l
          ),
        },
      }
    case 'MARK_NPC_IMAGE':
      return {
        ...state,
        worldState: {
          ...state.worldState,
          npcs: state.worldState.npcs.map((n) =>
            n.name === action.name ? { ...n, hasImage: true } : n
          ),
        },
      }
    case 'SET_TIME_OF_DAY':
      return { ...state, worldState: { ...state.worldState, timeOfDay: action.time } }
    case 'SET_WEATHER':
      return { ...state, worldState: { ...state.worldState, weather: action.weather } }
    case 'TOGGLE_FAVORITE_JOURNAL':
      return {
        ...state,
        journal: state.journal.map((j) =>
          j.id === action.id ? { ...j, isFavorite: !j.isFavorite } : j
        ),
      }

    default:
      return state
  }
}

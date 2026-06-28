import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react'
import type { GameState, GameAction, GameStats, WorldState } from '../types/game'
import { getCurrentUser } from '../services/authService'

const initialWorldState: WorldState = {
  currentLocation: null,
  timeOfDay: 'mañana',
  weather: null,
  locations: [],
  npcs: [],
}

const initialStats: GameStats = {
  messagesSent: 0,
  diceRolls: 0,
  diceSuccesses: 0,
  diceFailures: 0,
  enemiesDefeated: 0,
  timePlayedMs: 0,
  xpEarned: 0,
  levelsGained: 0,
  imagesGenerated: 0,
  adventureResult: null,
}

const initialState: GameState = {
  phase: 'config',
  aiConfig: {
    endpoint: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    temperature: 0.8,
  },
  imageConfig: {
    enabled: false,
    endpoint: '',
    apiKey: '',
    model: 'flux-2-klein',
    size: '1024x1024',
  },
  tts: {
    enabled: false,
    mode: 'browser',
    endpoint: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'tts-1',
    voice: '',
    rate: 1,
    pitch: 1,
    autoPlay: false,
    emotion: 'neutral',
  },
  messages: [],
  character: null,
  quest: null,
  setupAnswers: {},
  aiModelInfo: '',
  error: null,
  isWaitingAI: false,
  isEphemeral: true,
  currentUser: getCurrentUser(),
  inventory: [],
  notes: '',
  rawLog: [],
  showLog: false,
  pendingDiceCheck: null,
  diceAutoRoll: true,

  combatMode: 'narrative',
  combatActive: false,
  combatTurn: 0,
  enemies: [],
  xp: 0,
  level: 1,
  companions: [],
  journal: [],
  worldState: initialWorldState,
  gameStats: initialStats,
  notifications: [],
  adventureName: '',
  statsSessionId: null,
  saves: [],
  currentSaveSlot: null,
}

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_PHASE':
      return { ...state, phase: action.phase }
    case 'SET_AI_CONFIG':
      return { ...state, aiConfig: action.config }
    case 'SET_IMAGE_CONFIG':
      return { ...state, imageConfig: action.config }
    case 'SET_TTS_CONFIG':
      return { ...state, tts: action.config }
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] }
    case 'SET_CHARACTER':
      return { ...state, character: action.character }
    case 'SET_QUEST':
      return { ...state, quest: action.quest }
    case 'SET_SETUP_ANSWERS':
      return { ...state, setupAnswers: action.answers }
    case 'SET_AI_MODEL_INFO':
      return { ...state, aiModelInfo: action.info }
    case 'SET_ERROR':
      return { ...state, error: action.error }
    case 'SET_WAITING_AI':
      return { ...state, isWaitingAI: action.waiting }
    case 'SET_EPHEMERAL':
      return { ...state, isEphemeral: action.ephemeral }
    case 'SET_USER':
      return { ...state, currentUser: action.username }
    case 'ADD_ITEM':
      return state.inventory.includes(action.item)
        ? state
        : { ...state, inventory: [...state.inventory, action.item] }
    case 'REMOVE_ITEM':
      return { ...state, inventory: state.inventory.filter((i) => i !== action.item) }
    case 'SET_INVENTORY':
      return { ...state, inventory: action.inventory }
    case 'SET_NOTES':
      return { ...state, notes: action.notes }
    case 'ADD_LOG_ENTRY':
      return { ...state, rawLog: [...state.rawLog, action.entry] }
    case 'TOGGLE_LOG':
      return { ...state, showLog: !state.showLog }
    case 'LOAD_STATE': {
      const loaded = { ...action.state, currentUser: state.currentUser }
      if (loaded.quest?.objectives?.length && typeof loaded.quest.objectives[0] === 'string') {
        loaded.quest = {
          ...loaded.quest,
          objectives: (loaded.quest.objectives as unknown as string[]).map((o) => ({ name: o, completed: false })),
        }
      }
      return loaded
    }
    case 'RESET':
      return { ...initialState, currentUser: state.currentUser }
    case 'SET_DICE_CHECK':
      return { ...state, pendingDiceCheck: action.check }
    case 'SET_DICE_RESULT':
      return state.pendingDiceCheck
        ? {
            ...state,
            pendingDiceCheck: {
              ...state.pendingDiceCheck,
              result: action.result,
              success: action.success,
              resolved: true,
            },
          }
        : state
    case 'SET_DICE_AUTO_ROLL':
      return { ...state, diceAutoRoll: action.autoRoll }

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
    case 'SET_TIME_OF_DAY':
      return { ...state, worldState: { ...state.worldState, timeOfDay: action.time } }
    case 'SET_WEATHER':
      return { ...state, worldState: { ...state.worldState, weather: action.weather } }
    case 'REPLACE_MESSAGES_WITH_SUMMARY':
      return {
        ...state,
        messages: [action.summaryMessage, ...state.messages.slice(action.keepFromIndex)],
      }
    case 'INCREMENT_STAT':
      return { ...state, gameStats: { ...state.gameStats, [action.stat]: (state.gameStats[action.stat] as number) + 1 } }
    case 'UPDATE_STATS_BATCH':
      return { ...state, gameStats: { ...state.gameStats, ...action.stats } }
    case 'DELETE_MESSAGE':
      return { ...state, messages: state.messages.filter((m) => m.id !== action.id) }
    case 'UPDATE_MESSAGE_CONTENT':
      return { ...state, messages: state.messages.map((m) => m.id === action.id ? { ...m, content: action.content } : m) }
    case 'APPEND_MESSAGE_CONTENT':
      return { ...state, messages: state.messages.map((m) => m.id === action.id ? { ...m, content: m.content + '\n\n' + action.content } : m) }
    case 'SET_ADVENTURE_NAME':
      return { ...state, adventureName: action.name }
    case 'SET_SAVES':
      return { ...state, saves: action.saves }
    case 'SET_CURRENT_SAVE_SLOT':
      return { ...state, currentSaveSlot: action.slot }
    case 'TTS_SET_EMOTION':
      return { ...state, tts: { ...state.tts, emotion: action.emotion } }
    case 'SET_STATS_SESSION_ID':
      return { ...state, statsSessionId: action.id }
    case 'SET_ADVENTURE_RESULT':
      return { ...state, gameStats: { ...state.gameStats, adventureResult: action.result } }
    case 'TOGGLE_FAVORITE_JOURNAL':
      return {
        ...state,
        journal: state.journal.map((j) =>
          j.id === action.id ? { ...j, isFavorite: !j.isFavorite } : j
        ),
      }
    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [...state.notifications, action.notification] }
    case 'DISMISS_NOTIFICATION':
      return { ...state, notifications: state.notifications.filter((n) => n.id !== action.id) }
    case 'DISMISS_ALL_NOTIFICATIONS':
      return { ...state, notifications: [] }
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

interface GameContextValue {
  state: GameState
  dispatch: React.Dispatch<GameAction>
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState)
  const value = useMemo(() => ({ state, dispatch }), [state, dispatch])
  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  )
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}

export { gameReducer, initialState, initialStats }

import type { GameState, GameAction } from '../../types/game'
import { computeKeepFromIndex } from '../../utils/contextSummarizer'
import { initialState } from '../initialState'

export function coreReducer(state: GameState, action: GameAction): GameState {
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
    case 'SET_CONFIGS_RESTORED':
      return { ...state, configsRestored: action.restored }
    case 'ADD_ITEM':
      return state.inventory.includes(action.item)
        ? state
        : { ...state, inventory: [...state.inventory, action.item] }
    case 'REMOVE_ITEM':
      return { ...state, inventory: state.inventory.filter((i) => i !== action.item) }
    case 'SET_NOTES':
      return { ...state, notes: action.notes }
    case 'ADD_LOG_ENTRY': {
      const rawLog = [...state.rawLog, action.entry]
      // Cota para no crecer sin límite (ni saturar localStorage en el autosave)
      return { ...state, rawLog: rawLog.length > 50 ? rawLog.slice(-50) : rawLog }
    }
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
    case 'RESTORE_STATE':
      return { ...state, ...action.snapshot }
    case 'RESET':
      return { ...initialState, currentUser: state.currentUser }
    case 'DELETE_MESSAGE':
      return { ...state, messages: state.messages.filter((m) => m.id !== action.id) }
    case 'UPDATE_MESSAGE_CONTENT':
      return { ...state, messages: state.messages.map((m) => m.id === action.id ? { ...m, content: action.content } : m) }
    case 'APPEND_MESSAGE_CONTENT':
      return { ...state, messages: state.messages.map((m) => m.id === action.id ? { ...m, content: m.content + '\n\n' + action.content } : m) }
    case 'COMPACT_MESSAGES': {
      const msgs = state.messages
      if (msgs.length <= 10) return state
      const keepFromIndex = computeKeepFromIndex(msgs)
      return {
        ...state,
        messages: [action.summaryMessage, ...msgs.slice(keepFromIndex)],
      }
    }
    case 'SET_ADVENTURE_NAME':
      return { ...state, adventureName: action.name }
    case 'SET_SAVES':
      return { ...state, saves: action.saves }
    case 'SET_CURRENT_SAVE_SLOT':
      return { ...state, currentSaveSlot: action.slot }
    case 'SET_DICE_CHECK':
      return { ...state, pendingDiceCheck: action.check }
    case 'SET_DICE_AUTO_ROLL':
      return { ...state, diceAutoRoll: action.autoRoll }
    case 'TTS_SET_EMOTION':
      return { ...state, tts: { ...state.tts, emotion: action.emotion } }
    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [...state.notifications, action.notification] }
    case 'DISMISS_NOTIFICATION':
      return { ...state, notifications: state.notifications.filter((n) => n.id !== action.id) }
    case 'DISMISS_ALL_NOTIFICATIONS':
      return { ...state, notifications: [] }

    default:
      return state
  }
}

export type GamePhase = 'config' | 'setup' | 'generation' | 'playing' | 'completed'

export type MessageSender = 'player' | 'gm' | 'system'

export type CombatMode = 'tactical' | 'narrative'

export type TTSMode = 'browser' | 'external'

export type TTSVoiceEmotion = 'neutral' | 'grave' | 'alegre' | 'epico' | 'misterioso' | 'susurro' | 'terrorifico'

export type JournalEventType = 'discovery' | 'encounter' | 'dialog' | 'achievement' | 'milestone'

export interface MessageAttachment {
  type: 'image' | 'document' | 'audio'
  url?: string
  data?: string // base64
  name: string
  mimeType: string
}

export interface Message {
  id: string
  sender: MessageSender
  content: string
  timestamp: number
  attachments?: MessageAttachment[]
}

export interface AIConfig {
  endpoint: string
  apiKey: string
  model: string
  temperature: number
}

export interface ImageConfig {
  enabled: boolean
  endpoint: string
  apiKey: string
  model: string
  size: string
}

export interface TTSConfig {
  enabled: boolean
  mode: TTSMode
  endpoint: string
  apiKey: string
  model: string
  voice: string
  rate: number
  pitch: number
  autoPlay: boolean
  emotion: TTSVoiceEmotion
}

export interface CharacterStat {
  name: string
  value: number
}

export interface CharacterSkill {
  name: string
  description: string
}

export interface Character {
  name: string
  background: string
  traits: string[]
  equipment: string[]
  stats: CharacterStat[]
  skills: CharacterSkill[]
  hp: number
  maxHp: number
}

export interface QuestObjective {
  name: string
  completed: boolean
}

export interface Quest {
  title: string
  description: string
  objectives: QuestObjective[]
}

export interface DiceCheck {
  stat: string
  dc: number
  dice: string
  bonus?: number
  result?: number
  success?: boolean
  resolved: boolean
}

export interface Enemy {
  name: string
  hp: number
  maxHp: number
  ac: number
  isAlive: boolean
  description: string
}

export interface Companion {
  name: string
  description: string
  stats: CharacterStat[]
  isActive: boolean
}

export interface JournalEntry {
  id: string
  title: string
  summary: string
  timestamp: number
  location?: string
  eventType: JournalEventType
  isFavorite: boolean
}

export interface WorldLocation {
  name: string
  description: string
  discovered: boolean
  exits: string[]
}

export interface WorldNPC {
  name: string
  description: string
  location: string
  isAlive: boolean
  relationship: number
  attitude: number
}

export interface WorldState {
  currentLocation: string | null
  timeOfDay: 'amanecer' | 'mañana' | 'tarde' | 'atardecer' | 'noche'
  weather: string | null
  locations: WorldLocation[]
  npcs: WorldNPC[]
}

export interface GameStats {
  messagesSent: number
  diceRolls: number
  diceSuccesses: number
  diceFailures: number
  enemiesDefeated: number
  timePlayedMs: number
  xpEarned: number
  levelsGained: number
  imagesGenerated: number
  adventureResult: 'success' | 'failure' | null
}

export interface GameNotification {
  id: string
  type: 'xp' | 'levelup' | 'item' | 'damage' | 'heal' | 'quest' | 'system'
  message: string
  timestamp: number
}

export interface RawLogEntry {
  timestamp: number
  playerMessage: string
  rawResponse: string
  cleanedResponse: string
  phase: string
}

export interface GameState {
  phase: GamePhase
  aiConfig: AIConfig
  imageConfig: ImageConfig
  tts: TTSConfig
  messages: Message[]
  character: Character | null
  quest: Quest | null
  setupAnswers: Record<string, string>
  aiModelInfo: string
  error: string | null
  isWaitingAI: boolean
  isEphemeral: boolean
  currentUser: string | null
  inventory: string[]
  notes: string
  rawLog: RawLogEntry[]
  showLog: boolean
  pendingDiceCheck: DiceCheck | null
  diceAutoRoll: boolean

  combatMode: CombatMode
  combatActive: boolean
  combatTurn: number
  enemies: Enemy[]
  xp: number
  level: number
  companions: Companion[]
  journal: JournalEntry[]
  worldState: WorldState
  gameStats: GameStats
  notifications: GameNotification[]
  adventureName: string
  statsSessionId: string | null

  // Available save slots
  saves: string[]
  currentSaveSlot: string | null
}

export interface SaveData {
  version: number
  savedAt: number
  state: GameState
}

export type GameAction =
  | { type: 'SET_PHASE'; phase: GamePhase }
  | { type: 'SET_AI_CONFIG'; config: AIConfig }
  | { type: 'SET_IMAGE_CONFIG'; config: ImageConfig }
  | { type: 'SET_TTS_CONFIG'; config: TTSConfig }
  | { type: 'ADD_MESSAGE'; message: Message }
  | { type: 'SET_CHARACTER'; character: Character }
  | { type: 'SET_QUEST'; quest: Quest }
  | { type: 'SET_SETUP_ANSWERS'; answers: Record<string, string> }
  | { type: 'SET_AI_MODEL_INFO'; info: string }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_WAITING_AI'; waiting: boolean }
  | { type: 'SET_EPHEMERAL'; ephemeral: boolean }
  | { type: 'SET_USER'; username: string | null }
  | { type: 'LOAD_STATE'; state: GameState }
  | { type: 'RESET' }
  | { type: 'ADD_ITEM'; item: string }
  | { type: 'REMOVE_ITEM'; item: string }
  | { type: 'SET_INVENTORY'; inventory: string[] }
  | { type: 'SET_NOTES'; notes: string }
  | { type: 'ADD_LOG_ENTRY'; entry: RawLogEntry }
  | { type: 'TOGGLE_LOG' }
  | { type: 'SET_DICE_CHECK'; check: DiceCheck | null }
  | { type: 'SET_DICE_RESULT'; result: number; success: boolean }
  | { type: 'SET_DICE_AUTO_ROLL'; autoRoll: boolean }
  | { type: 'SET_COMBAT_MODE'; mode: CombatMode }
  | { type: 'SET_COMBAT_ACTIVE'; active: boolean }
  | { type: 'SET_COMBAT_TURN'; turn: number }
  | { type: 'SET_ENEMIES'; enemies: Enemy[] }
  | { type: 'ADD_ENEMY'; enemy: Enemy }
  | { type: 'UPDATE_ENEMY'; name: string; updates: Partial<Enemy> }
  | { type: 'REMOVE_ENEMY'; name: string }
  | { type: 'ADD_XP'; amount: number }
  | { type: 'SET_LEVEL'; level: number }
  | { type: 'SET_COMPANIONS'; companions: Companion[] }
  | { type: 'ADD_COMPANION'; companion: Companion }
  | { type: 'REMOVE_COMPANION'; name: string }
  | { type: 'SET_COMPANION_ACTIVE'; name: string; active: boolean }
  | { type: 'ADD_JOURNAL_ENTRY'; entry: JournalEntry }
  | { type: 'COMPLETE_OBJECTIVE'; name: string }
  | { type: 'ADD_OBJECTIVE'; objective: QuestObjective }
  | { type: 'SET_CURRENT_LOCATION'; name: string }
  | { type: 'ADD_LOCATION'; location: WorldLocation }
  | { type: 'ADD_WORLD_NPC'; npc: WorldNPC }
  | { type: 'UPDATE_WORLD_NPC'; name: string; updates: Partial<WorldNPC> }
  | { type: 'REMOVE_WORLD_NPC'; name: string }
  | { type: 'SET_TIME_OF_DAY'; time: WorldState['timeOfDay'] }
  | { type: 'SET_WEATHER'; weather: string | null }
  | { type: 'REPLACE_MESSAGES_WITH_SUMMARY'; summaryMessage: Message; keepFromIndex: number }
  | { type: 'INCREMENT_STAT'; stat: keyof GameStats }
  | { type: 'UPDATE_STATS_BATCH'; stats: Partial<GameStats> }
  | { type: 'DELETE_MESSAGE'; id: string }
  | { type: 'UPDATE_MESSAGE_CONTENT'; id: string; content: string }
  | { type: 'APPEND_MESSAGE_CONTENT'; id: string; content: string }
  | { type: 'SET_ADVENTURE_NAME'; name: string }
  | { type: 'SET_SAVES'; saves: string[] }
  | { type: 'SET_CURRENT_SAVE_SLOT'; slot: string | null }
  | { type: 'TTS_SET_EMOTION'; emotion: TTSVoiceEmotion }
  | { type: 'SET_STATS_SESSION_ID'; id: string | null }
  | { type: 'SET_ADVENTURE_RESULT'; result: 'success' | 'failure' | null }
  | { type: 'TOGGLE_FAVORITE_JOURNAL'; id: string }
  | { type: 'ADD_NOTIFICATION'; notification: GameNotification }
  | { type: 'DISMISS_NOTIFICATION'; id: string }
  | { type: 'DISMISS_ALL_NOTIFICATIONS' }
  | { type: 'UPDATE_PLAYER_HP'; delta: number; maxHp?: number }
  | { type: 'SET_PLAYER_HP'; hp: number; maxHp: number }

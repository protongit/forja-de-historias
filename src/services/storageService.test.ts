import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { saveGame, loadGame, deleteSave, listSaveSlots, exportGameToJSON } from './storageService'
import type { GameState, Message } from '../types/game'

// In-memory localStorage stub for isolation
const store = new Map<string, string>()
const localStorageStub = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  get length() {
    return store.size
  },
}

beforeAll(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true })
})

function baseState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: 'playing',
    aiConfig: { endpoint: '', apiKey: '', model: '', temperature: 0.8 },
    imageConfig: { enabled: false, endpoint: '', apiKey: '', model: '', size: '' },
    tts: { enabled: false, mode: 'browser', endpoint: '', apiKey: '', model: '', voice: '', rate: 1, pitch: 1, autoPlay: false, emotion: 'neutral' },
    messages: [],
    character: null,
    quest: null,
    setupAnswers: {},
    aiModelInfo: '',
    error: null,
    isWaitingAI: false,
    isEphemeral: true,
    currentUser: 'tester',
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
    worldState: { currentLocation: null, timeOfDay: 'mañana', weather: null, locations: [], npcs: [] },
    gameStats: {
      messagesSent: 0, diceRolls: 0, diceSuccesses: 0, diceFailures: 0, enemiesDefeated: 0,
      timePlayedMs: 0, xpEarned: 0, levelsGained: 0, imagesGenerated: 0, adventureResult: null,
    },
    notifications: [],
    adventureName: 'Prueba',
    statsSessionId: null,
    saves: [],
    currentSaveSlot: null,
    ...overrides,
  }
}

function msgWithAttachment(): Message {
  return {
    id: crypto.randomUUID(),
    sender: 'player',
    content: 'mira esta imagen',
    timestamp: Date.now(),
    attachments: [{ type: 'image', data: 'A'.repeat(1000), mimeType: 'image/png', name: 'img.png' }],
  }
}

describe('saveGame / loadGame', () => {
  it('guarda y carga un estado', () => {
    const state = baseState({ level: 5 })
    saveGame(state, 'tester', 'slot1')
    const loaded = loadGame('tester', 'slot1')
    expect(loaded?.level).toBe(5)
    expect(loaded?.currentUser).toBe('tester')
  })

  it('devuelve null si el slot no existe', () => {
    expect(loadGame('tester', 'no-existe')).toBeNull()
  })

  it('elimina un slot', () => {
    saveGame(baseState(), 'tester', 'borrable')
    deleteSave('tester', 'borrable')
    expect(loadGame('tester', 'borrable')).toBeNull()
    expect(listSaveSlots('tester').some((s) => s.name === 'borrable')).toBe(false)
  })

  it('lanza error descriptivo si localStorage falla', () => {
    const broken = { ...localStorageStub, setItem: () => { throw new Error('QuotaExceeded') } }
    Object.defineProperty(globalThis, 'localStorage', { value: broken, configurable: true })
    expect(() => saveGame(baseState(), 'tester', 'roto')).toThrow('almacenamiento')
    Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true })
  })
})

describe('stripAttachments', () => {
  it('no persiste los adjuntos base64', () => {
    const state = baseState({ messages: [msgWithAttachment()] })
    saveGame(state, 'tester', 'con-img')
    const raw = localStorageStub.getItem('rol-tester-save-con-img') as string
    expect(raw).not.toContain('AAAA')
    const loaded = loadGame('tester', 'con-img')
    expect(loaded?.messages[0].attachments).toBeUndefined()
    expect(loaded?.messages[0].content).toBe('mira esta imagen')
  })
})

describe('migración de versiones', () => {
  it('acepta saves de versiones anteriores', () => {
    localStorageStub.setItem('rol-tester-save-viejo', JSON.stringify({ version: 0, savedAt: Date.now(), state: baseState() }))
    const loaded = loadGame('tester', 'viejo')
    expect(loaded?.phase).toBe('playing')
  })

  it('rechaza saves de versiones futuras', () => {
    localStorageStub.setItem('rol-tester-save-futuro', JSON.stringify({ version: 999, savedAt: Date.now(), state: baseState() }))
    expect(loadGame('tester', 'futuro')).toBeNull()
  })

  it('devuelve null ante JSON corrupto', () => {
    localStorageStub.setItem('rol-tester-save-corrupto', '{not json')
    expect(loadGame('tester', 'corrupto')).toBeNull()
  })
})

describe('exportGameToJSON', () => {
  it('genera y descarga un JSON válido', () => {
    const clicks: number[] = []
    const origCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag)
      if (tag === 'a') el.click = () => clicks.push(1)
      return el
    })
    const origCreateURL = URL.createObjectURL
    URL.createObjectURL = () => 'blob:test'

    exportGameToJSON(baseState(), 'export-test')

    expect(clicks).toHaveLength(1)
    URL.createObjectURL = origCreateURL
    vi.restoreAllMocks()
  })
})

afterAll(() => store.clear())

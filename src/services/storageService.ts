import type { GameState, SaveData } from '../types/game'
import { userDataKey } from './authService'

const SAVE_VERSION = 2

export const AUTO_SAVE_SLOT = 'autosave'

function slotKey(username: string | null, slot: string): string {
  return username ? userDataKey(username, `save-${slot}`) : `forja-de-historias-save-${slot}`
}

const SAVE_INDEX_KEY = (u: string | null) => (u ? userDataKey(u, 'save-index') : 'forja-de-historias-save-index')

export interface SaveSlot {
  name: string
  adventureName: string
  level: number
  savedAt: number
  phase: string
}

export function listSaveSlots(username: string | null): SaveSlot[] {
  try {
    const raw = localStorage.getItem(SAVE_INDEX_KEY(username))
    const names: string[] = raw ? JSON.parse(raw) : []
    return names
      .map((name) => {
        try {
          const raw2 = localStorage.getItem(slotKey(username, name))
          if (!raw2) return null
          const sd: SaveData = JSON.parse(raw2)
          return {
            name,
            adventureName: sd.state.adventureName || sd.state.quest?.title || 'Sin nombre',
            level: sd.state.level || 1,
            savedAt: sd.savedAt || Date.now(),
            phase: (sd.state.phase || 'unknown') as string,
          }
        } catch {
          return null
        }
      })
      .filter(Boolean) as SaveSlot[]
  } catch {
    return []
  }
}

function updateIndex(username: string | null, names: string[]) {
  localStorage.setItem(SAVE_INDEX_KEY(username), JSON.stringify(names))
  notifySaveChange()
}

const saveListeners = new Set<() => void>()
let storageHookInstalled = false

function notifySaveChange() {
  for (const listener of [...saveListeners]) listener()
}

export function subscribeSaveChanges(listener: () => void): () => void {
  saveListeners.add(listener)
  if (!storageHookInstalled && typeof window !== 'undefined') {
    storageHookInstalled = true
    window.addEventListener('storage', notifySaveChange)
  }
  return () => {
    saveListeners.delete(listener)
  }
}

// Attachments are base64 blobs that can blow up the localStorage quota — never persist them
function stripAttachments(state: GameState): GameState {
  if (!state.messages?.some((m) => m.attachments?.length)) return state
  return {
    ...state,
    messages: state.messages.map((m) => (m.attachments?.length ? ({ ...m, attachments: undefined } as typeof m) : m)),
  }
}

// Per-version state migrations. Key = version being migrated FROM.
const MIGRATORS: Record<number, (state: GameState) => GameState> = {
  // v1 → v2: worldState.locations/npcs ahora incluyen hasImage (cobertura de imágenes)
  1: (state) => ({
    ...state,
    worldState: {
      ...state.worldState,
      locations: (state.worldState?.locations ?? []).map((l) => ({ ...l, hasImage: l.hasImage ?? false })),
      npcs: (state.worldState?.npcs ?? []).map((n) => ({ ...n, hasImage: n.hasImage ?? false })),
    },
  }),
}

function migrateState(version: number, state: GameState): GameState {
  let migrated = state
  for (let v = version; v < SAVE_VERSION; v++) {
    const migrator = MIGRATORS[v]
    if (migrator) migrated = migrator(migrated)
  }
  return migrated
}

function readIndex(username: string | null): string[] {
  try {
    const raw = localStorage.getItem(SAVE_INDEX_KEY(username))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveGame(state: GameState, username: string | null, slot?: string): void {
  const name = slot || 'default'
  const saveData: SaveData = { version: SAVE_VERSION, savedAt: Date.now(), state: stripAttachments(state) }
  try {
    localStorage.setItem(slotKey(username, name), JSON.stringify(saveData))
  } catch {
    throw new Error('No se pudo guardar: almacenamiento lleno o no disponible')
  }
  notifySaveChange()
  const names = readIndex(username)
  if (!names.includes(name)) {
    names.push(name)
    updateIndex(username, names)
  }
}

export function loadGame(username: string | null, slot?: string): GameState | null {
  try {
    const name = slot || 'default'
    const raw = localStorage.getItem(slotKey(username, name))
    if (!raw) return null
    const saveData: SaveData = JSON.parse(raw)
    if (typeof saveData?.version !== 'number' || !saveData?.state?.phase) return null
    if (saveData.version > SAVE_VERSION) {
      console.warn(`Partida guardada con versión ${saveData.version} (actual: ${SAVE_VERSION}). Actualiza la aplicación.`)
      return null
    }
    return migrateState(saveData.version, saveData.state)
  } catch {
    return null
  }
}

export function deleteSave(username: string | null, slot?: string): void {
  const name = slot || 'default'
  localStorage.removeItem(slotKey(username, name))
  const names = readIndex(username)
  const filtered = names.filter((n) => n !== name)
  updateIndex(username, filtered)
}

export function hasSave(username: string | null, slot?: string): boolean {
  if (slot) return localStorage.getItem(slotKey(username, slot)) !== null
  return readIndex(username).some((name) => localStorage.getItem(slotKey(username, name)) !== null)
}

export function exportGameToJSON(state: GameState, slot?: string): void {
  const saveData: SaveData = { version: SAVE_VERSION, savedAt: Date.now(), state }
  const blob = new Blob([JSON.stringify(saveData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `forja-de-historias-${slot || 'export'}-${Date.now()}.json`
  a.click()
  // Revocar en el siguiente tick: algunos navegadores cancelan la descarga si se revoca de inmediato
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const MAX_IMPORT_BYTES = 20 * 1024 * 1024

export function importGameFromJSON(file: File): Promise<GameState> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_IMPORT_BYTES) {
      reject(new Error('El archivo es demasiado grande (máx. 20 MB)'))
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const saveData: SaveData = JSON.parse(e.target?.result as string)
        if (!saveData.state || !saveData.state.phase) {
          reject(new Error('Archivo de guardado inválido'))
          return
        }
        const version = typeof saveData.version === 'number' ? saveData.version : 1
        if (version > SAVE_VERSION) {
          reject(new Error('El guardado es de una versión más reciente. Actualiza la aplicación.'))
          return
        }
        resolve(migrateState(version, saveData.state))
      } catch {
        reject(new Error('Archivo JSON inválido'))
      }
    }
    reader.onerror = () => reject(new Error('Error al leer el archivo'))
    reader.readAsText(file)
  })
}
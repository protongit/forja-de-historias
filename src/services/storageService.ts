import type { GameState, SaveData } from '../types/game'
import { userDataKey } from './authService'

const SAVE_VERSION = 1

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
}

export function saveGame(state: GameState, username: string | null, slot?: string): void {
  const name = slot || 'default'
  const saveData: SaveData = { version: SAVE_VERSION, savedAt: Date.now(), state }
  localStorage.setItem(slotKey(username, name), JSON.stringify(saveData))
  const raw = localStorage.getItem(SAVE_INDEX_KEY(username))
  const names: string[] = raw ? JSON.parse(raw) : []
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
    if (saveData.version !== SAVE_VERSION) return null
    return saveData.state
  } catch {
    return null
  }
}

export function deleteSave(username: string | null, slot?: string): void {
  const name = slot || 'default'
  localStorage.removeItem(slotKey(username, name))
  const raw = localStorage.getItem(SAVE_INDEX_KEY(username))
  const names: string[] = raw ? JSON.parse(raw) : []
  const filtered = names.filter((n) => n !== name)
  updateIndex(username, filtered)
}

export function hasSave(username: string | null): boolean {
  return localStorage.getItem(slotKey(username, 'default')) !== null
}

export function exportGameToJSON(state: GameState, slot?: string): void {
  const saveData: SaveData = { version: SAVE_VERSION, savedAt: Date.now(), state }
  const blob = new Blob([JSON.stringify(saveData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `forja-de-historias-${slot || 'export'}-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importGameFromJSON(file: File): Promise<GameState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const saveData: SaveData = JSON.parse(e.target?.result as string)
        if (!saveData.state || !saveData.state.phase) {
          reject(new Error('Archivo de guardado inválido'))
          return
        }
        resolve(saveData.state)
      } catch {
        reject(new Error('Archivo JSON inválido'))
      }
    }
    reader.onerror = () => reject(new Error('Error al leer el archivo'))
    reader.readAsText(file)
  })
}
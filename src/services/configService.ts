import type { AIConfig, ImageConfig, TTSConfig } from '../types/game'
import { userDataKey } from './authService'

function readKey<T>(username: string | null, suffix: string): T | null {
  if (!username) return null
  try {
    const raw = localStorage.getItem(userDataKey(username, suffix))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeKey(username: string | null, suffix: string, value: unknown): void {
  if (!username) return
  localStorage.setItem(userDataKey(username, suffix), JSON.stringify(value))
}

export function loadSavedConfig(username: string | null): AIConfig | null {
  return readKey<AIConfig>(username, 'ai-config')
}

export function saveConfig(username: string | null, config: AIConfig): void {
  writeKey(username, 'ai-config', config)
}

export function loadSavedTTS(username: string | null): TTSConfig | null {
  return readKey<TTSConfig>(username, 'tts-config')
}

export function saveTTSConfig(username: string | null, tts: TTSConfig): void {
  writeKey(username, 'tts-config', tts)
}

export function loadSavedImageConfig(username: string | null): ImageConfig | null {
  return readKey<ImageConfig>(username, 'image-config')
}

export function saveImageConfig(username: string | null, config: ImageConfig): void {
  writeKey(username, 'image-config', config)
}

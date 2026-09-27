import type { TTSConfig } from '../types/game'
import { proxyAuthHeaders } from './proxyToken'

let audioEl: HTMLAudioElement | null = null
let currentBlobUrl: string | null = null
// Token de generación: descarta respuestas de reproducciones ya reemplazadas.
let ttsToken = 0
let currentController: AbortController | null = null

export function getVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis.getVoices()
}

export function speakBrowser(text: string, config: TTSConfig): void {
  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  const voices = getVoices()

  let found: SpeechSynthesisVoice | null = null
  if (config.voice) {
    found = voices.find((v) => v.voiceURI === config.voice || v.name === config.voice) ?? null
  }
  if (!found) {
    found = voices.find((v) => v.lang.startsWith('es')) ?? voices[0] ?? null
  }
  if (found) utterance.voice = found
  utterance.rate = Math.max(0.1, Math.min(10, config.rate))
  utterance.pitch = Math.max(0, Math.min(2, config.pitch))
  utterance.lang = found?.lang || 'es-ES'

  window.speechSynthesis.speak(utterance)
}

async function playResponse(res: Response, config: TTSConfig, token: number): Promise<void> {
  if (!res.ok) {
    throw new Error(`TTS error (${res.status})`)
  }
  const blob = await res.blob()
  // Otra reproducción empezó (o se detuvo) mientras descargábamos: descartar.
  if (token !== ttsToken) return
  const url = URL.createObjectURL(blob)
  currentBlobUrl = url
  audioEl = new Audio(url)
  audioEl.playbackRate = Math.max(0.1, Math.min(10, config.rate))
  await audioEl.play()
}

async function fetchAndPlayExternal(url: string, headers: Record<string, string>, body: Record<string, unknown>, config: TTSConfig): Promise<void> {
  stopSpeaking()

  const token = ++ttsToken
  const controller = new AbortController()
  currentController = controller
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    await playResponse(res, config, token)
  } catch (err) {
    if (controller.signal.aborted) return
    throw err
  } finally {
    if (currentController === controller) currentController = null
  }
}

export async function speakExternal(text: string, config: TTSConfig): Promise<void> {
  const body: Record<string, unknown> = {
    model: config.model || 'tts-1',
    input: text,
    voice: config.voice || 'alloy',
    response_format: 'mp3',
  }

  if (config.apiKey) {
    return fetchAndPlayExternal(`${config.endpoint}/audio/speech`, {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    }, body, config)
  }
  return fetchAndPlayExternal('/api/proxy/tts', { 'Content-Type': 'application/json', ...proxyAuthHeaders() }, body, config)
}

export function stopSpeaking(): void {
  window.speechSynthesis.cancel()
  ttsToken++
  currentController?.abort()
  currentController = null
  if (audioEl) {
    audioEl.pause()
    audioEl = null
  }
  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl)
    currentBlobUrl = null
  }
}

export function speakMessageText(text: string, config: TTSConfig): void {
  if (!config.enabled) return

  const cleaned = text
    .replace(/\[\[.+?\]\]/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/\*{1,2}/g, '')
    .replace(/`{1,3}/g, '')
    .replace(/>>>\s/g, '')
    .replace(/\[.*?\]/g, '')
    .trim()

  if (config.mode === 'external') {
    speakExternal(cleaned, config).catch((err) => console.error('TTS error:', err))
  } else {
    speakBrowser(cleaned, config)
  }
}

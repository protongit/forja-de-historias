import type { TTSConfig } from '../types/game'

let audioEl: HTMLAudioElement | null = null
let currentBlobUrl: string | null = null

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

async function fetchAndPlay(body: Record<string, unknown>, config: TTSConfig): Promise<void> {
  stopSpeaking()

  let url: string | undefined
  try {
    const res = await fetch('/api/proxy/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      throw new Error(`TTS error (${res.status}): ${errBody || res.statusText}`)
    }

    const blob = await res.blob()
    url = URL.createObjectURL(blob)
    currentBlobUrl = url
    audioEl = new Audio(url)
    audioEl.playbackRate = Math.max(0.1, Math.min(10, config.rate))
    await audioEl.play()
  } catch (err) {
    if (url && currentBlobUrl === url) {
      URL.revokeObjectURL(url)
      currentBlobUrl = null
    }
    throw err
  }
}

async function fetchAndPlayDirect(body: Record<string, unknown>, config: TTSConfig): Promise<void> {
  stopSpeaking()

  let url: string | undefined
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    headers['Authorization'] = `Bearer ${config.apiKey}`

    const res = await fetch(`${config.endpoint}/audio/speech`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      throw new Error(`TTS error (${res.status}): ${errBody || res.statusText}`)
    }

    const blob = await res.blob()
    url = URL.createObjectURL(blob)
    currentBlobUrl = url
    audioEl = new Audio(url)
    audioEl.playbackRate = Math.max(0.1, Math.min(10, config.rate))
    await audioEl.play()
  } catch (err) {
    if (url && currentBlobUrl === url) {
      URL.revokeObjectURL(url)
      currentBlobUrl = null
    }
    throw err
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
    return fetchAndPlayDirect(body, config)
  }
  return fetchAndPlay(body, config)
}

export function stopSpeaking(): void {
  window.speechSynthesis.cancel()
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

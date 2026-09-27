import type { Message, AIConfig } from '../types/game'
import { proxyAuthHeaders } from '../services/proxyToken'

const SUMMARIZATION_PROMPT = `Resume la siguiente conversación de juego de rol en 2-3 párrafos concisos.
Mantén SOLO la información esencial para mantener la coherencia narrativa:
- Eventos importantes ocurridos (combates, descubrimientos, diálogos clave)
- Decisiones del jugador que afectan la historia
- Estado actual de la misión y objetivos
- Personajes importantes encontrados y su relación con el jugador
- Objetos significativos obtenidos o perdidos
- Cambios en el mundo o la situación del personaje

Omite saludos iniciales, interacciones triviales y detalles irrelevantes.
El resumen será leído por un director de juego IA para continuar la historia, así que debe incluir suficiente contexto para mantener coherencia.`

export const SUMMARY_PREFIX = '[Resumen de eventos anteriores: '
const MAX_UNSUMMARIZED = 50
const SUMMARIZATION_BATCH = 35

export function shouldSummarize(messageCount: number): boolean {
  return messageCount > MAX_UNSUMMARIZED
}

export function isSummaryMessage(m: Message): boolean {
  return m.content.startsWith('[Resumen de eventos anteriores')
}

export function getMessagesToSummarize(messages: Message[]): Message[] {
  const nonSummary = messages.filter((m) => !isSummaryMessage(m))
  const count = Math.max(0, Math.min(SUMMARIZATION_BATCH, nonSummary.length - 10))
  return nonSummary.slice(0, count)
}

// Índice a partir del cual se conservan los mensajes al compactar (elimina el resumen previo si existe)
export function computeKeepFromIndex(messages: Message[]): number {
  const firstKept = messages.findIndex((m) => !isSummaryMessage(m))
  const keepFromIndex = firstKept === -1
    ? Math.min(SUMMARIZATION_BATCH, messages.length - 10)
    : firstKept + SUMMARIZATION_BATCH
  return Math.max(0, Math.min(keepFromIndex, messages.length))
}

export function buildSummaryMessage(summary: string): Message {
  return {
    id: `summary-${Date.now()}`,
    sender: 'system',
    content: `${SUMMARY_PREFIX}${summary}]`,
    timestamp: Date.now(),
  }
}

export async function summarizeMessages(
  config: AIConfig,
  messages: Message[]
): Promise<string> {
  const apiMessages = [
    { role: 'system' as const, content: SUMMARIZATION_PROMPT },
    ...messages.map((m) => ({
      role: (m.sender === 'player' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `${m.sender === 'system' ? '[SISTEMA] ' : ''}${m.content}`,
    })),
  ]

  const body = {
    model: config.model,
    messages: apiMessages,
    temperature: 0.3,
    max_tokens: 500,
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  let url: string

  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`
    url = `${config.endpoint}/chat/completions`
  } else {
    Object.assign(headers, proxyAuthHeaders())
    url = '/api/proxy/chat'
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`Error de sumarización (${response.status})`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

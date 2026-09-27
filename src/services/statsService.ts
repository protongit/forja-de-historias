import { proxyAuthHeaders } from './proxyToken'

export interface StatsPayload {
  username: string
  adventureName: string
  sessionId: string
  level: number
  xpTotal: number
  enemiesDefeated: number
  timePlayedMs: number
  completed: boolean
  result: 'success' | 'failure' | 'active'
  messagesSent: number
  diceRolls: number
  diceSuccesses: number
  diceFailures: number
  imagesGenerated: number
}

export async function upsertGameStats(payload: StatsPayload): Promise<void> {
  const res = await fetch('/api/stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...proxyAuthHeaders() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`No se pudieron guardar las estadísticas (${res.status})`)
}
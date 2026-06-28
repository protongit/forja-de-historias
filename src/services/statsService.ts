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
  await fetch('/api/stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
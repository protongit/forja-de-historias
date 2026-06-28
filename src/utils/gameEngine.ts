export type GamePhase = 'config' | 'setup' | 'generation' | 'playing' | 'completed'

export function canSendMessage(phase: GamePhase): boolean {
  return phase === 'setup' || phase === 'playing'
}

export function isGameActive(phase: GamePhase): boolean {
  return phase !== 'config' && phase !== 'completed'
}

export function getPhaseLabel(phase: GamePhase): string {
  const labels: Record<GamePhase, string> = {
    config: 'Configuración',
    setup: 'Creación de personaje',
    generation: 'Generando aventura...',
    playing: 'En juego',
    completed: 'Aventura completada',
  }
  return labels[phase]
}
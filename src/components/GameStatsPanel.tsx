import { useGame } from '../context/GameContext'
import CollapsiblePanel from './CollapsiblePanel'

export default function GameStatsPanel() {
  const { state } = useGame()
  const s = state.gameStats

  const winRate = s.diceRolls > 0 ? Math.round((s.diceSuccesses / s.diceRolls) * 100) : 0

  return (
    <CollapsiblePanel icon="📊" title="Estadísticas" color="text-cyan-400" aria-label="Panel de estadísticas">
      <div className="grid grid-cols-2 gap-1.5 text-xs" role="table" aria-label="Estadísticas de la partida">
        <div className="bg-gray-700/40 rounded-lg px-2 py-1.5" role="row">
          <p className="text-gray-400">Mensajes</p>
          <p className="text-gray-200 font-medium" role="cell">{s.messagesSent}</p>
        </div>
        <div className="bg-gray-700/40 rounded-lg px-2 py-1.5" role="row">
          <p className="text-gray-400">Dados</p>
          <p className="text-gray-200 font-medium" role="cell">{s.diceRolls}</p>
        </div>
        <div className="bg-gray-700/40 rounded-lg px-2 py-1.5" role="row">
          <p className="text-gray-400">Aciertos</p>
          <p className="text-green-400 font-medium" role="cell">{s.diceSuccesses}</p>
        </div>
        <div className="bg-gray-700/40 rounded-lg px-2 py-1.5" role="row">
          <p className="text-gray-400">Fallos</p>
          <p className="text-red-400 font-medium" role="cell">{s.diceFailures}</p>
        </div>
        <div className="bg-gray-700/40 rounded-lg px-2 py-1.5" role="row">
          <p className="text-gray-400">Acierto</p>
          <p className="text-gray-200 font-medium" role="cell">{winRate}%</p>
        </div>
        <div className="bg-gray-700/40 rounded-lg px-2 py-1.5" role="row">
          <p className="text-gray-400">Enemigos</p>
          <p className="text-gray-200 font-medium" role="cell">{s.enemiesDefeated}</p>
        </div>
        <div className="bg-gray-700/40 rounded-lg px-2 py-1.5" role="row">
          <p className="text-gray-400">XP ganada</p>
          <p className="text-yellow-400 font-medium" role="cell">{s.xpEarned}</p>
        </div>
        <div className="bg-gray-700/40 rounded-lg px-2 py-1.5" role="row">
          <p className="text-gray-400">Niveles</p>
          <p className="text-indigo-400 font-medium" role="cell">{s.levelsGained}</p>
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-2 text-center" aria-label={`Tiempo jugado: ${Math.floor(s.timePlayedMs / 60000)} minutos`}>
        Tiempo: {Math.floor(s.timePlayedMs / 60000)} min
      </p>
    </CollapsiblePanel>
  )
}

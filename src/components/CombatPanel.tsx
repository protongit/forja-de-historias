import { useRef, useCallback } from 'react'
import { useGame } from '../context/GameContext'
import CollapsiblePanel from './CollapsiblePanel'

export default function CombatPanel() {
  const { state, dispatch } = useGame()
  const cooldownRef = useRef(false)

  if (!state.combatActive || state.enemies.length === 0) return null

  const aliveEnemies = state.enemies.filter((e) => e.isAlive)
  const totalEnemyHp = aliveEnemies.reduce((sum, e) => sum + e.hp, 0)
  const totalMaxHp = aliveEnemies.reduce((sum, e) => sum + e.maxHp, 0)

  const sendCombatAction = useCallback((action: string) => {
    if (cooldownRef.current) return
    cooldownRef.current = true
    dispatch({
      type: 'ADD_MESSAGE',
      message: { id: crypto.randomUUID(), sender: 'player', content: action, timestamp: Date.now() },
    })
    dispatch({ type: 'INCREMENT_STAT', stat: 'messagesSent' })
    dispatch({ type: 'SET_WAITING_AI', waiting: true })
    dispatch({ type: 'SET_COMBAT_TURN', turn: state.combatTurn + 1 })
    setTimeout(() => { cooldownRef.current = false }, 500)
  }, [dispatch, state.combatTurn])

  return (
    <CollapsiblePanel icon="⚔️" title="Combate" count={`Turno ${state.combatTurn}`} color="text-red-400" className="border border-red-700/50" aria-label="Panel de combate">
      <div className="space-y-2" role="list" aria-label="Enemigos en combate">
        {state.enemies.map((enemy) => (
          <div
            key={enemy.name}
            role="listitem"
            className={`px-2.5 py-1.5 rounded-lg text-sm ${
              enemy.isAlive ? 'bg-gray-700/60' : 'bg-gray-800 opacity-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`font-medium ${enemy.isAlive ? 'text-red-300' : 'text-gray-500 line-through'}`} aria-label={`Enemigo: ${enemy.name}`}>
                {enemy.name}
              </span>
              <span className={`text-xs ${enemy.isAlive ? 'text-gray-300' : 'text-gray-600'}`} aria-label={`HP: ${enemy.hp} de ${enemy.maxHp}`}>
                {enemy.isAlive ? `HP: ${enemy.hp}/${enemy.maxHp}` : 'Derrotado'}
              </span>
            </div>
            {enemy.isAlive && (
              <div className="mt-1 h-1.5 bg-gray-700 rounded-full overflow-hidden" role="progressbar" aria-valuenow={enemy.hp} aria-valuemin={0} aria-valuemax={enemy.maxHp} aria-label={`Barra de vida de ${enemy.name}`}>
                <div
                  className="h-full bg-red-500 rounded-full transition-all"
                  style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }}
                />
              </div>
            )}
            {enemy.description && enemy.isAlive && (
              <p className="text-xs text-gray-400 mt-0.5 truncate" aria-label={`Descripción: ${enemy.description}`}>{enemy.description}</p>
            )}
          </div>
        ))}
      </div>

      {totalMaxHp > 0 && (
        <div className="mt-2 p-1.5 bg-red-900/30 rounded-lg" aria-label="HP total de enemigos">
          <div className="flex justify-between text-xs text-red-300 mb-0.5">
            <span>HP enemigos</span>
            <span>{totalEnemyHp}/{totalMaxHp}</span>
          </div>
          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${(totalEnemyHp / totalMaxHp) * 100}%` }} />
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5" role="toolbar" aria-label="Acciones de combate">
        <button onClick={() => sendCombatAction('Atacar')} className="px-2 py-1.5 text-xs bg-gray-700 hover:bg-red-700/50 text-gray-300 hover:text-white rounded-md transition border border-gray-600 hover:border-red-600" aria-label="Atacar enemigo">
          ⚔️ Atacar
        </button>
        <button onClick={() => sendCombatAction('Defenderse')} className="px-2 py-1.5 text-xs bg-gray-700 hover:bg-blue-700/50 text-gray-300 hover:text-white rounded-md transition border border-gray-600 hover:border-blue-600" aria-label="Defenderse">
          🛡️ Defender
        </button>
        <button onClick={() => sendCombatAction('Usar habilidad especial')} className="px-2 py-1.5 text-xs bg-gray-700 hover:bg-purple-700/50 text-gray-300 hover:text-white rounded-md transition border border-gray-600 hover:border-purple-600" aria-label="Usar habilidad especial">
          ✨ Habilidad
        </button>
        <button onClick={() => sendCombatAction('Huir del combate')} className="px-2 py-1.5 text-xs bg-gray-700 hover:bg-amber-700/50 text-gray-300 hover:text-white rounded-md transition border border-gray-600 hover:border-amber-600" aria-label="Huir del combate">
          🏃 Huir
        </button>
      </div>
      <button
        onClick={() => {
          dispatch({ type: 'SET_COMBAT_ACTIVE', active: false })
          dispatch({ type: 'SET_COMBAT_TURN', turn: 0 })
        }}
        className="mt-2 text-xs text-gray-500 hover:text-red-400 transition w-full text-center"
        aria-label="Cerrar combate"
      >
        ✕ Cerrar combate
      </button>
    </CollapsiblePanel>
  )
}

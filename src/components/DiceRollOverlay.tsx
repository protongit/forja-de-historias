import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useGame } from '../context/useGame'
import { useChatOrchestrator } from '../hooks/useChatOrchestrator'
import type { DiceCheck } from '../types/game'

const DICE_COLORS: Record<string, string> = {
  d4: '#6366f1',
  d6: '#8b5cf6',
  d8: '#a855f7',
  d10: '#d946ef',
  d12: '#ec4899',
  d20: '#f43f5e',
  d100: '#ef4444',
}

export default function DiceRollOverlay() {
  const { state } = useGame()
  const check = state.pendingDiceCheck
  if (!check || check.resolved) return null
  return <DiceRoll key={`${check.stat}-${check.dc}-${check.dice}`} check={check} />
}

function DiceRoll({ check }: { check: DiceCheck }) {
  const { state, dispatch } = useGame()
  const { continueAfterDice } = useChatOrchestrator()
  const charStats = useMemo(() => state.character?.stats ?? [], [state.character])
  const charSkills = useMemo(() => state.character?.skills ?? [], [state.character])
  const maxFaces = useMemo(() => parseInt(check.dice.replace('d', ''), 10) || 20, [check.dice])

  const [rolling, setRolling] = useState(state.diceAutoRoll)
  const [selected, setSelected] = useState(check.stat)
  const [result, setResult] = useState<number | null>(null)
  const [showSelector, setShowSelector] = useState(false)

  const statBonus = charStats.find((s) => s.name === selected)?.value ?? 0
  const total = result === null ? 0 : result + statBonus
  const success = result === null ? null : total >= check.dc

  useEffect(() => {
    if (!rolling) return
    const delay = state.diceAutoRoll ? 2000 : 500
    const timer = setTimeout(() => {
      setResult(Math.floor(Math.random() * maxFaces) + 1)
      setRolling(false)
    }, delay)
    return () => clearTimeout(timer)
  }, [rolling, maxFaces, state.diceAutoRoll])

  const recorded = useRef(false)
  useEffect(() => {
    if (result === null || success === null || recorded.current) return
    recorded.current = true
    dispatch({ type: 'INCREMENT_STAT', stat: 'diceRolls' })
    dispatch({ type: 'INCREMENT_STAT', stat: success ? 'diceSuccesses' : 'diceFailures' })
  }, [result, success, dispatch])

  const handleContinue = useCallback(() => {
    if (result === null || success === null) return
    const bonus = statBonus
    const sum = result + bonus
    const resultMsg = `🎲 ${selected} → ${result} + ${bonus} = ${sum} (DC ${check.dc}) → ${success ? '✅ Éxito' : '❌ Fracaso'}`

    dispatch({ type: 'SET_DICE_CHECK', check: null })
    dispatch({ type: 'ADD_MESSAGE', message: { id: crypto.randomUUID(), sender: 'system', content: resultMsg, timestamp: Date.now() } })

    const diceResultMsg = `[[DICE_RESULT: stat: ${selected}, valor: ${statValue(selected)}, bonus: ${bonus}, resultado: ${result}, total: ${sum}, dc: ${check.dc}, ${success ? 'exito' : 'fracaso'}]]`

    void continueAfterDice(diceResultMsg)

    function statValue(name: string): number {
      return charStats.find((s) => s.name === name)?.value ?? 0
    }
  }, [result, success, selected, statBonus, check.dc, charStats, dispatch, continueAfterDice])

  const continueRef = useRef(handleContinue)
  useEffect(() => {
    continueRef.current = handleContinue
  }, [handleContinue])

  const autoContinued = useRef(false)
  useEffect(() => {
    if (result === null || success === null || !state.diceAutoRoll || autoContinued.current) return
    autoContinued.current = true
    continueRef.current()
  }, [result, success, state.diceAutoRoll])

  const handleRoll = useCallback(() => {
    if (rolling || result !== null) return
    setRolling(true)
  }, [rolling, result])

  function handleStatSelect(name: string) {
    setSelected(name)
    setShowSelector(false)
  }

  const autoRolling = state.diceAutoRoll && rolling
  const diceColor = DICE_COLORS[check.dice] || '#6366f1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-gray-800 rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 text-center border border-gray-700">
        <h3 className="text-lg font-bold text-white mb-1">
          {autoRolling ? '🎲 Tirando dados...' : '🎲 Tirada de dados'}
        </h3>

        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="text-sm text-gray-400">DC {check.dc}</span>
          <span className="text-gray-600">|</span>
          <span className="text-sm text-gray-400">{check.dice}</span>
        </div>

        {!autoRolling && (
          <div className="mb-3">
            {(() => {
              const allOptions = [
                ...charStats.map((s) => ({ type: 'stat' as const, name: s.name, value: s.value.toString(), group: 'Estadísticas' })),
                ...charSkills.map((s) => ({ type: 'skill' as const, name: s.name, value: s.description, group: 'Habilidades' })),
              ]
              if (allOptions.length === 0) return <p className="text-sm text-gray-300">{selected}</p>
              return (
                <>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xs text-gray-500">Usar:</span>
                    <button
                      onClick={() => setShowSelector(!showSelector)}
                      className="px-3 py-1 bg-indigo-700 hover:bg-indigo-600 text-white text-sm rounded transition"
                    >
                      {selected} ▼
                    </button>
                  </div>
                  {showSelector && (
                    <div className="mt-2 bg-gray-700 rounded-lg p-2 max-h-48 overflow-y-auto">
                      {['Estadísticas', 'Habilidades'].map((group) => {
                        const items = allOptions.filter((o) => o.group === group)
                        if (!items.length) return null
                        return (
                          <div key={group}>
                            <p className="text-[10px] text-gray-500 uppercase text-left px-2 py-1">{group}</p>
                            {items.map((o) => (
                              <button
                                key={o.name}
                                onClick={() => handleStatSelect(o.name)}
                                className={`w-full text-left px-2 py-1.5 text-sm rounded transition ${
                                  selected === o.name ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-600'
                                }`}
                              >
                                {o.name} {o.type === 'stat' ? `(${o.value})` : `— ${o.value}`}
                              </button>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        )}

        <div className="my-4 flex justify-center">
          <div
            className={`relative w-32 h-32 rounded-2xl flex flex-col items-center justify-center shadow-lg border-2 transition-all duration-300 ${
              rolling ? 'animate-dice-roll border-white/30' : result !== null ? 'border-white/50 scale-110' : 'border-white/20'
            }`}
            style={{ backgroundColor: diceColor }}
          >
            {rolling ? (
              <>
                <span className="text-4xl mb-1">🎲</span>
                <span className="text-white/80 text-sm font-bold">{check.dice}</span>
              </>
            ) : result !== null ? (
              <>
                <span className="text-white/70 text-xs font-semibold tracking-wide">{check.dice}</span>
                <span className="text-white text-5xl font-black drop-shadow-lg">{result}</span>
                {success !== null && (
                  <span className={`absolute -bottom-3 text-2xl ${success ? 'drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]' : 'drop-shadow-[0_0_8px_rgba(248,113,113,0.8)]'}`}>
                    {success ? '✅' : '❌'}
                  </span>
                )}
              </>
            ) : (
              <span className="text-white/60 text-sm font-bold">{check.dice}</span>
            )}
          </div>
        </div>

        {result !== null && success !== null && (
          <>
            <div className="text-sm text-gray-400 mb-1">
              🎲 {result} + {statBonus} = {total}
            </div>
            <div className={`text-xl font-bold mb-4 ${success ? 'text-green-400' : 'text-red-400'}`}>
              {success ? '✅ ¡Éxito!' : '❌ Fracaso'}
            </div>
          </>
        )}

        <div className="flex gap-2 justify-center">
          {!rolling && result === null && !autoRolling && (
            <button
              onClick={handleRoll}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition text-lg"
            >
              🎲 ¡Tirar!
            </button>
          )}
          {result !== null && !state.diceAutoRoll && (
            <button
              onClick={handleContinue}
              className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition text-lg"
            >
              Continuar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

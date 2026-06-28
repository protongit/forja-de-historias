import { useState, useEffect, useRef, useCallback } from 'react'
import { useGame } from '../context/GameContext'
import { sendChat } from '../services/aiService'
import { cleanContentMarkers } from '../utils/commandCleaner'
import { getGamemasterPrompt } from '../utils/prompts'

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
  const { state, dispatch } = useGame()
  const [rolling, setRolling] = useState(false)
  const [selected, setSelected] = useState('')
  const [showSelector, setShowSelector] = useState(false)
  const [result, setResult] = useState<number | null>(null)
  const [success, setSuccess] = useState<boolean | null>(null)
  const autoTriggered = useRef(false)

  const check = state.pendingDiceCheck
  const charStats = state.character?.stats || []
  const charSkills = state.character?.skills || []
  const maxFaces = check ? parseInt(check.dice.replace('d', ''), 10) || 20 : 20

  useEffect(() => {
    if (!check) {
      setResult(null)
      setSuccess(null)
      setRolling(false)
      autoTriggered.current = false
      return
    }
    setSelected(check.stat)
    setResult(null)
    setSuccess(null)
    setShowSelector(false)
  }, [check?.resolved === false ? check : null])

  useEffect(() => {
    if (!check || check.resolved) return
    if (state.diceAutoRoll && !autoTriggered.current) {
      autoTriggered.current = true
      setRolling(true)
    }
  }, [check, state.diceAutoRoll])

  useEffect(() => {
    if (!rolling) return
    const delay = state.diceAutoRoll ? 2000 : 500
    const timer = setTimeout(() => {
      const final = Math.floor(Math.random() * maxFaces) + 1
      setResult(final)
      setRolling(false)
    }, delay)
    return () => clearTimeout(timer)
  }, [rolling, maxFaces, state.diceAutoRoll])

  useEffect(() => {
    if (result === null || success !== null) return
    const statValue = charStats.find((s) => s.name === selected)?.value ?? 0
    const bonus = statValue
    const total = result + bonus
    const isSuccess = total >= (check?.dc ?? 0)
    setSuccess(isSuccess)
    dispatch({ type: 'INCREMENT_STAT', stat: 'diceRolls' })
    dispatch({ type: 'INCREMENT_STAT', stat: isSuccess ? 'diceSuccesses' : 'diceFailures' })
  }, [result, check, success, dispatch, charStats, selected])

  useEffect(() => {
    if (result === null || success === null || !check || !state.diceAutoRoll) return
    handleContinue()
  }, [result, success, state.diceAutoRoll, check])

  const handleRoll = useCallback(() => {
    if (!check || rolling) return
    setRolling(true)
    setSuccess(null)
    setResult(null)
  }, [check, rolling])

  function handleStatSelect(name: string) {
    setSelected(name)
    setShowSelector(false)
  }

  async function handleContinue() {
    if (!check || result === null || success === null) return
    const statValue = charStats.find((s) => s.name === selected)?.value ?? 0
    const bonus = statValue
    const total = result + bonus
    const resultMsg = `🎲 ${selected} → ${result} + ${bonus} = ${total} (DC ${check.dc}) → ${success ? '✅ Éxito' : '❌ Fracaso'}`

    dispatch({ type: 'SET_DICE_CHECK', check: null })
    setResult(null)
    setSuccess(null)

    dispatch({ type: 'ADD_MESSAGE', message: { id: crypto.randomUUID(), sender: 'system', content: resultMsg, timestamp: Date.now() } })
    dispatch({ type: 'SET_WAITING_AI', waiting: true })

    const diceResultMsg = `[[DICE_RESULT: stat: ${selected}, valor: ${statValue}, bonus: ${bonus}, resultado: ${result}, total: ${total}, dc: ${check.dc}, ${success ? 'exito' : 'fracaso'}]]`
    const systemMessage = { id: crypto.randomUUID(), sender: 'system' as const, content: diceResultMsg, timestamp: Date.now() }
    const aiMessages = [...state.messages, systemMessage]

    const gmPrompt = getGamemasterPrompt(state.combatMode === 'tactical')
    const charCtx = state.character?.stats.length || state.character?.skills.length
      ? `\n\nCONTEXTO DEL PERSONAJE:\nNombre: ${state.character?.name}\nEstadísticas: ${(state.character?.stats || []).map((s) => `${s.name}: ${s.value}`).join(', ')}\nHabilidades: ${(state.character?.skills || []).map((s) => `${s.name}: ${s.description}`).join(', ')}`
      : ''
    const fullPrompt = gmPrompt + charCtx

    sendChat(state.aiConfig, fullPrompt, aiMessages)
      .then((aiResponse) => {
        dispatch({ type: 'ADD_MESSAGE', message: { id: crypto.randomUUID(), sender: 'gm', content: cleanContentMarkers(aiResponse), timestamp: Date.now() } })
      })
      .catch((err) => dispatch({ type: 'SET_ERROR', error: err.message }))
      .finally(() => dispatch({ type: 'SET_WAITING_AI', waiting: false }))
  }

  if (!check || check.resolved) return null

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
              🎲 {result} + {charStats.find((s) => s.name === selected)?.value ?? 0} = {result + (charStats.find((s) => s.name === selected)?.value ?? 0)}
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

import { useGame } from '../context/useGame'
import { useRef, useEffect, useState } from 'react'
import Message from './Message'
import ChatInput, { type ChatInputRef } from './ChatInput'
import GenerationSkeleton from './GenerationSkeleton'
import { speakMessageText } from '../services/ttsService'
import { upsertGameStats } from '../services/statsService'
import { saveGame, AUTO_SAVE_SLOT } from '../services/storageService'

const PHASE_TOASTS: Record<string, string> = {
  setup: 'Responde a las preguntas del Director de Juego para crear tu aventura.',
  playing: 'Escribe qué quieres hacer, con quién hablar o adónde ir...',
  generation: 'Generando tu aventura...',
  completed: 'La aventura ha terminado. ¡Gracias por jugar!',
}

const LOADING_MESSAGE = { id: 'loading', sender: 'gm' as const, content: '', timestamp: 0 }

function PhaseToast({ message }: { message: string }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const id = setTimeout(() => setVisible(false), 5000)
    return () => clearTimeout(id)
  }, [])
  if (!visible) return null
  return (
    <div className="bg-indigo-900/60 border border-indigo-700 text-indigo-200 text-sm px-4 py-2 rounded-lg text-center animate-pulse">
      {message}
    </div>
  )
}

interface Props {
  quickSetupAnswers?: Record<string, string> | null
  onQuickSetupConsumed?: () => void
}

export default function ChatInterface({ quickSetupAnswers, onQuickSetupConsumed }: Props = {}) {
  const { state, dispatch } = useGame()
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<ChatInputRef>(null)
  const lastAutoPlayed = useRef(0)
  const startTime = useRef<number>(0)
  const userScrolledUp = useRef(false)
  useEffect(() => { startTime.current = Date.now() }, [])

  useEffect(() => {
    function onPlayerAction(e: Event) {
      const action = (e as CustomEvent<string>).detail
      if (action) chatInputRef.current?.sendMessage(action)
    }
    window.addEventListener('fj:player-action', onPlayerAction)
    return () => window.removeEventListener('fj:player-action', onPlayerAction)
  }, [])

  const isNearBottom = () => {
    const el = scrollContainerRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 200
  }

  const lastMessageContent = state.messages[state.messages.length - 1]?.content
  useEffect(() => {
    if (state.messages.length === 0) return
    if (userScrolledUp.current && !isNearBottom()) return
    bottomRef.current?.scrollIntoView({ behavior: state.isWaitingAI ? 'auto' : 'smooth' })
  }, [state.messages.length, lastMessageContent, state.isWaitingAI, state.phase])

  function handleScroll() {
    userScrolledUp.current = !isNearBottom()
  }

  useEffect(() => {
    if (state.phase !== 'playing') return
    const interval = setInterval(() => {
      dispatch({ type: 'UPDATE_STATS_BATCH', stats: { timePlayedMs: Date.now() - startTime.current } })
    }, 10000)
    return () => clearInterval(interval)
  }, [state.phase, dispatch])

  // Reset startTime when game is reset
  useEffect(() => {
    if (state.phase === 'config') {
      startTime.current = Date.now()
    }
  }, [state.phase])

  // Stats session: create on first playing, sync on changes
  const sentSession = useRef(false)
  const prevStats = useRef(state.gameStats)

  useEffect(() => {
    if (state.phase !== 'playing' && state.phase !== 'completed') return
    if (state.phase === 'playing' && !sentSession.current) {
      sentSession.current = true
      if (!state.statsSessionId) {
        dispatch({ type: 'SET_STATS_SESSION_ID', id: crypto.randomUUID() })
      }
    }
  }, [state.phase, state.statsSessionId, dispatch])

  useEffect(() => {
    if (state.phase !== 'playing' && state.phase !== 'completed') return
    if (!state.statsSessionId) return

    const prev = prevStats.current
    const curr = state.gameStats
    const changed =
      prev.messagesSent !== curr.messagesSent ||
      prev.diceRolls !== curr.diceRolls ||
      prev.diceSuccesses !== curr.diceSuccesses ||
      prev.diceFailures !== curr.diceFailures ||
      prev.enemiesDefeated !== curr.enemiesDefeated ||
      prev.timePlayedMs !== curr.timePlayedMs ||
      prev.xpEarned !== curr.xpEarned ||
      prev.levelsGained !== curr.levelsGained ||
      prev.imagesGenerated !== curr.imagesGenerated ||
      sentSession.current === true

    if (!changed) return

    prevStats.current = curr

    const result = state.phase === 'completed'
      ? (state.gameStats.adventureResult || 'failure') as 'success' | 'failure'
      : 'active' as const

    const payload = {
      username: state.currentUser || 'anon',
      adventureName: state.adventureName || state.quest?.title || 'Aventura',
      sessionId: state.statsSessionId!,
      level: state.level,
      xpTotal: state.gameStats.xpEarned,
      enemiesDefeated: curr.enemiesDefeated,
      timePlayedMs: curr.timePlayedMs,
      messagesSent: curr.messagesSent,
      diceRolls: curr.diceRolls,
      diceSuccesses: curr.diceSuccesses,
      diceFailures: curr.diceFailures,
      imagesGenerated: curr.imagesGenerated,
      completed: state.phase === 'completed',
      result,
    }
    upsertGameStats(payload).catch(() => {})
  }, [state.gameStats, state.phase, state.statsSessionId, state.level, state.currentUser, state.adventureName, state.quest?.title])

  useEffect(() => {
    if (!state.tts.enabled || !state.tts.autoPlay) return
    if (state.isWaitingAI) return
    const lastMsg = state.messages[state.messages.length - 1]
    if (!lastMsg || lastMsg.sender !== 'gm' || lastMsg.timestamp <= lastAutoPlayed.current) return
    lastAutoPlayed.current = lastMsg.timestamp
    speakMessageText(lastMsg.content, state.tts)
  }, [state.messages, state.isWaitingAI, state.tts])

  // --- Autosave: no perder la partida al recargar ---
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  })

  function writeAutosave() {
    const s = stateRef.current
    if (!s.currentUser || s.phase === 'config' || s.messages.length === 0) return
    try {
      saveGame(s, s.currentUser, AUTO_SAVE_SLOT)
    } catch {
      // cuota llena: mejor no molestar al jugador
    }
  }

  useEffect(() => {
    if (!state.currentUser || state.phase === 'config' || state.messages.length === 0) return
    const id = setTimeout(writeAutosave, 1500)
    return () => clearTimeout(id)
  }, [state.messages, state.phase, state.currentUser])

  useEffect(() => {
    window.addEventListener('beforeunload', writeAutosave)
    return () => window.removeEventListener('beforeunload', writeAutosave)
  }, [])

  const phaseToast = PHASE_TOASTS[state.phase]
  const lastMsg = state.messages[state.messages.length - 1]
  const lastIsGmSlot = !!lastMsg && state.isWaitingAI && lastMsg.sender === 'gm'

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-1" ref={scrollContainerRef} onScroll={handleScroll} role="log" aria-live="polite" aria-label="Transcripción de la aventura">
        {phaseToast && <PhaseToast key={state.phase} message={phaseToast} />}
        {state.messages.map((msg) => (
          <div key={msg.id}>
            <Message
              message={msg}
              isLoading={msg === lastMsg && lastIsGmSlot && msg.content === ''}
              onSelectOption={
                state.phase !== 'completed' && msg.sender === 'gm'
                  ? (opt) => chatInputRef.current?.sendMessage(opt)
                  : undefined
              }
              onSpeak={
                msg.sender === 'gm' && state.tts.enabled
                  ? (text) => speakMessageText(text, state.tts)
                  : undefined
              }
            />
          </div>
        ))}
        {state.isWaitingAI && state.phase === 'generation' && (
          <GenerationSkeleton />
        )}
        {state.isWaitingAI && state.phase !== 'generation' && !lastIsGmSlot && (
          <Message message={LOADING_MESSAGE} isLoading />
        )}
        <div ref={bottomRef} />
      </div>

      {state.phase !== 'completed' && state.phase !== 'generation' && (
        <div className="p-3 border-t border-gray-700">
          <ChatInput ref={chatInputRef} quickSetupAnswers={quickSetupAnswers} onQuickSetupConsumed={onQuickSetupConsumed} />
        </div>
      )}
    </div>
  )
}

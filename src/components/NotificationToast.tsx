import { useGame } from '../context/useGame'
import { useEffect, useState } from 'react'
import type { GameNotification } from '../types/game'
import type { Dispatch } from 'react'
import type { GameAction } from '../types/game'

const NOTIFICATION_CONFIG = {
  xp: { icon: '✨', bg: 'bg-yellow-600/90', border: 'border-yellow-500' },
  levelup: { icon: '🌟', bg: 'bg-purple-600/90', border: 'border-purple-500' },
  item: { icon: '🎒', bg: 'bg-emerald-600/90', border: 'border-emerald-500' },
  damage: { icon: '💔', bg: 'bg-red-600/90', border: 'border-red-500' },
  heal: { icon: '💚', bg: 'bg-green-600/90', border: 'border-green-500' },
  quest: { icon: '📖', bg: 'bg-indigo-600/90', border: 'border-indigo-500' },
  system: { icon: '⚙️', bg: 'bg-gray-600/90', border: 'border-gray-500' },
}

const DISMISS_AFTER_MS = 4000
const EXIT_MS = 300

function Toast({ notification, dispatch }: { notification: GameNotification; dispatch: Dispatch<GameAction> }) {
  const [exiting, setExiting] = useState(false)
  const [paused, setPaused] = useState(false)
  const { id, message, type } = notification

  useEffect(() => {
    if (paused || exiting) return
    const timer = setTimeout(() => setExiting(true), DISMISS_AFTER_MS)
    return () => clearTimeout(timer)
  }, [paused, exiting])

  useEffect(() => {
    if (!exiting) return
    const timer = setTimeout(() => dispatch({ type: 'DISMISS_NOTIFICATION', id }), EXIT_MS)
    return () => clearTimeout(timer)
  }, [exiting, id, dispatch])

  const dismiss = () => dispatch({ type: 'DISMISS_NOTIFICATION', id })
  const config = NOTIFICATION_CONFIG[type as keyof typeof NOTIFICATION_CONFIG] || NOTIFICATION_CONFIG.system
  return (
    <div
      className={`${config.bg} ${config.border} border text-white px-4 py-2.5 rounded-lg shadow-xl text-sm font-medium flex items-center gap-2 pointer-events-auto ${
        exiting ? 'animate-[fadeOut_0.3s_ease-in_forwards]' : 'animate-[slideIn_0.3s_ease-out]'
      }`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span className="text-base shrink-0" aria-hidden="true">{config.icon}</span>
      <span className="truncate">{message}</span>
      <button
        onClick={dismiss}
        className="shrink-0 ml-1 text-white/70 hover:text-white transition"
        aria-label="Cerrar notificación"
      >
        ✕
      </button>
    </div>
  )
}

export default function NotificationToast() {
  const { state, dispatch } = useGame()

  if (state.notifications.length === 0) return null

  return (
    <div className="fixed top-16 right-2 sm:right-4 z-40 flex flex-col gap-2 pointer-events-none" role="status" aria-live="polite">
      {state.notifications.map((n) => (
        <Toast key={n.id} notification={n} dispatch={dispatch} />
      ))}
    </div>
  )
}

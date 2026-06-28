import { useGame } from '../context/GameContext'
import { useEffect, useRef, useState } from 'react'

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

const DISMISS_IDS = new Set<string>()

export default function NotificationToast() {
  const { state, dispatch } = useGame()
  const [visible, setVisible] = useState<{ id: string; message: string; type: string; exiting: boolean }[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const currentIds = new Set(state.notifications.map((n) => n.id))

    for (const [id, timer] of timersRef.current) {
      if (!currentIds.has(id)) {
        clearTimeout(timer)
        timersRef.current.delete(id)
      }
    }

    for (const n of state.notifications) {
      if (timersRef.current.has(n.id)) continue
      if (DISMISS_IDS.has(n.id)) continue

      setVisible((prev) => [...prev, { id: n.id, message: n.message, type: n.type, exiting: false }])

      const timer = setTimeout(() => {
        setVisible((prev) => prev.map((v) => v.id === n.id ? { ...v, exiting: true } : v))
        setTimeout(() => {
          DISMISS_IDS.add(n.id)
          setVisible((prev) => prev.filter((v) => v.id !== n.id))
          dispatch({ type: 'DISMISS_NOTIFICATION', id: n.id })
        }, 300)
      }, DISMISS_AFTER_MS)

      timersRef.current.set(n.id, timer)
    }
  }, [state.notifications, dispatch])

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer)
      }
      timersRef.current.clear()
    }
  }, [])

  if (visible.length === 0) return null

  return (
    <div className="fixed top-16 right-2 sm:right-4 z-40 flex flex-col gap-2 pointer-events-none" role="status" aria-live="polite">
      {visible.map((v) => {
        const config = NOTIFICATION_CONFIG[v.type as keyof typeof NOTIFICATION_CONFIG] || NOTIFICATION_CONFIG.system
        return (
          <div
            key={v.id}
            className={`${config.bg} ${config.border} border text-white px-4 py-2.5 rounded-lg shadow-xl text-sm font-medium flex items-center gap-2 pointer-events-auto ${
              v.exiting ? 'animate-[fadeOut_0.3s_ease-in_forwards]' : 'animate-[slideIn_0.3s_ease-out]'
            }`}
          >
            <span className="text-base shrink-0">{config.icon}</span>
            <span className="truncate">{v.message}</span>
          </div>
        )
      })}
    </div>
  )
}
import { useGame } from '../context/useGame'

export default function ErrorBanner() {
  const { state, dispatch } = useGame()

  if (!state.error) return null

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[calc(100%-1rem)]" role="alert" aria-live="assertive">
      <div className="flex items-start gap-2 bg-red-900/95 border border-red-500 text-red-100 px-4 py-3 rounded-lg shadow-xl text-sm">
        <span className="text-base shrink-0" aria-hidden="true">⚠️</span>
        <p className="flex-1 break-words">{state.error}</p>
        <button
          onClick={() => dispatch({ type: 'SET_ERROR', error: null })}
          className="shrink-0 text-red-200 hover:text-white transition"
          aria-label="Cerrar mensaje de error"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

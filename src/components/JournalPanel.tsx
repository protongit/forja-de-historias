import { useGame } from '../context/useGame'
import { useState, useCallback } from 'react'
import CollapsiblePanel from './CollapsiblePanel'
import HoverText from './HoverText'

export default function JournalPanel() {
  const { state, dispatch } = useGame()
  const [filter, setFilter] = useState<string>('all')

  const toggleFavorite = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_FAVORITE_JOURNAL', id })
  }, [dispatch])

  const filtered = filter === 'all'
    ? state.journal
    : filter === 'favorites'
      ? state.journal.filter((e) => e.isFavorite)
      : state.journal.filter((e) => e.eventType === filter)

  const eventIcons: Record<string, string> = {
    discovery: '🗺️',
    encounter: '⚔️',
    dialog: '💬',
    achievement: '🏆',
    milestone: '⭐',
  }

  if (state.journal.length === 0) return null

  return (
    <CollapsiblePanel icon="📖" title="Diario" count={state.journal.length} color="text-amber-400" aria-label="Panel de diario">
      <div className="flex flex-wrap gap-1 mb-2" role="tablist" aria-label="Filtrar entradas del diario">
        {['all', 'discovery', 'encounter', 'dialog', 'achievement', 'milestone', 'favorites'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-2 py-0.5 rounded transition ${filter === f ? 'bg-amber-600 text-white' : 'bg-gray-700 text-gray-300 hover:text-white'}`}
            role="tab"
            aria-selected={filter === f}
            aria-label={f === 'all' ? 'Todas las entradas' : f === 'favorites' ? 'Favoritas' : f}
          >
            {f === 'all' ? 'Todas' : f === 'favorites' ? '⭐' : f}
          </button>
        ))}
      </div>
      <div className="space-y-1.5 max-h-48 overflow-y-auto" role="list" aria-label="Entradas del diario">
        {filtered.map((entry) => (
          <div key={entry.id} className="px-2 py-1.5 bg-gray-700/40 rounded-lg" role="listitem">
            <div className="flex items-start justify-between gap-1">
              <div className="flex items-start gap-1.5 min-w-0">
                <span className="text-xs shrink-0" aria-hidden="true">{eventIcons[entry.eventType] || '📌'}</span>
                <div className="min-w-0">
                  <HoverText className="text-xs text-gray-200 font-medium block truncate" full={entry.title} />
                  <HoverText className="text-xs text-gray-400 block line-clamp-2" full={entry.summary} />
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {entry.location && (
                  <HoverText className="text-xs text-gray-400 truncate max-w-[60px] inline-block align-bottom" full={entry.location} ariaLabel={`Ubicación: ${entry.location}`} />
                )}
                <button
                  onClick={() => toggleFavorite(entry.id)}
                  className="text-xs text-gray-400 hover:text-amber-400 transition"
                  aria-label={entry.isFavorite ? `Quitar ${entry.title} de favoritas` : `Marcar ${entry.title} como favorita`}
                >
                  {entry.isFavorite ? '⭐' : '☆'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </CollapsiblePanel>
  )
}

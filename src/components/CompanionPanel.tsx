import { useGame } from '../context/GameContext'
import CollapsiblePanel from './CollapsiblePanel'

export default function CompanionPanel() {
  const { state, dispatch } = useGame()

  if (state.companions.length === 0) return null

  return (
    <CollapsiblePanel icon="👥" title="Compañeros" count={state.companions.length} color="text-emerald-400" aria-label="Panel de compañeros">
      <div className="space-y-2">
        {state.companions.map((c) => (
          <div key={c.name} className={`px-2.5 py-1.5 rounded-lg text-sm ${c.isActive ? 'bg-gray-700/60' : 'bg-gray-700/30 opacity-60'}`} role="listitem">
            <div className="flex items-center justify-between">
              <span className="font-medium text-emerald-300">{c.name}</span>
              <button
                onClick={() => dispatch({ type: 'SET_COMPANION_ACTIVE', name: c.name, active: !c.isActive })}
                className={`text-xs px-2 py-0.5 rounded transition ${
                  c.isActive ? 'bg-emerald-700 text-emerald-200' : 'bg-gray-600 text-gray-400'
                }`}
                aria-label={`${c.name} ${c.isActive ? 'inactivo' : 'activo'}. Pulsar para ${c.isActive ? 'desactivar' : 'activar'}`}
              >
                {c.isActive ? 'Activo' : 'Inactivo'}
              </button>
            </div>
            {c.description && <p className="text-xs text-gray-400 mt-0.5">{c.description}</p>}
            {c.stats.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {c.stats.map((s) => (
                  <span key={s.name} className="text-xs text-gray-300 bg-gray-700 px-1.5 py-0.5 rounded" aria-label={`${s.name}: ${s.value}`}>
                    {s.name}: {s.value}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </CollapsiblePanel>
  )
}

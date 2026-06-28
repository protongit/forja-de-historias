import { useGame } from '../context/GameContext'
import CollapsiblePanel from './CollapsiblePanel'

export default function StatsPanel() {
  const { state } = useGame()
  const { character } = state

  const xpForNextLevel = state.level * 100
  const xpProgress = Math.min((state.xp / xpForNextLevel) * 100, 100)

  return (
    <CollapsiblePanel icon="👤" title="Personaje" color="text-gray-400" defaultCollapsed={false} aria-label="Panel de personaje">
      {!character ? (
        <p className="text-xs text-gray-500 italic">Pendiente de definir...</p>
      ) : (
        <>
          <p className="text-sm text-gray-200 font-medium mb-1">{character.name}</p>
          {character.background && (
            <p className="text-xs text-gray-400 mb-2 line-clamp-2">{character.background}</p>
          )}

          {/* Level & XP */}
          <div className="mb-2 p-2 bg-gray-700/40 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-yellow-400 font-medium">Nv. {state.level}</span>
              <span className="text-xs text-gray-300">XP: {state.xp}/{xpForNextLevel}</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden" role="progressbar" aria-label="Progreso de experiencia" aria-valuenow={state.xp} aria-valuemin={0} aria-valuemax={xpForNextLevel}>
              <div
                className="h-full bg-yellow-500 rounded-full transition-all"
                style={{ width: `${xpProgress}%` }}
              />
            </div>
          </div>

          {/* Player HP */}
          {character.hp !== undefined && character.maxHp > 0 && (
            <div className="mb-2 p-2 bg-gray-700/40 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-red-400 font-medium flex items-center gap-1">
                  ❤️ Puntos de Vida
                </span>
                <span className={`text-xs font-medium ${
                  character.hp / character.maxHp > 0.5 ? 'text-green-400' :
                  character.hp / character.maxHp > 0.25 ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {character.hp}/{character.maxHp}
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden" role="progressbar" aria-label="Puntos de vida" aria-valuenow={character.hp} aria-valuemin={0} aria-valuemax={character.maxHp}>
                <div
                  className={`h-full rounded-full transition-all ${
                    character.hp / character.maxHp > 0.5 ? 'bg-green-500' :
                    character.hp / character.maxHp > 0.25 ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${(character.hp / character.maxHp) * 100}%` }}
                />
              </div>
            </div>
          )}

          {character.stats.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Estadísticas</h4>
              <div className="space-y-1.5">
                {character.stats.map((stat) => (
                  <div key={stat.name} className="flex items-center gap-2">
                    <span className="text-xs text-gray-300 w-20 shrink-0">{stat.name}</span>
                    <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden" role="progressbar" aria-label={`${stat.name}: ${stat.value}`} aria-valuenow={stat.value} aria-valuemin={1} aria-valuemax={5}>
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${(stat.value / 5) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-300 w-4 text-right font-medium">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {character.skills.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Habilidades</h4>
              <div className="space-y-1.5">
                {character.skills.map((skill) => (
                  <div key={skill.name} className="bg-gray-700/30 rounded-md px-2 py-1">
                    <p className="text-xs text-gray-200 font-medium">{skill.name}</p>
                    <p className="text-xs text-gray-400">{skill.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </CollapsiblePanel>
  )
}

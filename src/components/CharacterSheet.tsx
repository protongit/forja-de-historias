import { useGame } from '../context/GameContext'

export default function CharacterSheet() {
  const { state } = useGame()
  const { character, quest } = state

  if (!character && !quest) return null

  return (
    <div className="bg-gray-800 rounded-xl p-4 shadow-lg space-y-4">
      <h3 className="text-lg font-bold text-indigo-400 border-b border-gray-700 pb-2">
        Ficha de personaje
      </h3>

      {character && (
        <div>
          <p className="text-white font-semibold text-lg">{character.name}</p>
          <p className="text-gray-300 text-sm mt-1">{character.background}</p>

          {character.traits.length > 0 && (
            <div className="mt-2">
              <p className="text-gray-400 text-xs uppercase tracking-wide">Rasgos</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {character.traits.map((trait, i) => (
                  <span key={i} className="px-2 py-0.5 bg-indigo-900/50 text-indigo-300 text-xs rounded-full">
                    {trait}
                  </span>
                ))}
              </div>
            </div>
          )}

          {character.equipment.length > 0 && (
            <div className="mt-2">
              <p className="text-gray-400 text-xs uppercase tracking-wide">Equipo</p>
              <ul className="list-disc list-inside text-gray-300 text-sm mt-1">
                {character.equipment.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {quest && (
        <div className="border-t border-gray-700 pt-3">
          <h4 className="text-md font-bold text-yellow-400">{quest.title}</h4>
          <p className="text-gray-300 text-sm mt-1">{quest.description}</p>

          {quest.objectives.length > 0 && (
            <div className="mt-2">
              <p className="text-gray-400 text-xs uppercase tracking-wide">Objetivos</p>
              <ul className="list-disc list-inside text-gray-300 text-sm mt-1">
                {quest.objectives.map((obj, i) => (
                  <li key={i}>{obj.name}{obj.completed ? ' ✅' : ''}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
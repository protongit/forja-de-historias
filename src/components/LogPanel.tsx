import { useGame } from '../context/GameContext'

export default function LogPanel() {
  const { state } = useGame()
  const { rawLog, showLog } = state

  if (!showLog) return null

  const reversed = [...rawLog].reverse()

  return (
    <div className="border-t border-gray-700 bg-gray-850 shrink-0">
      <div className="p-3">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
          Log de respuestas crudas ({rawLog.length})
        </h3>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {reversed.length === 0 && (
            <p className="text-gray-600 text-xs italic">Sin entradas aún</p>
          )}
          {reversed.map((entry, i) => (
            <details key={rawLog.length - 1 - i} className="bg-gray-800 rounded-lg p-2 text-xs">
              <summary className="text-gray-400 cursor-pointer hover:text-gray-200">
                <span className="text-indigo-400">#{rawLog.length - i}</span>{' '}
                <span className="text-gray-500">{entry.phase}</span>{' '}
                <span className="text-gray-600">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </summary>
              <div className="mt-2 space-y-1.5">
                <div>
                  <span className="text-gray-500">Jugador:</span>
                  <p className="text-gray-300 mt-0.5">{entry.playerMessage}</p>
                </div>
                <div>
                  <span className="text-yellow-500">Respuesta cruda:</span>
                  <pre className="text-gray-300 mt-0.5 whitespace-pre-wrap bg-gray-900 rounded p-1.5 max-h-40 overflow-y-auto">
                    {entry.rawResponse}
                  </pre>
                </div>
                <div>
                  <span className="text-green-500">Comandos ejecutados:</span>
                  <pre className="text-gray-400 mt-0.5 whitespace-pre-wrap">
                    {extractCommands(entry.rawResponse)}
                  </pre>
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  )
}

function extractCommands(raw: string): string {
  const regex = /\[{1,2}(ADD_ITEM|REMOVE_ITEM|SETUP_COMPLETE|GENERATION_COMPLETE|QUEST_COMPLETE|CHARACTER|QUEST)(:\s*[^\]]*)?\]{1,2}/gi
  const commands: string[] = []
  let match
  while ((match = regex.exec(raw)) !== null) {
    commands.push(match[0])
  }
  return commands.join('\n') || '(ninguno)'
}
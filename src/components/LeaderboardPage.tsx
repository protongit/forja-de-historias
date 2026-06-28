import { useState, useEffect } from 'react'

interface LeaderboardEntry {
  username: string
  adventure_name: string
  level: number
  xp_total: number
  enemies_defeated: number
  time_played_ms: number
  result: string
  created_at: string
}

interface Props {
  onBack?: () => void
}

export default function LeaderboardPage({ onBack }: Props) {
  const [data, setData] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<string>('xp_total')

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const sorted = [...data].sort((a, b) => {
    const key = sortBy as keyof LeaderboardEntry
    return (b[key] as number) - (a[key] as number)
  })

  const colClass = (col: string) =>
    `px-2 py-1 text-[11px] text-left cursor-pointer hover:text-indigo-300 transition ${sortBy === col ? 'text-indigo-400 underline' : 'text-gray-400'}`

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <span>🏆</span> Leaderboard
          </h1>
          <button onClick={onBack} className="text-sm text-indigo-400 hover:text-indigo-300 transition">
            ← Volver al juego
          </button>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-12 animate-pulse">Cargando clasificación...</div>
        ) : sorted.length === 0 ? (
          <div className="text-center text-gray-600 py-12">
            <p className="text-4xl mb-4">🏆</p>
            <p>Aún no hay datos. ¡Sé el primero en aparecer!</p>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-xl overflow-hidden shadow-lg">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-750 border-b border-gray-700">
                  <th className="px-2 py-2 text-xs text-gray-400 text-left w-8">#</th>
                  <th className="px-2 py-2 text-xs text-gray-400 text-left">Usuario</th>
                  <th className="px-2 py-2 text-xs text-gray-400 text-left">Aventura</th>
                  <th className={colClass('level')} onClick={() => setSortBy('level')}>Nivel</th>
                  <th className={colClass('xp_total')} onClick={() => setSortBy('xp_total')}>XP</th>
                  <th className={colClass('enemies_defeated')} onClick={() => setSortBy('enemies_defeated')}>Enemigos</th>
                  <th className="px-2 py-2 text-xs text-gray-400 text-left">Estado</th>
                  <th className="px-2 py-2 text-xs text-gray-400 text-left">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((entry, i) => (
                  <tr key={i} className={`border-b border-gray-700/50 ${i < 3 ? 'bg-gray-750/50' : ''} hover:bg-gray-700/30 transition`}>
                    <td className="px-2 py-2 text-sm text-gray-400">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </td>
                    <td className="px-2 py-2 text-sm font-medium text-gray-200">{entry.username}</td>
                    <td className="px-2 py-2 text-sm text-gray-400 truncate max-w-[200px]">{entry.adventure_name || '-'}</td>
                    <td className="px-2 py-2 text-sm text-indigo-400">{entry.level}</td>
                    <td className="px-2 py-2 text-sm text-yellow-400 font-medium">{entry.xp_total}</td>
                    <td className="px-2 py-2 text-sm text-red-400">{entry.enemies_defeated}</td>
                    <td className="px-2 py-2 text-sm">
                      {entry.result === 'success' ? (
                        <span className="text-green-400 flex items-center gap-1">✅ Victoria</span>
                      ) : entry.result === 'failure' ? (
                        <span className="text-red-400 flex items-center gap-1">💀 Derrota</span>
                      ) : (
                        <span className="text-yellow-500 flex items-center gap-1">🔄 En curso</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-xs text-gray-500">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
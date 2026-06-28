import { useState } from 'react'
import { useGame } from '../context/GameContext'
import { PRESET_AVENTURAS, type PresetAdventure } from '../data/presetAdventures'
import { initialStats } from '../context/GameContext'
import type { GameState, JournalEntry, Message, WorldState } from '../types/game'

const initialWorldState: WorldState = {
  currentLocation: null,
  timeOfDay: 'mañana',
  weather: null,
  locations: [],
  npcs: [],
}

const QUICK_SETUP_OPTIONS = {
  generos: ['Fantasía medieval', 'Ciencia ficción', 'Cyberpunk', 'Terror gótico', 'Post-apocalíptico', 'Fantasía oscura'],
  clases: ['Guerrero', 'Mago', 'Pícaro', 'Explorador', 'Hacker', 'Investigador', 'Piloto', 'Bardo'],
  nombres: ['Aria', 'Draven', 'Kira', 'Orion', 'Luna', 'Rex', 'Nova', 'Zephyr', 'Sage', 'Blaze'],
  tonos: ['Épica', 'Misteriosa', 'Alegre', 'Grave y misteriosa', 'Terrorífica', 'Neutral'],
  modosCombate: ['Táctico: con turnos y opciones de ataque/defensa/habilidad/huir', 'Narrativo: el GM narra libremente'],
}

function buildStateFromPreset(preset: PresetAdventure, username: string): GameState {
  const sessionId = crypto.randomUUID()
  const now = Date.now()
  const messages: Message[] = [
    {
      id: crypto.randomUUID(),
      sender: 'system',
      content: `🌟 ${preset.adventureName} — ¡La aventura comienza!`,
      timestamp: now,
    },
    {
      id: crypto.randomUUID(),
      sender: 'gm',
      content: preset.initialMessage,
      timestamp: now + 1,
    },
  ]
  return {
    phase: 'playing',
    aiConfig: { endpoint: '', apiKey: '', model: '', temperature: 0.8 },
    imageConfig: { enabled: false, endpoint: '', apiKey: '', model: 'flux-2-klein', size: '1024x1024' },
    tts: { enabled: false, mode: 'browser', endpoint: '', apiKey: '', model: '', voice: '', rate: 1, pitch: 1, autoPlay: false, emotion: preset.ttsEmotion },
    messages,
    character: preset.character,
    quest: {
      ...preset.quest,
      objectives: preset.quest.objectives.map((o) => ({ name: o, completed: false })),
    },
    setupAnswers: preset.setupAnswers,
    aiModelInfo: '',
    error: null,
    isWaitingAI: false,
    isEphemeral: false,
    currentUser: username,
    inventory: preset.inventory,
    notes: '',
    rawLog: [],
    showLog: false,
    pendingDiceCheck: null,
    diceAutoRoll: true,
    combatMode: preset.combatMode,
    combatActive: false,
    combatTurn: 0,
    enemies: [],
    xp: 0,
    level: 1,
    companions: [],
    journal: preset.initialJournalEntry
      ? [{
          id: crypto.randomUUID(),
          title: preset.initialJournalEntry.title,
          summary: preset.initialJournalEntry.summary,
          timestamp: Date.now(),
          eventType: 'milestone',
          isFavorite: false,
        } as JournalEntry]
      : [],
    worldState: initialWorldState,
    gameStats: { ...initialStats },
    notifications: [],
    adventureName: preset.adventureName,
    statsSessionId: sessionId,
    saves: [],
    currentSaveSlot: username || null,
  }
}

interface Props {
  onBack?: () => void
  onStartCustom?: () => void
  onStart?: () => void
  onQuickSetup?: (answers: Record<string, string>) => void
}

export default function PresetAdventurePicker({ onBack, onStartCustom, onStart, onQuickSetup }: Props) {
  const { state, dispatch } = useGame()
  const [selected, setSelected] = useState<string | null>(null)
  const [showQuickSetup, setShowQuickSetup] = useState(false)
  const [quickGenre, setQuickGenre] = useState('')
  const [quickClass, setQuickClass] = useState('')
  const [quickName, setQuickName] = useState('')

  function handleSelect(preset: PresetAdventure) {
    setSelected(preset.id)
  }

  function handleStart() {
    const preset = PRESET_AVENTURAS.find((p) => p.id === selected)
    if (!preset) return
    const gameState = buildStateFromPreset(preset, state.currentUser || crypto.randomUUID().slice(0, 8))
    gameState.aiConfig = state.aiConfig
    gameState.tts = { ...gameState.tts, ...state.tts, emotion: preset.ttsEmotion }
    dispatch({ type: 'LOAD_STATE', state: gameState })
    onStart?.()
  }

  function handleRandom() {
    const preset = PRESET_AVENTURAS[Math.floor(Math.random() * PRESET_AVENTURAS.length)]
    const gameState = buildStateFromPreset(preset, state.currentUser || crypto.randomUUID().slice(0, 8))
    gameState.aiConfig = state.aiConfig
    gameState.tts = { ...gameState.tts, ...state.tts, emotion: preset.ttsEmotion }
    dispatch({ type: 'LOAD_STATE', state: gameState })
    onStart?.()
  }

  function handleQuickSetup() {
    const answers: Record<string, string> = {
      ambientacion: quickGenre || QUICK_SETUP_OPTIONS.generos[Math.floor(Math.random() * QUICK_SETUP_OPTIONS.generos.length)],
      ficha: 'Ficha detallada',
      clase: quickClass || QUICK_SETUP_OPTIONS.clases[Math.floor(Math.random() * QUICK_SETUP_OPTIONS.clases.length)],
      personalidad: 'Aventurero y decidido',
      nombre: quickName || QUICK_SETUP_OPTIONS.nombres[Math.floor(Math.random() * QUICK_SETUP_OPTIONS.nombres.length)],
      tono_narrador: QUICK_SETUP_OPTIONS.tonos[Math.floor(Math.random() * QUICK_SETUP_OPTIONS.tonos.length)],
      modo_combate: QUICK_SETUP_OPTIONS.modosCombate[Math.floor(Math.random() * QUICK_SETUP_OPTIONS.modosCombate.length)],
    }
    onQuickSetup?.(answers)
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <span>🎮</span> Aventuras precargadas
        </h1>
        {onBack && (
          <button
            onClick={onBack}
            className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition"
          >
            ← Volver
          </button>
        )}
      </div>
      <p className="text-gray-400 text-sm mb-6">
        Elige una aventura lista para jugar. No necesitas configurar nada — el personaje, la misión y el mundo ya están preparados.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {PRESET_AVENTURAS.map((p) => (
          <button
            key={p.id}
            onClick={() => handleSelect(p)}
            className={`w-full text-left p-4 rounded-xl border-2 transition ${
              selected === p.id
                ? 'bg-indigo-900/40 border-indigo-500'
                : 'bg-gray-800 border-gray-700 hover:border-gray-500 hover:bg-gray-750'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">{p.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-base font-bold text-white">{p.title}</h3>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    p.difficulty === 'Fácil' ? 'bg-green-700 text-green-200' :
                    p.difficulty === 'Media' ? 'bg-yellow-700 text-yellow-200' :
                    'bg-red-700 text-red-200'
                  }`}>
                    {p.difficulty}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mb-0.5">{p.subtitle}</p>
                <p className="text-xs text-gray-300 line-clamp-2">{p.description}</p>
                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-500">
                  <span>{p.character.name}</span>
                  <span>⚔️ {p.combatMode === 'tactical' ? 'Táctico' : 'Narrativo'}</span>
                  <span>⏱ {p.estimatedTime}</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        {selected && (
          <button
            onClick={handleStart}
            className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition text-lg"
          >
            🎮 ¡Comenzar aventura!
          </button>
        )}
        <button
          onClick={handleRandom}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition text-sm"
        >
          🎲 Sorpréndeme
        </button>
        <button
          onClick={() => setShowQuickSetup(!showQuickSetup)}
          className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium rounded-xl transition text-sm"
        >
          ⚡ Configuración rápida
        </button>
        {onStartCustom && (
          <button
            onClick={onStartCustom}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium rounded-xl transition text-sm"
          >
            ✨ Crear aventura personalizada
          </button>
        )}
      </div>

      {showQuickSetup && (
        <div className="mt-4 p-4 bg-gray-800 border border-gray-700 rounded-xl space-y-3">
          <h3 className="text-sm font-bold text-white">Configuración rápida</h3>
          <p className="text-xs text-gray-400">Elige tus preferencias o déjalo al azar. La IA generará tu aventura.</p>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Género</label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_SETUP_OPTIONS.generos.map((g) => (
                <button
                  key={g}
                  onClick={() => setQuickGenre(quickGenre === g ? '' : g)}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                    quickGenre === g
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Clase del personaje</label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_SETUP_OPTIONS.clases.map((c) => (
                <button
                  key={c}
                  onClick={() => setQuickClass(quickClass === c ? '' : c)}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                    quickClass === c
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Nombre del personaje</label>
            <input
              type="text"
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              placeholder="Dejar vacío para nombre aleatorio"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleQuickSetup}
              className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition text-sm"
            >
              ⚡ Generar aventura
            </button>
            <button
              onClick={() => setShowQuickSetup(false)}
              className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl transition text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
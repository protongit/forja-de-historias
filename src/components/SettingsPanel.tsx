import { useState, useEffect } from 'react'
import { useGame } from '../context/GameContext'
import { validateConnection } from '../services/aiService'
import { userDataKey } from '../services/authService'
import { getVoices } from '../services/ttsService'
import type { AIConfig, ImageConfig, TTSConfig } from '../types/game'

function loadSavedConfig(username: string | null): AIConfig | null {
  if (!username) return null
  try {
    const raw = localStorage.getItem(userDataKey(username, 'ai-config'))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveConfig(username: string | null, config: AIConfig): void {
  if (!username) return
  localStorage.setItem(userDataKey(username, 'ai-config'), JSON.stringify(config))
}

function loadSavedTTS(username: string | null): TTSConfig | null {
  if (!username) return null
  try {
    const raw = localStorage.getItem(userDataKey(username, 'tts-config'))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveTTSConfig(username: string | null, tts: TTSConfig): void {
  if (!username) return
  localStorage.setItem(userDataKey(username, 'tts-config'), JSON.stringify(tts))
}

function loadSavedImageConfig(username: string | null): ImageConfig | null {
  if (!username) return null
  try {
    const raw = localStorage.getItem(userDataKey(username, 'image-config'))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveImageConfig(username: string | null, config: ImageConfig): void {
  if (!username) return
  localStorage.setItem(userDataKey(username, 'image-config'), JSON.stringify(config))
}

export default function SettingsPanel({ onClose }: { onClose?: () => void }) {
  const { state, dispatch } = useGame()
  const savedConfig = loadSavedConfig(state.currentUser)
  const savedTTS = loadSavedTTS(state.currentUser)
  const savedImageConfig = loadSavedImageConfig(state.currentUser)
  const [config, setConfig] = useState<AIConfig>(savedConfig ?? state.aiConfig)
  const [tts, setTTS] = useState<TTSConfig>(savedTTS ?? state.tts)
  const [imageConfig, setImageConfig] = useState<ImageConfig>(savedImageConfig ?? state.imageConfig)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle')
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    const saved = loadSavedConfig(state.currentUser)
    if (saved) setConfig(saved)
    const savedT = loadSavedTTS(state.currentUser)
    if (savedT) setTTS(savedT)
    const savedI = loadSavedImageConfig(state.currentUser)
    if (savedI) setImageConfig(savedI)
  }, [state.currentUser])

  useEffect(() => {
    const load = () => setVoices(getVoices())
    load()
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = load
    }
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null
      }
    }
  }, [])

  function updateConfig(partial: Partial<AIConfig>) {
    const next = { ...config, ...partial }
    setConfig(next)
    saveConfig(state.currentUser, next)
  }

  function updateTTS(partial: Partial<TTSConfig>) {
    const next = { ...tts, ...partial }
    setTTS(next)
    dispatch({ type: 'SET_TTS_CONFIG', config: next })
    saveTTSConfig(state.currentUser, next)
  }

  function updateImageConfig(partial: Partial<ImageConfig>) {
    const next = { ...imageConfig, ...partial }
    setImageConfig(next)
    dispatch({ type: 'SET_IMAGE_CONFIG', config: next })
    saveImageConfig(state.currentUser, next)
  }

  async function handleTest() {
    setTesting(true)
    setTestResult('idle')
    const ok = await validateConnection(config)
    setTestResult(ok ? 'success' : 'error')
    setTesting(false)
  }

  function handleStart() {
    dispatch({ type: 'SET_AI_CONFIG', config })
    dispatch({ type: 'SET_IMAGE_CONFIG', config: imageConfig })
    dispatch({ type: 'SET_TTS_CONFIG', config: tts })
    if (onClose) {
      onClose()
    } else {
      dispatch({ type: 'SET_PHASE', phase: 'setup' })
    }
  }

  function handleLoadSample() {
    if (config.endpoint.includes('openai')) {
      updateConfig({ endpoint: 'http://localhost:11434/v1', model: 'llama3' })
    } else {
      updateConfig({ endpoint: 'https://api.openai.com/v1', model: 'gpt-4o-mini' })
    }
    setTestResult('idle')
  }

  const selectedVoice = voices.find((v) => v.voiceURI === tts.voice || v.name === tts.voice)

  const emotionOptions = [
    { value: 'neutral', label: 'Neutral', icon: '😐', rate: 1.0, pitch: 1.0 },
    { value: 'grave', label: 'Grave y misteriosa', icon: '🎭', rate: 0.7, pitch: 0.6 },
    { value: 'alegre', label: 'Alegre', icon: '😊', rate: 1.3, pitch: 1.3 },
    { value: 'epico', label: 'Épica', icon: '⚔️', rate: 0.8, pitch: 1.1 },
    { value: 'misterioso', label: 'Misteriosa', icon: '🔮', rate: 0.8, pitch: 0.8 },
    { value: 'susurro', label: 'Susurrante', icon: '🤫', rate: 0.6, pitch: 0.9 },
    { value: 'terrorifico', label: 'Terrorífica', icon: '👻', rate: 0.5, pitch: 0.5 },
  ]

  return (
    <div className="max-w-lg mx-auto mt-6 p-6 bg-gray-800 rounded-xl shadow-xl">
      <h2 className="text-2xl font-bold text-white mb-6">Configuración</h2>

      <div className="space-y-6">
        <div>
          <h3 className="text-md font-semibold text-indigo-400 mb-3">🤖 Modelo de IA</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Endpoint</label>
              <input
                type="text"
                value={config.endpoint}
                onChange={(e) => updateConfig({ endpoint: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="https://api.openai.com/v1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">API Key</label>
              <input
                type="password"
                value={config.apiKey}
                onChange={(e) => updateConfig({ apiKey: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="sk-..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Modelo</label>
              <input
                type="text"
                value={config.model}
                onChange={(e) => updateConfig({ model: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="gpt-4o-mini"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Temperatura: {config.temperature}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={config.temperature}
                onChange={(e) => updateConfig({ temperature: parseFloat(e.target.value) })}
                className="w-full accent-indigo-500"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleTest}
                disabled={testing}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition disabled:opacity-50 text-sm"
              >
                {testing ? 'Probando...' : 'Probar conexión'}
              </button>
              <button onClick={handleLoadSample} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition text-sm">🔄</button>
            </div>
            {testResult === 'success' && <p className="text-green-400 text-sm">Conexión exitosa</p>}
            {testResult === 'error' && <p className="text-red-400 text-sm">Error de conexión</p>}
          </div>
        </div>

        <div className="border-t border-gray-700 pt-4">
          <h3 className="text-md font-semibold text-green-400 mb-3">🔊 Narrador por voz (TTS)</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={tts.enabled}
                onChange={(e) => updateTTS({ enabled: e.target.checked })}
                className="accent-green-500"
                id="tts-enable"
              />
              <label htmlFor="tts-enable" className="text-sm text-gray-300">Activar narrador por voz</label>
            </div>

            {tts.enabled && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Origen del TTS</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateTTS({ mode: 'browser' })}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                        tts.mode === 'browser'
                          ? 'bg-green-700 text-white border border-green-500'
                          : 'bg-gray-700 text-gray-400 hover:text-gray-200 border border-gray-600'
                      }`}
                    >
                      Navegador
                    </button>
                    <button
                      onClick={() => updateTTS({ mode: 'external' })}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                        tts.mode === 'external'
                          ? 'bg-green-700 text-white border border-green-500'
                          : 'bg-gray-700 text-gray-400 hover:text-gray-200 border border-gray-600'
                      }`}
                    >
                      API externa
                    </button>
                  </div>
                </div>

                {tts.mode === 'browser' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Voz del navegador</label>
                    <select
                      value={tts.voice}
                      onChange={(e) => updateTTS({ voice: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 outline-none text-sm"
                    >
                      <option value="">Automática (español)</option>
                      {voices
                        .filter((v) => v.lang.startsWith('es'))
                        .map((v) => (
                          <option key={v.voiceURI} value={v.voiceURI}>
                            {v.name} ({v.lang})
                          </option>
                        ))}
                      {voices
                        .filter((v) => !v.lang.startsWith('es'))
                        .map((v) => (
                          <option key={v.voiceURI} value={v.voiceURI}>
                            {v.name} ({v.lang})
                          </option>
                        ))}
                    </select>
                    {selectedVoice && (
                      <p className="text-xs text-gray-500 mt-1">{selectedVoice.name} — {selectedVoice.lang}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Endpoint</label>
                      <input
                        type="text"
                        value={tts.endpoint}
                        onChange={(e) => updateTTS({ endpoint: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 outline-none"
                        placeholder="https://api.openai.com/v1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">API Key</label>
                      <input
                        type="password"
                        value={tts.apiKey}
                        onChange={(e) => updateTTS({ apiKey: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 outline-none"
                        placeholder="sk-..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Modelo</label>
                      <input
                        type="text"
                        value={tts.model}
                        onChange={(e) => updateTTS({ model: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 outline-none"
                        placeholder="tts-1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Voz</label>
                      <input
                        type="text"
                        value={tts.voice}
                        onChange={(e) => updateTTS({ voice: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 outline-none"
                        placeholder="alloy, echo, fable, onyx, nova, shimmer..."
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Velocidad: {tts.rate.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={tts.rate}
                    onChange={(e) => updateTTS({ rate: parseFloat(e.target.value) })}
                    className="w-full accent-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Tono: {tts.pitch.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={tts.pitch}
                    onChange={(e) => updateTTS({ pitch: parseFloat(e.target.value) })}
                    className="w-full accent-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Emoción del narrador</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {emotionOptions.map((em) => (
                      <button
                        key={em.value}
                        onClick={() => {
                          updateTTS({ emotion: em.value as any, rate: em.rate, pitch: em.pitch })
                        }}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-left transition ${
                          tts.emotion === em.value
                            ? 'bg-green-700 text-white border border-green-500'
                            : 'bg-gray-700 text-gray-400 hover:text-gray-200 border border-gray-600'
                        }`}
                      >
                        <span>{em.icon}</span>
                        <span className="truncate">{em.label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1">Al cambiar la emoción se ajustan velocidad y tono automáticamente</p>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="border-t border-gray-700 pt-4">
          <h3 className="text-md font-semibold text-purple-400 mb-3">🎨 Generación de imágenes</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={imageConfig.enabled}
                onChange={(e) => updateImageConfig({ enabled: e.target.checked })}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500"
              />
              <label className="text-sm text-gray-300">Habilitar generación de imágenes</label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Endpoint</label>
              <input
                type="text"
                value={imageConfig.endpoint}
                onChange={(e) => updateImageConfig({ endpoint: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 outline-none"
                placeholder="https://api.openai.com/v1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">API Key</label>
              <input
                type="password"
                value={imageConfig.apiKey}
                onChange={(e) => updateImageConfig({ apiKey: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 outline-none"
                placeholder="sk-..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Modelo</label>
              <input
                type="text"
                value={imageConfig.model}
                onChange={(e) => updateImageConfig({ model: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 outline-none"
                placeholder="flux-2-klein"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Tamaño</label>
              <select
                value={imageConfig.size}
                onChange={(e) => updateImageConfig({ size: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 outline-none text-sm"
              >
                <option value="1024x1024">1024 × 1024</option>
                <option value="1536x1024">1536 × 1024</option>
                <option value="1024x1536">1024 × 1536</option>
              </select>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-300">Partida efímera</label>
            <input
              type="checkbox"
              checked={state.isEphemeral}
              onChange={() => dispatch({ type: 'SET_EPHEMERAL', ephemeral: !state.isEphemeral })}
              className="accent-indigo-500"
            />
          </div>
        </div>

        {state.error && (
          <p className="text-red-400 text-sm bg-red-900/30 p-2 rounded">{state.error}</p>
        )}

        <button
          onClick={handleStart}
          className="w-full mt-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition"
        >
          {onClose ? 'Guardar cambios' : 'Comenzar aventura'}
        </button>
      </div>
    </div>
  )
}
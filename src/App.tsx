import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from './context/GameContext'
import SettingsPanel from './components/SettingsPanel'
import ChatInterface from './components/ChatInterface'
import SaveLoadPanel from './components/SaveLoadPanel'
import AuthPanel from './components/AuthPanel'
import InventoryPanel from './components/InventoryPanel'
import Notepad from './components/Notepad'
import StatsPanel from './components/StatsPanel'
import CombatPanel from './components/CombatPanel'
import CompanionPanel from './components/CompanionPanel'
import JournalPanel from './components/JournalPanel'
import GameStatsPanel from './components/GameStatsPanel'
import DiceRollOverlay from './components/DiceRollOverlay'
import LogPanel from './components/LogPanel'
import LeaderboardPage from './components/LeaderboardPage'
import PresetAdventurePicker from './components/PresetAdventurePicker'
import NotificationToast from './components/NotificationToast'
import ConfirmDialog from './components/ConfirmDialog'
import { version } from './version'
import { getPhaseLabel } from './utils/gameEngine'
import { stopSpeaking } from './services/ttsService'
import { listUsers, userDataKey, logout, deleteAccount } from './services/authService'

function loadSavedConfig(username: string | null) {
  if (!username) return null
  try {
    const raw = localStorage.getItem(userDataKey(username, 'ai-config'))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function loadSavedTTS(username: string | null) {
  if (!username) return null
  try {
    const raw = localStorage.getItem(userDataKey(username, 'tts-config'))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

type MobileTab = 'chat' | 'stats' | 'journal' | 'save'

export default function App() {
  const { state, dispatch } = useGame()
  const hasAddedGreeting = useRef(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [page, setPage] = useState<'game' | 'leaderboard' | 'preset'>('game')
  const [mobileTab, setMobileTab] = useState<MobileTab>('chat')
  const [quickSetupAnswers, setQuickSetupAnswers] = useState<Record<string, string> | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    title: string
    message: string
    variant?: 'danger' | 'warning' | 'default'
    confirmLabel?: string
    cancelLabel?: string
    onConfirm: () => void
  } | null>(null)

  const requestConfirm = useCallback((title: string, message: string, onConfirm: () => void, variant: 'danger' | 'warning' | 'default' = 'danger', confirmLabel = 'Confirmar', cancelLabel = 'Cancelar') => {
    setConfirmAction({ title, message, variant, confirmLabel, cancelLabel, onConfirm })
  }, [])

  useEffect(() => {
    if (state.phase === 'setup' && !hasAddedGreeting.current) {
      hasAddedGreeting.current = true
      dispatch({
        type: 'ADD_MESSAGE',
        message: {
          id: crypto.randomUUID(),
          sender: 'gm',
          content: '¡Bienvenido, aventurero! Soy tu Director de Juego. Voy a hacerte algunas preguntas para crear una aventura a tu medida.\n\nCuéntame, ¿qué tipo de mundo te gustaría explorar? (fantasía medieval, ciencia ficción, terror, cyberpunk, histórico...)',
          timestamp: Date.now(),
        },
      })
    }
  }, [state.phase, dispatch])

  useEffect(() => {
    if (!state.currentUser) return
    if (state.phase !== 'config') return

    if (state.currentUser.startsWith('invitado_')) {
      setPage('preset')
      return
    }

    const registeredUsers = listUsers()
    if (!registeredUsers.includes(state.currentUser)) return

    const savedConfig = loadSavedConfig(state.currentUser)
    const savedTTS = loadSavedTTS(state.currentUser)

    if (savedConfig && savedTTS) {
      dispatch({ type: 'SET_AI_CONFIG', config: savedConfig })
      dispatch({ type: 'SET_TTS_CONFIG', config: savedTTS })
      setPage('preset')
    }
  }, [state.currentUser, state.phase, dispatch])

  function handleLogout() {
    logout()
    dispatch({ type: 'RESET' })
    dispatch({ type: 'SET_USER', username: null })
    setUserMenuOpen(false)
  }

  function handleDeleteAccount() {
    requestConfirm(
      'Eliminar cuenta',
      '¿Eliminar tu cuenta? Se borrarán todos tus datos guardados. Esta acción no se puede deshacer.',
      () => {
        if (!state.currentUser) return
        deleteAccount(state.currentUser)
        dispatch({ type: 'RESET' })
        dispatch({ type: 'SET_USER', username: null })
        setUserMenuOpen(false)
      },
      'danger',
      'Eliminar',
      'Cancelar'
    )
  }

  const isGamePhase = state.phase === 'setup' || state.phase === 'generation' || state.phase === 'playing' || state.phase === 'completed'

  const hasNotifications = state.notifications.length > 0

  if (!state.currentUser) {
    return (
      <div className="h-screen bg-gray-900 text-white flex flex-col">
        <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-center shrink-0">
          <h1 className="text-xl font-bold text-indigo-400">📖 Forja de Historias <span className="text-[10px] text-gray-600 ml-1">v{version}</span></h1>
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <AuthPanel requestConfirm={requestConfirm} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between shrink-0" role="banner">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-indigo-400">📖 Forja de Historias <span className="text-[10px] text-gray-600 ml-1">v{version}</span></h1>
          {isGamePhase && (
            <span className="px-2 py-0.5 bg-indigo-900/50 text-indigo-300 text-xs rounded-full hidden sm:inline">
              {getPhaseLabel(state.phase)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {hasNotifications && (
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" aria-label="Notificaciones nuevas" />
          )}
          {page !== 'leaderboard' && page !== 'preset' && (
            <button
              onClick={() => setPage('preset')}
              className="px-1.5 sm:px-2.5 py-1 rounded text-xs font-medium bg-gray-700 text-gray-400 hover:text-green-300 transition flex items-center gap-1"
              title="Nueva partida"
              aria-label="Nueva partida"
            >
              🆕 <span className="hidden sm:inline">Nueva</span>
            </button>
          )}
          {page !== 'leaderboard' && (
            <button
              onClick={() => setPage('leaderboard')}
              className="px-1.5 sm:px-2.5 py-1 rounded text-xs font-medium bg-gray-700 text-gray-400 hover:text-yellow-300 transition flex items-center gap-1"
              title="Leaderboard"
              aria-label="Ver ranking"
            >
              🏆 <span className="hidden sm:inline">Ranking</span>
            </button>
          )}
          {state.phase !== 'config' && (
            <>
              {state.tts.enabled && (
                <>
                  <button
                    onClick={() => {
                      const next = { ...state.tts, autoPlay: !state.tts.autoPlay }
                      dispatch({ type: 'SET_TTS_CONFIG', config: next })
                    }}
                    className={`px-1.5 sm:px-2.5 py-1 rounded text-xs font-medium transition hidden sm:inline ${
                      state.tts.autoPlay ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-gray-200'
                    }`}
                    title={state.tts.autoPlay ? 'Auto-lectura activada' : 'Auto-lectura desactivada'}
                    aria-label={state.tts.autoPlay ? 'Desactivar auto-lectura' : 'Activar auto-lectura'}
                  >
                    {state.tts.autoPlay ? '🔊 Auto' : '🔇 Auto'}
                  </button>
                  <button
                    onClick={() => stopSpeaking()}
                    className="px-1.5 sm:px-2 py-1 rounded text-xs bg-gray-700 text-gray-400 hover:text-gray-200 transition hidden sm:inline"
                    title="Detener narración"
                    aria-label="Detener narración"
                  >
                    ⏹
                  </button>
                </>
              )}
              <label
                className={`px-1.5 sm:px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer hidden sm:inline ${
                  state.diceAutoRoll ? 'bg-yellow-700 text-yellow-200' : 'bg-gray-700 text-gray-400 hover:text-gray-200'
                }`}
                title="Tirada automática de dados"
              >
                <input
                  type="checkbox"
                  checked={state.diceAutoRoll}
                  onChange={(e) => dispatch({ type: 'SET_DICE_AUTO_ROLL', autoRoll: e.target.checked })}
                  className="mr-1"
                  aria-label="Tirada automática de dados"
                />
                🎲 Auto
              </label>
              {!state.currentUser.startsWith('invitado_') && (
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="px-1.5 sm:px-2.5 py-1 rounded text-xs font-medium bg-gray-700 text-gray-400 hover:text-gray-200 transition"
                  title="Configuración"
                  aria-label="Abrir configuración"
                >
                  ⚙️
                </button>
              )}
            </>
          )}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-700 transition"
              aria-label="Menú de usuario"
              aria-expanded={userMenuOpen}
            >
              <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                {state.currentUser[0].toUpperCase()}
              </div>
              <span className="text-xs text-gray-400 max-w-[60px] sm:max-w-[120px] truncate">
                {state.currentUser}
              </span>
              <svg className={`w-3 h-3 text-gray-500 transition ${userMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1" role="menu" aria-label="Menú de opciones">
                  {!state.currentUser.startsWith('invitado_') && (
                    <button
                      onClick={() => { setSettingsOpen(true); setUserMenuOpen(false) }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition flex items-center gap-2"
                      role="menuitem"
                    >
                      ⚙️ Configuración
                    </button>
                  )}
                  <button
                    onClick={() => { dispatch({ type: 'TOGGLE_LOG' }); setUserMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition flex items-center gap-2"
                    role="menuitem"
                  >
                    📋 {state.showLog ? 'Ocultar log' : 'Mostrar log'}
                  </button>
                  <hr className="border-gray-700 my-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition flex items-center gap-2"
                    role="menuitem"
                  >
                    🚪 Cerrar sesión
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700 transition flex items-center gap-2"
                    role="menuitem"
                  >
                    🗑️ Eliminar cuenta
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {page === 'leaderboard' ? (
        <div className="flex-1 overflow-y-auto">
          <LeaderboardPage onBack={() => setPage('game')} />
        </div>
      ) : page === 'preset' ? (
        <div className="flex-1 overflow-y-auto">
          <PresetAdventurePicker
            onStart={() => setPage('game')}
            onStartCustom={() => {
              setPage('game')
              dispatch({ type: 'SET_PHASE', phase: 'setup' })
            }}
            onQuickSetup={(answers) => {
              setQuickSetupAnswers(answers)
              setPage('game')
              dispatch({ type: 'SET_PHASE', phase: 'generation' })
            }}
          />
        </div>
      ) : state.phase === 'config' ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <SettingsPanel />
        </div>
      ) : isGamePhase ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Mobile: switch content based on tab */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 lg:flex">
            {mobileTab === 'chat' && (
              <div className="flex-1 flex flex-col min-w-0 min-h-0">
                <ChatInterface quickSetupAnswers={quickSetupAnswers} onQuickSetupConsumed={() => setQuickSetupAnswers(null)} />
                <LogPanel />
              </div>
            )}
            {mobileTab === 'stats' && (
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 lg:hidden">
                <CombatPanel />
                <StatsPanel />
                <GameStatsPanel />
                <InventoryPanel />
                <CompanionPanel />
              </div>
            )}
            {mobileTab === 'journal' && (
              <div className="flex-1 overflow-y-auto p-3 lg:hidden">
                <JournalPanel />
              </div>
            )}
            {mobileTab === 'save' && (
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 lg:hidden">
                <SaveLoadPanel requestConfirm={requestConfirm} />
                <Notepad />
              </div>
            )}
          </div>

          {/* Desktop sidebar */}
          <aside className="w-72 bg-gray-800 border-l border-gray-700 p-3 flex flex-col gap-3 overflow-y-auto shrink-0 hidden lg:flex max-h-full" role="complementary" aria-label="Paneles del juego">
            <CombatPanel />
            <StatsPanel />
            <InventoryPanel />
            <CompanionPanel />
            <JournalPanel />
            <GameStatsPanel />
            <Notepad />
            <SaveLoadPanel requestConfirm={requestConfirm} />
          </aside>
        </div>
      ) : null}

      <DiceRollOverlay />
      <NotificationToast />

      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        variant={confirmAction?.variant}
        confirmLabel={confirmAction?.confirmLabel}
        cancelLabel={confirmAction?.cancelLabel}
        onConfirm={() => {
          confirmAction?.onConfirm()
          setConfirmAction(null)
        }}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Mobile bottom tab bar */}
      {isGamePhase && (
        <nav className="md:hidden bg-gray-800 border-t border-gray-700 flex shrink-0" role="navigation" aria-label="Navegación móvil">
          <button
            onClick={() => setMobileTab('chat')}
            className={`flex-1 py-2.5 text-center text-xs font-medium transition ${
              mobileTab === 'chat' ? 'text-indigo-400 border-t-2 border-indigo-400 bg-indigo-900/30' : 'text-gray-400 hover:text-gray-200'
            }`}
            aria-label="Chat"
            aria-current={mobileTab === 'chat' ? 'page' : undefined}
          >
            💬 Chat
          </button>
          <button
            onClick={() => setMobileTab('stats')}
            className={`flex-1 py-2.5 text-center text-xs font-medium transition ${
              mobileTab === 'stats' ? 'text-indigo-400 border-t-2 border-indigo-400 bg-indigo-900/30' : 'text-gray-400 hover:text-gray-200'
            }`}
            aria-label="Personaje"
            aria-current={mobileTab === 'stats' ? 'page' : undefined}
          >
            👤 Personaje
          </button>
          <button
            onClick={() => setMobileTab('journal')}
            className={`flex-1 py-2.5 text-center text-xs font-medium transition relative ${
              mobileTab === 'journal' ? 'text-indigo-400 border-t-2 border-indigo-400 bg-indigo-900/30' : 'text-gray-400 hover:text-gray-200'
            }`}
            aria-label="Diario"
            aria-current={mobileTab === 'journal' ? 'page' : undefined}
          >
            📖 Diario
            {state.journal.length > 0 && (
              <span className="absolute top-1.5 right-1/3 w-2 h-2 bg-indigo-400 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setMobileTab('save')}
            className={`flex-1 py-2.5 text-center text-xs font-medium transition ${
              mobileTab === 'save' ? 'text-indigo-400 border-t-2 border-indigo-400 bg-indigo-900/30' : 'text-gray-400 hover:text-gray-200'
            }`}
            aria-label="Guardar"
            aria-current={mobileTab === 'save' ? 'page' : undefined}
          >
            💾 Guardar
          </button>
        </nav>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative max-h-[90vh] overflow-y-auto rounded-xl">
            <button
              onClick={() => setSettingsOpen(false)}
              className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-white rounded-full text-sm transition"
              aria-label="Cerrar configuración"
            >
              ✕
            </button>
            <SettingsPanel onClose={() => setSettingsOpen(false)} />
          </div>
        </div>
      )}
    </div>
  )
}

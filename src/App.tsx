import { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react'
import { useGame } from './context/useGame'
import ChatInterface from './components/ChatInterface'
import AuthPanel from './components/AuthPanel'
import InventoryPanel from './components/InventoryPanel'
import Notepad from './components/Notepad'
import StatsPanel from './components/StatsPanel'
import CombatPanel from './components/CombatPanel'
import CompanionPanel from './components/CompanionPanel'
import JournalPanel from './components/JournalPanel'
import GameStatsPanel from './components/GameStatsPanel'
import LogPanel from './components/LogPanel'
import NotificationToast from './components/NotificationToast'
import ErrorBanner from './components/ErrorBanner'
import ConfirmDialog from './components/ConfirmDialog'
import { version } from './version'

const SettingsPanel = lazy(() => import('./components/SettingsPanel'))
const SaveLoadPanel = lazy(() => import('./components/SaveLoadPanel'))
const DiceRollOverlay = lazy(() => import('./components/DiceRollOverlay'))
const LeaderboardPage = lazy(() => import('./components/LeaderboardPage'))
const PresetAdventurePicker = lazy(() => import('./components/PresetAdventurePicker'))
import { getPhaseLabel } from './utils/gameEngine'
import { stopSpeaking } from './services/ttsService'
import { listUsers, logout, deleteAccount } from './services/authService'
import { loadSavedConfig, loadSavedTTS } from './services/configService'

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
    if (!state.currentUser || state.phase !== 'config') return

    const isGuest = state.currentUser.startsWith('invitado_')
    if (isGuest) {
      dispatch({ type: 'SET_CONFIGS_RESTORED', restored: true })
      return
    }

    const registeredUsers = listUsers()
    if (!registeredUsers.includes(state.currentUser)) return

    const savedConfig = loadSavedConfig(state.currentUser)
    const savedTTS = loadSavedTTS(state.currentUser)

    if (savedConfig && savedTTS) {
      dispatch({ type: 'SET_AI_CONFIG', config: savedConfig })
      dispatch({ type: 'SET_TTS_CONFIG', config: savedTTS })
      dispatch({ type: 'SET_CONFIGS_RESTORED', restored: true })
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

  useEffect(() => {
    if (!settingsOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSettingsOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settingsOpen])

  useEffect(() => {
    if (!userMenuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setUserMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [userMenuOpen])

  const isGamePhase = state.phase === 'setup' || state.phase === 'generation' || state.phase === 'playing' || state.phase === 'completed'

  const hasNotifications = state.notifications.length > 0

  const isGuestUser = !!state.currentUser?.startsWith('invitado_')
  const autoPreset = state.phase === 'config' && !!state.currentUser && (isGuestUser || state.configsRestored)
  const view: 'game' | 'leaderboard' | 'preset' | 'config' =
    page === 'leaderboard' ? 'leaderboard'
      : page === 'preset' || autoPreset ? 'preset'
      : state.phase === 'config' ? 'config'
      : 'game'

  if (!state.currentUser) {
    return (
      <div className="h-screen bg-gray-900 text-white flex flex-col">
        <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-center shrink-0">
          <h1 className="text-xl font-bold text-indigo-400">📖 Forja de Historias <span className="text-[10px] text-gray-400 ml-1">v{version}</span></h1>
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
          <h1 className="text-xl font-bold text-indigo-400">📖 Forja de Historias <span className="text-[10px] text-gray-400 ml-1">v{version}</span></h1>
          {isGamePhase && view === 'game' && (
            <span className="px-2 py-0.5 bg-indigo-900/50 text-indigo-300 text-xs rounded-full hidden sm:inline">
              {getPhaseLabel(state.phase)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {hasNotifications && (
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" aria-label="Notificaciones nuevas" />
          )}
          {view !== 'leaderboard' && view !== 'preset' && (
            <button
              onClick={() => setPage('preset')}
              className="px-1.5 sm:px-2.5 py-1 rounded text-xs font-medium bg-gray-700 text-gray-400 hover:text-green-300 transition flex items-center gap-1"
              title="Nueva partida"
              aria-label="Nueva partida"
            >
              🆕 <span className="hidden sm:inline">Nueva</span>
            </button>
          )}
          {view !== 'leaderboard' && (
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
              <button
                onClick={() => setSettingsOpen(true)}
                className="px-1.5 sm:px-2.5 py-1 rounded text-xs font-medium bg-gray-700 text-gray-400 hover:text-gray-200 transition"
                title="Configuración"
                aria-label="Abrir configuración"
              >
                ⚙️
              </button>
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
                <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1" role="menu" aria-label="Menú de opciones">
                  <button
                    onClick={() => { setSettingsOpen(true); setUserMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition flex items-center gap-2"
                    role="menuitem"
                  >
                    ⚙️ Configuración
                  </button>
                  <button
                    onClick={() => { dispatch({ type: 'TOGGLE_LOG' }); setUserMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition flex items-center gap-2"
                    role="menuitem"
                  >
                    📋 {state.showLog ? 'Ocultar log' : 'Mostrar log'}
                  </button>
                  <button
                    onClick={() => dispatch({ type: 'SET_DICE_AUTO_ROLL', autoRoll: !state.diceAutoRoll })}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition flex items-center justify-between gap-2"
                    role="menuitemcheckbox"
                    aria-checked={state.diceAutoRoll}
                  >
                    <span>🎲 Tirada automática</span>
                    <span className={state.diceAutoRoll ? 'text-green-400' : 'text-gray-500'}>{state.diceAutoRoll ? '✓' : '—'}</span>
                  </button>
                  {state.tts.enabled && (
                    <>
                      <button
                        onClick={() => dispatch({ type: 'SET_TTS_CONFIG', config: { ...state.tts, autoPlay: !state.tts.autoPlay } })}
                        className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition flex items-center justify-between gap-2"
                        role="menuitemcheckbox"
                        aria-checked={state.tts.autoPlay}
                      >
                        <span>{state.tts.autoPlay ? '🔊' : '🔇'} Auto-lectura</span>
                        <span className={state.tts.autoPlay ? 'text-green-400' : 'text-gray-500'}>{state.tts.autoPlay ? '✓' : '—'}</span>
                      </button>
                      <button
                        onClick={() => { stopSpeaking(); setUserMenuOpen(false) }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition flex items-center gap-2"
                        role="menuitem"
                      >
                        ⏹ Detener narración
                      </button>
                    </>
                  )}
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

      {view === 'leaderboard' ? (
        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={null}>
            <LeaderboardPage onBack={() => setPage('game')} />
          </Suspense>
        </div>
      ) : view === 'preset' ? (
        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={null}>
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
          </Suspense>
        </div>
      ) : view === 'config' ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <Suspense fallback={null}>
            <SettingsPanel />
          </Suspense>
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
                <Suspense fallback={null}><SaveLoadPanel requestConfirm={requestConfirm} /></Suspense>
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
            <Suspense fallback={null}><SaveLoadPanel requestConfirm={requestConfirm} /></Suspense>
          </aside>
        </div>
      ) : null}

      <Suspense fallback={null}><DiceRollOverlay /></Suspense>
      <NotificationToast />
      <ErrorBanner />

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
        <nav className="lg:hidden bg-gray-800 border-t border-gray-700 flex shrink-0" role="navigation" aria-label="Navegación móvil">
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Configuración"
          onClick={() => setSettingsOpen(false)}
        >
          <div className="relative max-h-[90vh] overflow-y-auto rounded-xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSettingsOpen(false)}
              className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-white rounded-full text-sm transition"
              aria-label="Cerrar configuración"
            >
              ✕
            </button>
            <Suspense fallback={null}><SettingsPanel onClose={() => setSettingsOpen(false)} /></Suspense>
          </div>
        </div>
      )}
    </div>
  )
}

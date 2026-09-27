import { useState } from 'react'
import { useGame } from '../context/useGame'
import { register, login, logout, deleteAccount, getCurrentUser } from '../services/authService'

type AuthMode = 'guest' | 'login' | 'register'

interface Props {
  requestConfirm?: (title: string, message: string, onConfirm: () => void, variant?: 'danger' | 'warning' | 'default', confirmLabel?: string, cancelLabel?: string) => void
}

export default function AuthPanel({ requestConfirm }: Props) {
  const { state, dispatch } = useGame()
  const [mode, setMode] = useState<AuthMode>('guest')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const currentUser = state.currentUser

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const fn = mode === 'login' ? login : register
      const result = await fn(username, password)

      if (result.ok) {
        dispatch({ type: 'SET_USER', username: getCurrentUser() })
        setUsername('')
        setPassword('')
      } else {
        setError(result.error || 'Error')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  function handleLogout() {
    logout()
    dispatch({ type: 'RESET' })
    dispatch({ type: 'SET_USER', username: null })
  }

  async function handleDeleteAccount() {
    if (!requestConfirm || !currentUser) return
    requestConfirm(
      'Eliminar cuenta',
      '¿Eliminar tu cuenta? Se borrarán todos tus datos guardados. Esta acción no se puede deshacer.',
      () => {
        if (!currentUser) return
        deleteAccount(currentUser)
        dispatch({ type: 'RESET' })
        dispatch({ type: 'SET_USER', username: null })
      },
      'danger',
      'Eliminar',
      'Cancelar'
    )
  }

  async function handleGuest(guestUsername: string) {
    const name = guestUsername.trim()
      .toLowerCase()
      .replace(/[^a-z0-9áéíóúñ_]/g, '_')
      .slice(0, 20) || 'aventurero'
    try {
      const res = await fetch('/api/guest-config')
      if (res.ok) {
        const { ai, image, tts } = await res.json()
        dispatch({ type: 'SET_AI_CONFIG', config: ai })
        if (image) dispatch({ type: 'SET_IMAGE_CONFIG', config: image })
        dispatch({ type: 'SET_TTS_CONFIG', config: tts })
      }
    } catch {
      // Fall back to defaults when server is not available
    }
    dispatch({ type: 'SET_USER', username: `invitado_${name}` })
    // phase stays 'config' so App.tsx can redirect to preset picker
  }

  function switchMode() {
    setMode(mode === 'login' ? 'register' : 'login')
    setError('')
  }

  if (currentUser) {
    return (
      <div className="bg-gray-800 rounded-xl p-3 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
              {currentUser[0].toUpperCase()}
            </div>
            <span className="text-sm text-gray-200 font-medium">{currentUser}</span>
          </div>
          <span className="text-xs text-green-400">✓</span>
        </div>
        <div className="flex gap-1.5 mt-2">
          <button onClick={handleLogout} className="flex-1 px-2 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded transition">
            Cerrar sesión
          </button>
          <button onClick={handleDeleteAccount} className="px-2 py-1.5 bg-red-800 hover:bg-red-700 text-white text-xs rounded transition">
            Eliminar cuenta
          </button>
        </div>
      </div>
    )
  }

  const isGuestMode = mode === 'guest'

  return (
    <div className="bg-gray-800 rounded-xl p-4 shadow-lg max-w-sm mx-auto">
      <h2 className="text-lg font-bold text-white mb-4">
        {isGuestMode ? 'Elige tu nombre' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
      </h2>

      {isGuestMode ? (
        <form
          onSubmit={(e) => { e.preventDefault(); handleGuest(username) }}
          className="space-y-3"
        >
          <div>
            <label htmlFor="auth-guest-name" className="block text-xs font-medium text-gray-400 mb-1">Nombre</label>
            <input
              id="auth-guest-name"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Nombre"
              autoComplete="off"
            />
          </div>

          <button
            type="submit"
            className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition text-sm"
          >
            Comenzar aventura
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-gray-800 px-2 text-gray-500">o</span>
            </div>
          </div>

          <p className="text-xs text-gray-500 text-center">
            ¿Ya tienes cuenta?{' '}
            <button type="button" onClick={() => { setMode('login'); setError('') }} className="text-indigo-400 hover:text-indigo-300 underline">
              Inicia sesión
            </button>
          </p>
          <p className="text-xs text-gray-500 text-center">
            ¿No tienes cuenta?{' '}
            <button type="button" onClick={() => { setMode('register'); setError('') }} className="text-indigo-400 hover:text-indigo-300 underline">
              Regístrate
            </button>
          </p>
        </form>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="auth-user" className="block text-xs font-medium text-gray-400 mb-1">Usuario</label>
              <input
                id="auth-user"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="mi_usuario"
                autoComplete="username"
              />
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-xs font-medium text-gray-400 mb-1">Clave</label>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-900/30 p-2 rounded">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition disabled:opacity-40 text-sm"
            >
              {loading ? '...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </form>

          <p className="text-xs text-gray-500 text-center mt-3">
            {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
            <button onClick={switchMode} className="text-indigo-400 hover:text-indigo-300 underline">
              {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
            </button>
          </p>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-gray-800 px-2 text-gray-500">o</span>
            </div>
          </div>

          <p className="text-xs text-gray-500 text-center">
            <button type="button" onClick={() => { setMode('guest'); setUsername(''); setError('') }} className="text-indigo-400 hover:text-indigo-300 underline">
              Acceder como invitado
            </button>
          </p>
        </>
      )}
    </div>
  )
}
import { useEffect, useRef } from 'react'
import { useGame } from '../context/GameContext'
import { userDataKey } from '../services/authService'
import CollapsiblePanel from './CollapsiblePanel'

export default function Notepad() {
  const { state, dispatch } = useGame()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const username = state.currentUser

  useEffect(() => {
    if (!username) return
    try {
      const saved = localStorage.getItem(userDataKey(username, 'notes'))
      if (saved !== null && saved !== state.notes) {
        dispatch({ type: 'SET_NOTES', notes: saved })
      }
    } catch { /* ignore */ }
  }, [username])

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value
    dispatch({ type: 'SET_NOTES', notes: value })
    if (username) {
      localStorage.setItem(userDataKey(username, 'notes'), value)
    }
  }

  return (
    <CollapsiblePanel icon="📝" title="Bloc de notas" color="text-gray-400">
      <textarea
        ref={textareaRef}
        value={state.notes}
        onChange={handleChange}
        placeholder="Escribe tus anotaciones aquí..."
        className="w-full h-28 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
      />
    </CollapsiblePanel>
  )
}
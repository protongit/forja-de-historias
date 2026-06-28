import { useState, useRef, useEffect } from 'react'
import { useGame } from '../context/GameContext'
import { saveGame, loadGame, deleteSave, hasSave, exportGameToJSON, importGameFromJSON, listSaveSlots, type SaveSlot } from '../services/storageService'
import CollapsiblePanel from './CollapsiblePanel'

export default function SaveLoadPanel({ requestConfirm }: { requestConfirm?: (title: string, message: string, onConfirm: () => void, variant?: 'danger' | 'warning' | 'default', confirmLabel?: string, cancelLabel?: string) => void }) {
  const { state, dispatch } = useGame()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const username = state.currentUser
  const [slots, setSlots] = useState<SaveSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    setSlots(listSaveSlots(username))
  }, [username])

  function handleSave() {
    const name = selectedSlot || prompt('Nombre de la partida:') || state.adventureName || 'default'
    if (!name) return
    setSaving(true)
    saveGame(state, username, name)
    dispatch({
      type: 'ADD_MESSAGE',
      message: { id: crypto.randomUUID(), sender: 'system', content: `Partida "${name}" guardada correctamente.`, timestamp: Date.now() },
    })
    setSlots(listSaveSlots(username))
    setSaving(false)
  }

  function handleLoad() {
    const name = selectedSlot || 'default'
    setLoading(true)
    const loaded = loadGame(username, name)
    if (loaded) {
      dispatch({ type: 'LOAD_STATE', state: loaded })
      dispatch({
        type: 'ADD_MESSAGE',
        message: { id: crypto.randomUUID(), sender: 'system', content: `Partida "${name}" cargada.`, timestamp: Date.now() },
      })
    }
    setLoading(false)
  }

  function handleDelete() {
    const name = selectedSlot || 'default'
    if (!requestConfirm) return
    requestConfirm(
      'Eliminar partida',
      `¿Eliminar la partida "${name}"? Esta acción no se puede deshacer.`,
      () => {
        setDeleting(true)
        deleteSave(username, name)
        dispatch({
          type: 'ADD_MESSAGE',
          message: { id: crypto.randomUUID(), sender: 'system', content: `Partida "${name}" eliminada.`, timestamp: Date.now() },
        })
        setSlots(listSaveSlots(username))
        setDeleting(false)
      },
      'danger',
      'Eliminar',
      'Cancelar'
    )
  }

  function handleExport() {
    exportGameToJSON(state, selectedSlot || undefined)
  }

  function handleImportClick() {
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const loadedState = await importGameFromJSON(file)
      dispatch({ type: 'LOAD_STATE', state: loadedState })
      dispatch({
        type: 'ADD_MESSAGE',
        message: { id: crypto.randomUUID(), sender: 'system', content: 'Partida importada correctamente.', timestamp: Date.now() },
      })
    } catch (err) {
      dispatch({
        type: 'ADD_MESSAGE',
        message: { id: crypto.randomUUID(), sender: 'system', content: `Error al importar: ${err instanceof Error ? err.message : 'Archivo inválido'}`, timestamp: Date.now() },
      })
    }
    setImporting(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleNewGame() {
    if (state.messages.length > 0) {
      if (!requestConfirm) return
      requestConfirm(
        'Nueva partida',
        '¿Estás seguro? Perderás la partida actual.',
        () => dispatch({ type: 'RESET' }),
        'warning',
        'Nueva partida',
        'Cancelar'
      )
      return
    }
    dispatch({ type: 'RESET' })
  }

  return (
    <CollapsiblePanel icon="💾" title="Partidas" color="text-gray-400" aria-label="Panel de guardar y cargar partidas">
      {slots.length > 0 && (
        <div className="mb-2 space-y-1" role="list" aria-label="Partidas guardadas">
          {slots.map((slot) => (
            <button
              key={slot.name}
              onClick={() => setSelectedSlot(slot.name)}
              className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 ${
                selectedSlot === slot.name ? 'bg-indigo-700/50 text-indigo-200 border border-indigo-600' : 'bg-gray-700/40 text-gray-300 hover:bg-gray-700'
              }`}
              role="listitem"
              aria-label={`Partida: ${slot.name}`}
              aria-pressed={selectedSlot === slot.name}
            >
              <span className="truncate">{slot.name}</span>
              <span className="shrink-0 text-gray-400">{slot.adventureName === 'Sin nombre' ? `Nv ${slot.level}` : slot.adventureName}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="Acciones de guardar y cargar">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-2.5 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs rounded transition disabled:opacity-50 flex items-center gap-1"
          aria-label="Guardar partida"
        >
          {saving ? <Spinner /> : null}
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        <button
          onClick={handleLoad}
          disabled={loading || !hasSave(username)}
          className="px-2.5 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs rounded transition disabled:opacity-40 flex items-center gap-1"
          aria-label="Cargar partida"
        >
          {loading ? <Spinner /> : null}
          {loading ? 'Cargando...' : 'Cargar'}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting || !hasSave(username)}
          className="px-2.5 py-1.5 bg-red-700 hover:bg-red-600 text-white text-xs rounded transition disabled:opacity-40 flex items-center gap-1"
          aria-label="Eliminar partida"
        >
          {deleting ? <Spinner /> : null}
          {deleting ? 'Borrando...' : 'Borrar'}
        </button>
        <button onClick={handleExport} className="px-2.5 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded transition" aria-label="Exportar partida como archivo">
          Exportar
        </button>
        <button
          onClick={handleImportClick}
          disabled={importing}
          className="px-2.5 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded transition disabled:opacity-50 flex items-center gap-1"
          aria-label="Importar partida desde archivo"
        >
          {importing ? <Spinner /> : null}
          {importing ? 'Importando...' : 'Importar'}
        </button>
        <button onClick={handleNewGame} className="px-2.5 py-1.5 bg-yellow-700 hover:bg-yellow-600 text-white text-xs rounded transition" aria-label="Iniciar nueva partida">
          Nueva
        </button>
      </div>
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} className="hidden" aria-hidden="true" />
    </CollapsiblePanel>
  )
}

function Spinner() {
  return (
    <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
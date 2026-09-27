import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react'
import { useGame } from '../context/useGame'
import { useChatOrchestrator } from '../hooks/useChatOrchestrator'
import { useVoiceInput } from '../hooks/useVoiceInput'

export interface ChatInputRef {
  sendMessage: (text?: string) => void
  undoLastMessage: () => void
}

interface ChatInputProps {
  quickSetupAnswers?: Record<string, string> | null
  onQuickSetupConsumed?: () => void
}

interface PendingAttachment {
  type: 'image' | 'document'
  data: string
  mimeType: string
  name: string
}

export default forwardRef<ChatInputRef, ChatInputProps>(function ChatInput({ quickSetupAnswers, onQuickSetupConsumed }: ChatInputProps, ref) {
  const { state, dispatch } = useGame()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { sendMessage: sendToAI, undoLastMessage, cancelGeneration } = useChatOrchestrator({ quickSetupAnswers, onQuickSetupConsumed })
  const [attachments, setAttachments] = useState<{ file: File; dataUrl: string }[]>([])

  function sendMessage(text?: string) {
    const input = inputRef.current
    const content = text ?? input?.value.trim() ?? ''
    const pending: PendingAttachment[] = attachments.map((a) => ({
      type: a.file.type.startsWith('image/') ? 'image' : 'document',
      data: a.dataUrl,
      mimeType: a.file.type,
      name: a.file.name,
    }))
    if (!content && pending.length === 0) return
    if (input) {
      input.value = ''
      input.style.height = 'auto'
    }
    setAttachments([])
    void sendToAI(content, pending.length > 0 ? pending : undefined)
  }

  function fail(msg: string) {
    dispatch({ type: 'SET_ERROR', error: msg })
  }

  const { recording, interimText, start: startRecording, stop: stopRecording } = useVoiceInput(sendMessage, fail)

  useImperativeHandle(ref, () => ({
    sendMessage: (text?: string) => sendMessage(text),
    undoLastMessage: () => undoLastMessage(),
  }))

  useEffect(() => {
    if (window.innerWidth < 1024) return
    if (!state.isWaitingAI && inputRef.current) {
      inputRef.current.focus()
    }
  }, [state.messages.length, state.isWaitingAI])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function handleFileAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    const newAtts: { file: File; dataUrl: string }[] = []
    for (const f of Array.from(files)) {
      const reader = new FileReader()
      reader.onload = () => {
        // Store raw base64 (strip the data URL prefix) — aiService rebuilds the prefix
        const raw = reader.result as string
        const base64 = raw.includes('base64,') ? raw.split('base64,')[1] || '' : ''
        newAtts.push({ file: f, dataUrl: base64 })
        if (newAtts.length === files.length) setAttachments((prev) => [...prev, ...newAtts])
      }
      reader.readAsDataURL(f)
    }
    // Reset input so the same file can be re-attached
    e.target.value = ''
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-2">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1 mb-1">
          {attachments.map((att, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-gray-700 border border-gray-500 text-gray-200 text-xs px-2.5 py-1 rounded-full">
              <span className="text-indigo-400">📎</span>
              <span className="truncate max-w-[140px]">{att.file.name}</span>
              <button onClick={() => removeAttachment(i)} className="ml-0.5 text-gray-500 hover:text-red-400 transition" aria-label={`Quitar archivo ${att.file.name}`}>✕</button>
            </div>
          ))}
        </div>
      )}
      {recording && (
        <div className="flex items-center gap-2 text-red-400 text-sm animate-pulse px-1">
          <span className="w-2 h-2 bg-red-500 rounded-full" />
          <span>Grabando...</span>
          {interimText && <span className="text-yellow-300 text-xs truncate max-w-[200px] italic">&quot;{interimText}&quot;</span>}
          <button onClick={() => void stopRecording()} className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition">Detener</button>
        </div>
      )}
      <div className="flex gap-2">
        <textarea
          ref={inputRef}
          onKeyDown={handleKeyDown}
          onInput={(e) => {
            const el = e.currentTarget
            el.style.height = 'auto'
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`
          }}
          placeholder="Escribe tu acción..."
          className="flex-1 px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
          rows={1}
          disabled={state.isWaitingAI}
          aria-label="Escribe tu acción"
        />
        <div className="flex flex-col gap-1.5">
          {state.isWaitingAI ? (
            <button
              onClick={cancelGeneration}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition"
              title="Detener generación"
              aria-label="Detener generación"
            >
              ⏹ Detener
            </button>
          ) : (
            <button
              onClick={() => sendMessage()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition"
            >
              Enviar
            </button>
          )}
          <div className="flex gap-1.5">
            <button
              onClick={() => undoLastMessage()}
              disabled={state.isWaitingAI || state.messages.filter((m) => m.sender === 'player').length === 0}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-700 border border-gray-500 text-gray-300 hover:bg-gray-600 hover:text-white transition disabled:opacity-30"
              title="Deshacer último mensaje"
              aria-label="Deshacer último mensaje"
            >
              ↩
            </button>
            <button
              onClick={recording ? () => void stopRecording() : startRecording}
              disabled={state.isWaitingAI}
              className={`w-9 h-9 flex items-center justify-center rounded-lg transition ${
                recording
                  ? 'bg-red-600 text-white ring-2 ring-red-400'
                  : 'bg-gray-700 border border-gray-500 text-gray-300 hover:bg-gray-600 hover:text-white hover:border-gray-400'
              }`}
              title={recording ? 'Detener grabación' : 'Grabar audio'}
              aria-label={recording ? 'Detener grabación' : 'Grabar audio'}
            >
              {recording ? '⏹' : '🎤'}
            </button>
            <label className="w-9 h-9 flex items-center justify-center rounded-lg transition cursor-pointer bg-gray-700 border border-gray-500 text-gray-300 hover:bg-gray-600 hover:text-white hover:border-gray-400" title="Adjuntar archivo">
              📎
              <input type="file" multiple accept="image/*,.pdf,.txt,.md" onChange={handleFileAttach} className="hidden" aria-label="Adjuntar archivo" />
            </label>
          </div>
        </div>
      </div>
    </div>
  )
})

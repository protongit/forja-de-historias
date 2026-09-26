import { useGame } from '../context/useGame'
import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react'
import Message from './Message'
import GenerationSkeleton from './GenerationSkeleton'
import { speakMessageText } from '../services/ttsService'
import { upsertGameStats } from '../services/statsService'
import { useChatOrchestrator } from '../hooks/useChatOrchestrator'

interface SpeechRecognitionResultLike {
  isFinal: boolean
  length: number
  [index: number]: { transcript: string }
}

interface SpeechRecognitionEventLike {
  resultIndex: number
  results: { length: number; [index: number]: SpeechRecognitionResultLike }
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  start(): void
  stop(): void
}

type SpeechRecognitionLikeCtor = new () => SpeechRecognitionLike

const PHASE_TOASTS: Record<string, string> = {
  setup: 'Responde a las preguntas del Director de Juego para crear tu aventura.',
  playing: 'Escribe qué quieres hacer, con quién hablar o adónde ir...',
  generation: 'Generando tu aventura...',
  completed: 'La aventura ha terminado. ¡Gracias por jugar!',
}

const LOADING_MESSAGE = { id: 'loading', sender: 'gm' as const, content: '', timestamp: 0 }

function PhaseToast({ message }: { message: string }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const id = setTimeout(() => setVisible(false), 5000)
    return () => clearTimeout(id)
  }, [])
  if (!visible) return null
  return (
    <div className="bg-indigo-900/60 border border-indigo-700 text-indigo-200 text-sm px-4 py-2 rounded-lg text-center animate-pulse">
      {message}
    </div>
  )
}

export interface ChatInputRef {
  sendMessage: (text?: string) => void
  undoLastMessage: () => void
}

interface ChatInputProps {
  quickSetupAnswers?: Record<string, string> | null
  onQuickSetupConsumed?: () => void
}

export default function ChatInterface({ quickSetupAnswers, onQuickSetupConsumed }: { quickSetupAnswers?: Record<string, string> | null; onQuickSetupConsumed?: () => void } = {}) {
  const { state, dispatch } = useGame()
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<ChatInputRef>(null)
  const lastAutoPlayed = useRef(0)
  const startTime = useRef<number>(0)
  const userScrolledUp = useRef(false)
  useEffect(() => { startTime.current = Date.now() }, [])

  useEffect(() => {
    function onPlayerAction(e: Event) {
      const action = (e as CustomEvent<string>).detail
      if (action) chatInputRef.current?.sendMessage(action)
    }
    window.addEventListener('fj:player-action', onPlayerAction)
    return () => window.removeEventListener('fj:player-action', onPlayerAction)
  }, [])

  const isNearBottom = () => {
    const el = scrollContainerRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 200
  }

  useEffect(() => {
    if (state.messages.length === 0) return
    if (userScrolledUp.current && !isNearBottom()) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.messages.length, state.isWaitingAI, state.phase])

  function handleScroll() {
    userScrolledUp.current = !isNearBottom()
  }

  useEffect(() => {
    if (state.phase !== 'playing') return
    const interval = setInterval(() => {
      dispatch({ type: 'UPDATE_STATS_BATCH', stats: { timePlayedMs: Date.now() - startTime.current } })
    }, 10000)
    return () => clearInterval(interval)
  }, [state.phase, dispatch])

  // Reset startTime when game is reset
  useEffect(() => {
    if (state.phase === 'config') {
      startTime.current = Date.now()
    }
  }, [state.phase])

  // Stats session: create on first playing, sync on changes
  const sentSession = useRef(false)
  const prevStats = useRef(state.gameStats)

  useEffect(() => {
    if (state.phase !== 'playing' && state.phase !== 'completed') return
    if (state.phase === 'playing' && !sentSession.current) {
      sentSession.current = true
      if (!state.statsSessionId) {
        dispatch({ type: 'SET_STATS_SESSION_ID', id: crypto.randomUUID() })
      }
    }
  }, [state.phase, state.statsSessionId, dispatch])

  useEffect(() => {
    if (state.phase !== 'playing' && state.phase !== 'completed') return
    if (!state.statsSessionId) return

    const prev = prevStats.current
    const curr = state.gameStats
    const changed =
      prev.messagesSent !== curr.messagesSent ||
      prev.diceRolls !== curr.diceRolls ||
      prev.diceSuccesses !== curr.diceSuccesses ||
      prev.diceFailures !== curr.diceFailures ||
      prev.enemiesDefeated !== curr.enemiesDefeated ||
      prev.timePlayedMs !== curr.timePlayedMs ||
      prev.xpEarned !== curr.xpEarned ||
      prev.levelsGained !== curr.levelsGained ||
      prev.imagesGenerated !== curr.imagesGenerated ||
      sentSession.current === true

    if (!changed) return

    prevStats.current = curr

    const result = state.phase === 'completed'
      ? (state.gameStats.adventureResult || 'failure') as 'success' | 'failure'
      : 'active' as const

    const payload = {
      username: state.currentUser || 'anon',
      adventureName: state.adventureName || state.quest?.title || 'Aventura',
      sessionId: state.statsSessionId!,
      level: state.level,
      xpTotal: state.gameStats.xpEarned,
      enemiesDefeated: curr.enemiesDefeated,
      timePlayedMs: curr.timePlayedMs,
      messagesSent: curr.messagesSent,
      diceRolls: curr.diceRolls,
      diceSuccesses: curr.diceSuccesses,
      diceFailures: curr.diceFailures,
      imagesGenerated: curr.imagesGenerated,
      completed: state.phase === 'completed',
      result,
    }
    upsertGameStats(payload).catch(() => {})
  }, [state.gameStats, state.phase, state.statsSessionId, state.level, state.currentUser, state.adventureName, state.quest?.title])

  useEffect(() => {
    if (!state.tts.enabled || !state.tts.autoPlay) return
    if (state.isWaitingAI) return
    const lastMsg = state.messages[state.messages.length - 1]
    if (!lastMsg || lastMsg.sender !== 'gm' || lastMsg.timestamp <= lastAutoPlayed.current) return
    lastAutoPlayed.current = lastMsg.timestamp
    speakMessageText(lastMsg.content, state.tts)
  }, [state.messages, state.isWaitingAI, state.tts])

  const phaseToast = PHASE_TOASTS[state.phase]

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-1" ref={scrollContainerRef} onScroll={handleScroll}>
        {phaseToast && <PhaseToast key={state.phase} message={phaseToast} />}
        {state.messages.map((msg) => (
          <div key={msg.id}>
            <Message
              message={msg}
              onSelectOption={
                state.phase !== 'completed' && msg.sender === 'gm'
                  ? (opt) => chatInputRef.current?.sendMessage(opt)
                  : undefined
              }
              onSpeak={
                msg.sender === 'gm' && state.tts.enabled
                  ? (text) => speakMessageText(text, state.tts)
                  : undefined
              }
            />
          </div>
        ))}
        {state.isWaitingAI && state.phase === 'generation' && (
          <GenerationSkeleton />
        )}
        {state.isWaitingAI && state.phase !== 'generation' && (
          <Message message={LOADING_MESSAGE} isLoading />
        )}
        <div ref={bottomRef} />
      </div>

      {state.phase !== 'completed' && state.phase !== 'generation' && (
        <div className="p-3 border-t border-gray-700">
          <ChatInput ref={chatInputRef} quickSetupAnswers={quickSetupAnswers} onQuickSetupConsumed={onQuickSetupConsumed} />
        </div>
      )}
    </div>
  )
}

interface PendingAttachment {
  type: 'image' | 'document'
  data: string
  mimeType: string
  name: string
}

const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(function ChatInput({ quickSetupAnswers, onQuickSetupConsumed }: ChatInputProps, ref) {
  const { state, dispatch } = useGame()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { sendMessage: sendToAI, undoLastMessage } = useChatOrchestrator({ quickSetupAnswers, onQuickSetupConsumed })
  const [recording, setRecording] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [attachments, setAttachments] = useState<{ file: File; dataUrl: string }[]>([])
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const transcriptRef = useRef('')

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
    if (input) input.value = ''
    setAttachments([])
    void sendToAI(content, pending.length > 0 ? pending : undefined)
  }

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

  // Cleanup SpeechRecognition on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      recognitionRef.current = null
    }
  }, [])

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

  async function startRecording() {
    try {
      const w = window as unknown as { SpeechRecognition?: SpeechRecognitionLikeCtor; webkitSpeechRecognition?: SpeechRecognitionLikeCtor }
      const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
      if (!Ctor) {
        dispatch({ type: 'SET_ERROR', error: 'Tu navegador no soporta transcripción de voz' })
        return
      }

      setRecording(true)
      setInterimText('')
      transcriptRef.current = ''

      const recognition = new Ctor()
      recognition.lang = 'es-ES'
      recognition.continuous = true
      recognition.interimResults = true
      recognition.onresult = (e: SpeechRecognitionEventLike) => {
        let interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i]
          if (result.isFinal) {
            transcriptRef.current += result[0].transcript
          } else {
            interim += result[0].transcript
          }
        }
        setInterimText(interim)
      }
      recognition.onerror = () => {}
      recognition.start()
      recognitionRef.current = recognition
    } catch {
      dispatch({ type: 'SET_ERROR', error: 'Error al iniciar grabación de audio' })
    }
  }

  async function stopRecording() {
    if (!recognitionRef.current) return
    setRecording(false)
    recognitionRef.current.stop()
    recognitionRef.current = null
    await new Promise((r) => setTimeout(r, 150))
    const transcript = (transcriptRef.current + ' ' + interimText).trim()
    if (transcript) {
      sendMessage(transcript)
    } else {
      dispatch({ type: 'SET_ERROR', error: 'No se pudo transcribir el audio' })
    }
    setInterimText('')
    transcriptRef.current = ''
  }

  return (
    <div className="flex flex-col gap-2">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1 mb-1">
          {attachments.map((att, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-gray-700 border border-gray-500 text-gray-200 text-xs px-2.5 py-1 rounded-full">
              <span className="text-indigo-400">📎</span>
              <span className="truncate max-w-[140px]">{att.file.name}</span>
              <button onClick={() => removeAttachment(i)} className="ml-0.5 text-gray-500 hover:text-red-400 transition">✕</button>
            </div>
          ))}
        </div>
      )}
      {recording && (
        <div className="flex items-center gap-2 text-red-400 text-sm animate-pulse px-1">
          <span className="w-2 h-2 bg-red-500 rounded-full" />
          <span>Grabando...</span>
          {interimText && <span className="text-yellow-300 text-xs truncate max-w-[200px] italic">&quot;{interimText}&quot;</span>}
          <button onClick={stopRecording} className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition">Detener</button>
        </div>
      )}
      <div className="flex gap-2">
        <textarea
          ref={inputRef}
          onKeyDown={handleKeyDown}
          placeholder="Escribe tu acción..."
          className="flex-1 px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
          rows={1}
          disabled={state.isWaitingAI}
        />
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => sendMessage()}
            disabled={state.isWaitingAI}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
          >
            Enviar
          </button>
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
              onClick={recording ? stopRecording : startRecording}
              disabled={state.isWaitingAI}
              className={`w-9 h-9 flex items-center justify-center rounded-lg transition ${
                recording
                  ? 'bg-red-600 text-white ring-2 ring-red-400'
                  : 'bg-gray-700 border border-gray-500 text-gray-300 hover:bg-gray-600 hover:text-white hover:border-gray-400'
              }`}
              title={recording ? 'Detener grabación' : 'Grabar audio'}
            >
              {recording ? '⏹' : '🎤'}
            </button>
            <label className={`w-9 h-9 flex items-center justify-center rounded-lg transition cursor-pointer bg-gray-700 border border-gray-500 text-gray-300 hover:bg-gray-600 hover:text-white hover:border-gray-400`}>
              📎
              <input type="file" multiple accept="image/*,.pdf,.txt,.md" onChange={handleFileAttach} className="hidden" />
            </label>
          </div>
        </div>
      </div>
    </div>
  )
})

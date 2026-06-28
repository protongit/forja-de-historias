import { useGame } from '../context/GameContext'
import { useRef, useEffect, useState, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react'
import Message from './Message'
import GenerationSkeleton from './GenerationSkeleton'
import { sendChatStream } from '../services/aiService'
import { clearLastResponseId } from '../services/aiService'
import { getSetupPrompt, getGamemasterPrompt, SYSTEM_PROMPTS } from '../utils/prompts'
import { processRawResponse, parseStats, parseSkills, cleanContentMarkers } from '../utils/commandCleaner'
import { shouldSummarize, getMessagesToSummarize, summarizeMessages, buildSummaryMessages } from '../utils/contextSummarizer'
import type { ProcessedResponse } from '../utils/commandCleaner'
import { speakMessageText } from '../services/ttsService'
import { generateImage } from '../services/imageService'
import { upsertGameStats } from '../services/statsService'
import type { Message as GameMessage, RawLogEntry, GameState, TTSVoiceEmotion } from '../types/game'
import NotificationToast from './NotificationToast'

export interface ChatInputRef {
  sendMessage: (text?: string) => void
  undoLastMessage: () => void
}

interface ChatInputProps {
  onUndo: () => void
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

  const isNearBottom = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 200
  }, [])

  useEffect(() => {
    if (state.messages.length === 0) return
    if (userScrolledUp.current && !isNearBottom()) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.messages.length, state.isWaitingAI, state.phase, isNearBottom])

  function handleScroll() {
    userScrolledUp.current = !isNearBottom()
  }

  useEffect(() => {
    if (state.messages.length === 0) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.messages.length, state.isWaitingAI, state.phase])

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

  // Handle quick setup: when answers are provided, start generation
  // This is handled inside ChatInput via quickSetupAnswers prop

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
  }, [state.gameStats, state.phase, state.statsSessionId, state.level])

  useEffect(() => {
    if (!state.tts.enabled || !state.tts.autoPlay) return
    if (state.isWaitingAI) return
    const lastMsg = state.messages[state.messages.length - 1]
    if (!lastMsg || lastMsg.sender !== 'gm' || lastMsg.timestamp <= lastAutoPlayed.current) return
    lastAutoPlayed.current = lastMsg.timestamp
    speakMessageText(lastMsg.content, state.tts)
  }, [state.messages, state.isWaitingAI, state.tts])

  const phaseMessages: Record<string, string> = useMemo(() => ({
    setup: 'Responde a las preguntas del Director de Juego para crear tu aventura.',
    playing: 'Escribe qué quieres hacer, con quién hablar o adónde ir...',
    generation: 'Generando tu aventura...',
    completed: 'La aventura ha terminado. ¡Gracias por jugar!',
  }), [])

  const [toast, setToast] = useState('')

  useEffect(() => {
    const msg = phaseMessages[state.phase]
    if (!msg) return
    setToast(msg)
    const id = setTimeout(() => setToast(''), 5000)
    return () => clearTimeout(id)
  }, [state.phase, phaseMessages])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-1" ref={scrollContainerRef} onScroll={handleScroll}>
        {toast && (
          <div className="bg-indigo-900/60 border border-indigo-700 text-indigo-200 text-sm px-4 py-2 rounded-lg text-center animate-pulse">
            {toast}
          </div>
        )}
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
          <Message
            message={{
              id: 'loading',
              sender: 'gm',
              content: '',
              timestamp: Date.now(),
            }}
            isLoading
          />
        )}
        <div ref={bottomRef} />
      </div>

      {state.phase !== 'completed' && state.phase !== 'generation' && (
        <div className="p-3 border-t border-gray-700">
          <ChatInput ref={chatInputRef} onUndo={() => chatInputRef.current?.undoLastMessage()} quickSetupAnswers={quickSetupAnswers} onQuickSetupConsumed={onQuickSetupConsumed} />
        </div>
      )}
      <NotificationToast />
    </div>
  )
}

function buildSystemPrompt(phase: string, ttsEnabled: boolean, combatMode: string): string {
  if (phase === 'setup') return getSetupPrompt(ttsEnabled)
  if (phase === 'generation') return SYSTEM_PROMPTS.generation
  return getGamemasterPrompt(combatMode === 'tactical')
}

function buildCharContext(state: GameState): string {
  const { character, quest, inventory, journal, enemies, companions, level, xp, combatActive, combatTurn, worldState, tts } = state
  const parts: string[] = []

  parts.push('## ESTADO ACTUAL DEL JUEGO')
  parts.push('')

  // --- NARRATIVE TONE ---
  const TONE_LABELS: Record<string, string> = {
    neutral: 'Neutral',
    grave: 'Grave y misteriosa',
    alegre: 'Alegre',
    epico: 'Épica',
    misterioso: 'Misteriosa',
    susurro: 'Susurrante',
    terrorifico: 'Terrorífica',
  }
  const TONE_INSTRUCTIONS: Record<string, string> = {
    neutral: 'Narra con un tono neutral y equilibrado.',
    grave: 'Narra con un tono grave y misterioso. Usa un lenguaje oscuro, pausado y lleno de presagios.',
    alegre: 'Narra con un tono alegre y humorístico. Incluye situaciones cómicas, diálogos divertidos y un lenguaje ligero y desenfadado.',
    epico: 'Narra con un tono épico y grandioso. Usa un lenguaje heroico, solemne y majestuoso. Las descripciones deben inspirar grandeza y emoción.',
    misterioso: 'Narra con un tono misterioso e intrigante. Mantén un aire de incertidumbre y revela información con cuentagotas.',
    susurro: 'Narra con un tono susurrante e íntimo. Usa descripciones detalladas y un ritmo pausado y envolvente.',
    terrorifico: 'Narra con un tono terrorífico. Crea atmósferas de miedo, tensión y horror. Usa un lenguaje que genere angustia y desasosiego.',
  }
  const emotion = tts.emotion || 'neutral'
  const label = TONE_LABELS[emotion] || 'Neutral'
  const instruction = TONE_INSTRUCTIONS[emotion] || TONE_INSTRUCTIONS.neutral
  parts.push('### TONO NARRATIVO')
  parts.push(`- Tono seleccionado: ${label}`)
  parts.push(`- Instrucción: ${instruction}`)
  parts.push('')

  // --- CHARACTER SHEET ---
  if (character) {
    parts.push('### FICHA DEL PERSONAJE')
    parts.push(`- Nombre: ${character.name || 'Desconocido'}`)
    parts.push(`- Nivel: ${level} | XP: ${xp}`)
    if (character.maxHp > 0) parts.push(`- HP: ${character.hp}/${character.maxHp}`)
    if (character.background) parts.push(`- Trasfondo: ${character.background}`)
    if (character.traits?.length) parts.push(`- Rasgos: ${character.traits.join(', ')}`)
    if (character.equipment?.length) parts.push(`- Equipo inicial: ${character.equipment.join(', ')}`)

    if (character.stats?.length) {
      parts.push('')
      parts.push('#### Estadísticas')
      parts.push(character.stats.map((s) => `${s.name}: ${s.value}`).join(', '))
    }

    if (character.skills?.length) {
      parts.push('')
      parts.push('#### Habilidades')
      parts.push(character.skills.map((s) => `${s.name}: ${s.description}`).join(', '))
    }
    parts.push('')
  }

  // --- QUEST ---
  if (quest) {
    parts.push('### MISIÓN Y OBJETIVOS')
    parts.push(`- Título: ${quest.title}`)
    parts.push(`- Descripción: ${quest.description}`)
    if (quest.objectives?.length) {
      parts.push('')
      parts.push('#### Objetivos')
      quest.objectives.forEach((obj, i) => parts.push(`${i + 1}. ${obj.completed ? '✅' : '⬜'} ${obj.name}`))
    }
    parts.push('')
  }

  // --- INVENTORY ---
  if (inventory?.length) {
    parts.push('### INVENTARIO')
    parts.push(inventory.join(', '))
    parts.push('')
  }

  // --- JOURNAL ---
  if (journal?.length) {
    parts.push('### DIARIO DE AVENTURA')
    for (const entry of journal) {
      const date = new Date(entry.timestamp).toLocaleDateString('es-ES')
      parts.push(`- [${date}] ${entry.title}: ${entry.summary} (${entry.eventType})`)
    }
    parts.push('')
  }

  // --- WORLD STATE ---
  parts.push('### MUNDO')
  parts.push(`- Ubicación actual: ${worldState.currentLocation || 'Desconocida'}`)
  parts.push(`- Hora: ${worldState.timeOfDay}${worldState.weather ? ` | Clima: ${worldState.weather}` : ''}`)
  if (worldState.locations.length) {
    parts.push('')
    parts.push('#### Ubicaciones descubiertas')
    for (const loc of worldState.locations) {
      const exits = loc.exits.length ? ` → ${loc.exits.join(', ')}` : ''
      parts.push(`- ${loc.name}: ${loc.description}${exits}`)
    }
  }
  if (worldState.npcs.length) {
    parts.push('')
    parts.push('#### NPCs conocidos')
    for (const npc of worldState.npcs) {
      if (!npc.isAlive) continue
      const rel = npc.relationship >= 0 ? `+${npc.relationship}` : `${npc.relationship}`
      parts.push(`- ${npc.name} (${npc.location}): ${npc.description} — Relación: ${rel}`)
    }
  }
  parts.push('')

  // --- COMBAT ---
  if (combatActive && enemies?.length) {
    parts.push('### COMBATE ACTIVO')
    parts.push(`- Turno: ${combatTurn}`)
    for (const enemy of enemies) {
      if (enemy.isAlive) {
        parts.push(`- ${enemy.name} (HP ${enemy.hp}/${enemy.maxHp}, AC ${enemy.ac})`)
        if (enemy.description) parts.push(`  - ${enemy.description}`)
      }
    }
    parts.push('')
  }

  // --- COMPANIONS ---
  if (companions?.length) {
    parts.push('### COMPAÑEROS')
    for (const comp of companions) {
      if (comp.isActive) {
        const statsStr = comp.stats?.length ? comp.stats.map((s) => `${s.name}: ${s.value}`).join(', ') : ''
        parts.push(`- ${comp.name}: ${comp.description}${statsStr ? ` — ${statsStr}` : ''}`)
      }
    }
    parts.push('')
  }

  const output = parts.join('\n')
  return output ? `\n\n${output}` : ''
}

function addLogEntry(playerMsg: string, raw: string, cleaned: string, phase: string, dispatch: React.Dispatch<any>) {
  const entry: RawLogEntry = {
    timestamp: Date.now(),
    playerMessage: playerMsg,
    rawResponse: raw,
    cleanedResponse: cleaned,
    phase,
  }
  dispatch({ type: 'ADD_LOG_ENTRY', entry })
}

const TONE_LABEL_TO_EMOTION: Record<string, string> = {
  'Neutral': 'neutral',
  'Grave y misteriosa': 'grave',
  'Alegre': 'alegre',
  'Épica': 'epico',
  'Misteriosa': 'misterioso',
  'Susurrante': 'susurro',
  'Terrorífica': 'terrorifico',
}

function resolveToneEmotion(setupAnswers: Record<string, string> | undefined): string | null {
  if (!setupAnswers) return null
  const label = setupAnswers['tono_narrador']
  if (!label) return null
  return TONE_LABEL_TO_EMOTION[label] || null
}

function dispatchPhaseTransition(aiResponse: string, result: ProcessedResponse, dispatch: React.Dispatch<any>): { transition: string; messageId: string | null } {
  const hasCommand = (cmd: string) => new RegExp(`\\[{1,2}${cmd}\\]{1,2}`).test(aiResponse)
  if (hasCommand('SETUP_COMPLETE')) {
    const finalText = result.cleaned
    const id = crypto.randomUUID()
    dispatch({
      type: 'ADD_MESSAGE',
      message: { id, sender: 'gm', content: cleanContentMarkers(finalText), timestamp: Date.now() },
    })
    dispatch({ type: 'SET_PHASE', phase: 'generation' })
    return { transition: 'setup-complete', messageId: id }
  }
  if (hasCommand('GENERATION_COMPLETE')) {
    const finalText = result.cleaned
    dispatch({
      type: 'ADD_MESSAGE',
      message: { id: crypto.randomUUID(), sender: 'system', content: '🌟 Tu personaje y misión han sido creados. ¡La aventura comienza!', timestamp: Date.now() },
    })
    const id = crypto.randomUUID()
    dispatch({
      type: 'ADD_MESSAGE',
      message: { id, sender: 'gm', content: cleanContentMarkers(finalText), timestamp: Date.now() },
    })
    return { transition: 'generation-complete', messageId: id }
  }
  if (hasCommand('QUEST_COMPLETE')) {
    const finalText = result.cleaned
    const id = crypto.randomUUID()
    dispatch({
      type: 'ADD_MESSAGE',
      message: { id, sender: 'gm', content: cleanContentMarkers(finalText), timestamp: Date.now() },
    })
    dispatch({
      type: 'ADD_MESSAGE',
      message: { id: crypto.randomUUID(), sender: 'system', content: '🏆 ¡Aventura completada! Gracias por jugar.', timestamp: Date.now() },
    })
    dispatch({ type: 'SET_PHASE', phase: 'completed' })
    const isSuccess = finalText.includes('éxito') || finalText.includes('victoria') || !finalText.includes('fracaso')
    dispatch({ type: 'SET_ADVENTURE_RESULT', result: isSuccess ? 'success' : 'failure' })
    return { transition: 'quest-complete', messageId: id }
  }
  const id = crypto.randomUUID()
  dispatch({
    type: 'ADD_MESSAGE',
    message: { id, sender: 'gm', content: cleanContentMarkers(result.cleaned), timestamp: Date.now() },
  })
  return { transition: 'normal', messageId: id }
}

async function handlePendingImages(result: ProcessedResponse, imageConfig: GameState['imageConfig'], hostMessageId: string, _cleaned: string, dispatch: React.Dispatch<any>) {
  if (!result.pendingImages?.length) return

  for (const { prompt } of result.pendingImages) {
    try {
      const url = await generateImage(imageConfig, prompt)
      if (url) {
        dispatch({
          type: 'APPEND_MESSAGE_CONTENT',
          id: hostMessageId,
          content: `![${prompt}](${url})`,
        })
        dispatch({ type: 'INCREMENT_STAT', stat: 'imagesGenerated' })
      }
    } catch (err) {
      dispatch({
        type: 'ADD_MESSAGE',
        message: {
          id: crypto.randomUUID(),
          sender: 'system',
          content: `Error al generar imagen: ${err instanceof Error ? err.message : 'error desconocido'}`,
          timestamp: Date.now(),
        },
      })
    }
  }
}

const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(function ChatInput({ onUndo, quickSetupAnswers, onQuickSetupConsumed }: ChatInputProps, ref) {
  const { state, dispatch } = useGame()
  const inputRef = useRef<HTMLTextAreaElement>(null)

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

  async function sendMessage(text?: string, attachmentsIn?: { type: string; data: string; mimeType: string; name: string }[]) {
    const input = inputRef.current
    const content = text ?? input?.value.trim() ?? ''

    // Gather attachments from local state if none provided explicitly
    let allAttachments = attachmentsIn
    if (!allAttachments && attachments.length > 0) {
      allAttachments = attachments.map((a) => ({
        type: a.file.type.startsWith('image/') ? 'image' : 'document',
        data: a.dataUrl,
        mimeType: a.file.type,
        name: a.file.name,
      }))
    }
    if (!content && !allAttachments?.length) return

    if (input) input.value = ''

    const message: GameMessage = {
      id: crypto.randomUUID(),
      sender: 'player',
      content,
      timestamp: Date.now(),
    }
    if (allAttachments?.length) {
      message.attachments = allAttachments.map((a) => ({
        type: a.type as 'image' | 'document' | 'audio',
        data: a.data,
        mimeType: a.mimeType,
        name: a.name,
      }))
    }
    dispatch({ type: 'ADD_MESSAGE', message })
    setAttachments([])

    dispatch({ type: 'INCREMENT_STAT', stat: 'messagesSent' })

    dispatch({ type: 'SET_WAITING_AI', waiting: true })
    dispatch({ type: 'SET_ERROR', error: null })

    try {
      const currentPhase = state.phase
      const systemPrompt = buildSystemPrompt(currentPhase, state.tts.enabled, state.combatMode)
      const charContext = buildCharContext(state)

      const pendingMsg: GameMessage = { id: 'pending', sender: 'player', content, timestamp: Date.now() }
      if (allAttachments?.length) {
        pendingMsg.attachments = allAttachments.map((a) => ({ type: a.type as 'image' | 'document' | 'audio', data: a.data, mimeType: a.mimeType, name: a.name }))
      }
      const allMessages: GameMessage[] = [...state.messages, pendingMsg]

      const aiResponse = await sendChatStream(state.aiConfig, systemPrompt, allMessages, charContext)
      const result = processRawResponse(aiResponse, state.level)

      addLogEntry(content, aiResponse, result.cleaned, currentPhase, dispatch)

      // Dispatch all parsed actions in batch
      for (const action of result.actions) {
        dispatch(action)
      }

      const { transition, messageId } = dispatchPhaseTransition(aiResponse, result, dispatch)

      if (transition === 'setup-complete') {
        dispatch({ type: 'SET_WAITING_AI', waiting: false })
        await generateAdventure()
        return
      }
      if (transition === 'generation-complete') {
        parseCharacterAndQuest(result.cleaned)
        const toneEmotion = resolveToneEmotion(state.setupAnswers)
        if (toneEmotion) {
          dispatch({ type: 'TTS_SET_EMOTION', emotion: toneEmotion as TTSVoiceEmotion })
        }
      }

      if (messageId) {
        await handlePendingImages(result, state.imageConfig, messageId, cleanContentMarkers(result.cleaned), dispatch)
      }

      // Trigger background summarization if conversation is too long
      if (currentPhase === 'playing' && messageId) {
        const msgs = state.messages
        if (shouldSummarize(msgs.length)) {
          const toSummarize = getMessagesToSummarize(msgs)
          if (toSummarize.length > 5) {
            summarizeMessages(state.aiConfig, toSummarize)
              .then((summary) => {
                const { keepFromIndex } = buildSummaryMessages(msgs)
                dispatch({
                  type: 'REPLACE_MESSAGES_WITH_SUMMARY',
                  summaryMessage: {
                    id: `summary-${Date.now()}`,
                    sender: 'system',
                    content: `[Resumen de eventos anteriores: ${summary}]`,
                    timestamp: Date.now(),
                  },
                  keepFromIndex,
                })
              })
              .catch(() => {
                // Silently fail — summarization is optional
              })
          }
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al comunicarse con la IA'
      dispatch({ type: 'SET_ERROR', error: errorMsg })
      dispatch({
        type: 'ADD_MESSAGE',
        message: {
          id: crypto.randomUUID(),
          sender: 'system',
          content: `Error: ${errorMsg}`,
          timestamp: Date.now(),
        },
      })
    } finally {
      dispatch({ type: 'SET_WAITING_AI', waiting: false })
    }
  }

  function undoLastMessage() {
    if (state.isWaitingAI) return
    const playerMsgs = state.messages.filter((m) => m.sender === 'player')
    if (playerMsgs.length === 0) return

    const lastPlayerMsg = playerMsgs[playerMsgs.length - 1]
    const lastAiMsgIndex = state.messages.findIndex((m) => m.id === lastPlayerMsg.id)
    if (lastAiMsgIndex === -1) return

    const aiMsg = state.messages[lastAiMsgIndex + 1]
    if (!aiMsg || aiMsg.sender === 'player') return

    const afterAi = state.messages.slice(lastAiMsgIndex + 2)

    for (const msg of [...afterAi, aiMsg]) {
      dispatch({ type: 'DELETE_MESSAGE', id: msg.id })
    }

    dispatch({ type: 'SET_WAITING_AI', waiting: true })
    clearLastResponseId()

    const currentPhase = state.phase
    const systemPrompt = buildSystemPrompt(currentPhase, state.tts.enabled, state.combatMode)
    const charContext = buildCharContext(state)

    const beforePlayer = state.messages.slice(0, lastAiMsgIndex)
    const pendingMsg: GameMessage = { id: 'pending', sender: 'player', content: lastPlayerMsg.content, timestamp: Date.now() }
    const allMessages: GameMessage[] = [...beforePlayer, ...afterAi, pendingMsg]

    sendChatStream(state.aiConfig, systemPrompt, allMessages, charContext)
      .then((aiResponse) => {
        const result = processRawResponse(aiResponse, state.level)
        addLogEntry(`(deshacer) ${lastPlayerMsg.content}`, aiResponse, result.cleaned, currentPhase, dispatch)

        for (const action of result.actions) {
          dispatch(action)
        }

        const { transition: _, messageId } = dispatchPhaseTransition(aiResponse, result, dispatch)
        if (messageId) {
          handlePendingImages(result, state.imageConfig, messageId, cleanContentMarkers(result.cleaned), dispatch)
        }
      })
      .catch((err) => {
        const errorMsg = err instanceof Error ? err.message : 'Error al comunicar con la IA'
        dispatch({ type: 'SET_ERROR', error: errorMsg })
        dispatch({
          type: 'ADD_MESSAGE',
          message: { id: crypto.randomUUID(), sender: 'system', content: `Error: ${errorMsg}`, timestamp: Date.now() },
        })
      })
      .finally(() => dispatch({ type: 'SET_WAITING_AI', waiting: false }))
  }

  async function generateAdventure(setupAnswersOverride?: Record<string, string>) {
    dispatch({ type: 'SET_WAITING_AI', waiting: true })
    try {
      const aiResponse = await sendChatStream(state.aiConfig, SYSTEM_PROMPTS.generation, state.messages)
      const result = processRawResponse(aiResponse, state.level)

      addLogEntry('(generación automática)', aiResponse, result.cleaned, 'generation', dispatch)

      for (const action of result.actions) {
        dispatch(action)
      }

      dispatch({
        type: 'ADD_MESSAGE',
        message: { id: crypto.randomUUID(), sender: 'system', content: '🌟 Tu personaje y misión han sido creados. ¡La aventura comienza!', timestamp: Date.now() },
      })
      const msgId = crypto.randomUUID()
      dispatch({
        type: 'ADD_MESSAGE',
        message: { id: msgId, sender: 'gm', content: cleanContentMarkers(result.cleaned), timestamp: Date.now() },
      })
      parseCharacterAndQuest(result.cleaned)
      dispatch({ type: 'SET_PHASE', phase: 'playing' })

      // Set initial narrative tone from setup answers if available
      const toneEmotion = resolveToneEmotion(setupAnswersOverride || state.setupAnswers)
      if (toneEmotion) {
        dispatch({ type: 'TTS_SET_EMOTION', emotion: toneEmotion as TTSVoiceEmotion })
      }

      await handlePendingImages(result, state.imageConfig, msgId, cleanContentMarkers(result.cleaned), dispatch)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al generar la aventura'
      dispatch({ type: 'SET_ERROR', error: errorMsg })
      dispatch({
        type: 'ADD_MESSAGE',
        message: { id: crypto.randomUUID(), sender: 'system', content: `Error: ${errorMsg}`, timestamp: Date.now() },
      })
      throw err
    } finally {
      dispatch({ type: 'SET_WAITING_AI', waiting: false })
    }
  }

  // Handle quick setup: when answers arrive during generation phase, trigger generation
  useEffect(() => {
    if (!quickSetupAnswers || state.phase !== 'generation' || state.isWaitingAI) return
    dispatch({ type: 'SET_SETUP_ANSWERS', answers: quickSetupAnswers })
    onQuickSetupConsumed?.()
generateAdventure(quickSetupAnswers)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickSetupAnswers, state.phase, state.isWaitingAI])

  function parseCharacterAndQuest(text: string) {
    const charMatch = text.match(/\[CHARACTER\]([\s\S]*?)\[\/CHARACTER\]/)
    const questMatch = text.match(/\[QUEST\]([\s\S]*?)\[\/QUEST\]/)

    const stats = parseStats(text)
    const skills = parseSkills(text)

    if (charMatch) {
      const charText = charMatch[1].trim()
      dispatch({
        type: 'SET_CHARACTER',
        character: {
          name: extractField(charText, 'Nombre') || 'Aventurero',
          background: extractField(charText, 'Trasfondo') || extractField(charText, 'Historia') || charText.slice(0, 200),
          traits: extractList(charText, 'Rasgos'),
          equipment: extractList(charText, 'Equipo'),
          stats,
          skills,
          hp: 20,
          maxHp: 20,
        },
      })
    }

    if (questMatch) {
      const questText = questMatch[1].trim()
      dispatch({
        type: 'SET_QUEST',
        quest: {
          title: extractField(questText, 'Título') || extractField(questText, 'Misión') || 'La gran aventura',
          description: extractField(questText, 'Descripción') || questText.slice(0, 200),
          objectives: extractList(questText, 'Objetivos').map((o) => ({ name: o, completed: false })),
        },
      })
    }
  }

  const [recording, setRecording] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [attachments, setAttachments] = useState<{ file: File; dataUrl: string }[]>([])
  const recognitionRef = useRef<any>(null)
  const transcriptRef = useRef('')

  function handleFileAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    const newAtts: { file: File; dataUrl: string }[] = []
    for (const f of Array.from(files)) {
      const reader = new FileReader()
      reader.onload = () => {
        newAtts.push({ file: f, dataUrl: reader.result as string })
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
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (!SpeechRecognition) {
        dispatch({ type: 'SET_ERROR', error: 'Tu navegador no soporta transcripción de voz' })
        return
      }

      setRecording(true)
      setInterimText('')
      transcriptRef.current = ''

      const recognition = new SpeechRecognition()
      recognition.lang = 'es-ES'
      recognition.continuous = true
      recognition.interimResults = true
      recognition.onresult = (e: any) => {
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
              onClick={onUndo}
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

function extractField(text: string, field: string): string | null {
  const patterns = [
    new RegExp(`\\*\\*${field}:?\\*\\*\\s*([^\\n]+)`, 'i'),
    new RegExp(`\\*${field}:?\\*\\s*([^\\n]+)`, 'i'),
    new RegExp(`${field}:?\\s*([^\\n]+)`, 'i'),
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return match[1].trim()
  }
  return null
}

function extractList(text: string, field: string): string[] {
  const patterns = [
    new RegExp(`\\*\\*${field}:?\\*\\*([\\s\\S]*?)(?=\\n\\*\\*|$)`, 'i'),
    new RegExp(`${field}:?([\\s\\S]*?)(?=\\n\\w+:|$)`, 'i'),
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      return match[1]
        .split('\n')
        .map((l) => l.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean)
    }
  }
  return []
}

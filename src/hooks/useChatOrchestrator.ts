import { useEffect, useRef } from 'react'
import type { Dispatch } from 'react'
import { useGame } from '../context/useGame'
import { sendChatStream } from '../services/aiService'
import { processRawResponse, cleanContentMarkers, parseStats, parseSkills } from '../utils/commandCleaner'
import type { ProcessedResponse } from '../utils/commandCleaner'
import { shouldSummarize, getMessagesToSummarize, summarizeMessages, buildSummaryMessage } from '../utils/contextSummarizer'
import { buildSystemPrompt, buildCharContext, resolveToneEmotion } from '../utils/charContext'
import { extractField, extractList } from '../utils/parser'
import { generateImage } from '../services/imageService'
import type { Message as GameMessage, GameState, GameAction, RawLogEntry, TTSVoiceEmotion } from '../types/game'

type AttachmentInput = { type: string; data: string; mimeType: string; name: string }

export interface UseChatOrchestratorOptions {
  quickSetupAnswers?: Record<string, string> | null
  onQuickSetupConsumed?: () => void
}

function addLogEntry(playerMsg: string, raw: string, cleaned: string, phase: string, dispatch: Dispatch<GameAction>) {
  const entry: RawLogEntry = {
    timestamp: Date.now(),
    playerMessage: playerMsg,
    rawResponse: raw,
    cleanedResponse: cleaned,
    phase,
  }
  dispatch({ type: 'ADD_LOG_ENTRY', entry })
}

function dispatchPhaseTransition(aiResponse: string, result: ProcessedResponse, dispatch: Dispatch<GameAction>, placeholderId: string | null): { transition: string; messageId: string | null } {
  const putGmMessage = (content: string): string => {
    if (placeholderId) {
      dispatch({ type: 'UPDATE_MESSAGE_CONTENT', id: placeholderId, content })
      return placeholderId
    }
    const id = crypto.randomUUID()
    dispatch({ type: 'ADD_MESSAGE', message: { id, sender: 'gm', content, timestamp: Date.now() } })
    return id
  }
  const hasCommand = (cmd: string) => new RegExp(`\\[{1,2}${cmd}\\]{1,2}`).test(aiResponse)
  if (hasCommand('SETUP_COMPLETE')) {
    const id = putGmMessage(cleanContentMarkers(result.cleaned))
    dispatch({ type: 'SET_PHASE', phase: 'generation' })
    return { transition: 'setup-complete', messageId: id }
  }
  if (hasCommand('GENERATION_COMPLETE')) {
    dispatch({
      type: 'ADD_MESSAGE',
      message: { id: crypto.randomUUID(), sender: 'system', content: '🌟 Tu personaje y misión han sido creados. ¡La aventura comienza!', timestamp: Date.now() },
    })
    const id = putGmMessage(cleanContentMarkers(result.cleaned))
    return { transition: 'generation-complete', messageId: id }
  }
  if (hasCommand('QUEST_COMPLETE')) {
    const id = putGmMessage(cleanContentMarkers(result.cleaned))
    dispatch({
      type: 'ADD_MESSAGE',
      message: { id: crypto.randomUUID(), sender: 'system', content: '🏆 ¡Aventura completada! Gracias por jugar.', timestamp: Date.now() },
    })
    dispatch({ type: 'SET_PHASE', phase: 'completed' })
    const finalText = result.cleaned
    const isSuccess = finalText.includes('éxito') || finalText.includes('victoria') || !finalText.includes('fracaso')
    dispatch({ type: 'SET_ADVENTURE_RESULT', result: isSuccess ? 'success' : 'failure' })
    return { transition: 'quest-complete', messageId: id }
  }
  const id = putGmMessage(cleanContentMarkers(result.cleaned))
  return { transition: 'normal', messageId: id }
}

async function handlePendingImages(result: ProcessedResponse, imageConfig: GameState['imageConfig'], hostMessageId: string, dispatch: Dispatch<GameAction>) {
  if (!result.pendingImages?.length) return
  if (!imageConfig.enabled) return

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

function parseCharacterAndQuest(text: string, dispatch: Dispatch<GameAction>) {
  const charMatch = text.match(/\[CHARACTER\]([\s\S]*?)\[\/CHARACTER\]/)
  const questMatch = text.match(/\[QUEST\]([\s\S]*?)\[\/QUEST\]/)

  const parsedStats = parseStats(text)
  const parsedSkills = parseSkills(text)

  if (charMatch) {
    const charText = charMatch[1].trim()
    dispatch({
      type: 'SET_CHARACTER',
      character: {
        name: extractField(charText, 'Nombre') || 'Aventurero',
        background: extractField(charText, 'Trasfondo') || extractField(charText, 'Historia') || charText.slice(0, 200),
        traits: extractList(charText, 'Rasgos'),
        equipment: extractList(charText, 'Equipo'),
        stats: parsedStats,
        skills: parsedSkills,
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

export function useChatOrchestrator({ quickSetupAnswers, onQuickSetupConsumed }: UseChatOrchestratorOptions = {}) {
  const { state, dispatch } = useGame()
  const abortRef = useRef<AbortController | null>(null)

  async function sendMessage(text?: string, attachmentsIn?: AttachmentInput[]) {
    const content = text ?? ''
    const allAttachments = attachmentsIn
    if (!content && !allAttachments?.length) return

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
    dispatch({ type: 'INCREMENT_STAT', stat: 'messagesSent' })
    dispatch({ type: 'SET_WAITING_AI', waiting: true })
    dispatch({ type: 'SET_ERROR', error: null })

    const controller = new AbortController()
    abortRef.current = controller
    const currentPhase = state.phase
    const placeholderId = currentPhase === 'generation' ? null : crypto.randomUUID()
    if (placeholderId) {
      dispatch({
        type: 'ADD_MESSAGE',
        message: { id: placeholderId, sender: 'gm', content: '', timestamp: Date.now() },
      })
    }
    let lastFlush = 0

    try {
      const systemPrompt = buildSystemPrompt(currentPhase, state.tts.enabled, state.combatMode)
      const charContext = buildCharContext(state)

      const pendingMsg: GameMessage = { id: 'pending', sender: 'player', content, timestamp: Date.now() }
      if (allAttachments?.length) {
        pendingMsg.attachments = allAttachments.map((a) => ({ type: a.type as 'image' | 'document' | 'audio', data: a.data, mimeType: a.mimeType, name: a.name }))
      }
      const allMessages: GameMessage[] = [...state.messages, pendingMsg]

      const aiResponse = await sendChatStream(state.aiConfig, systemPrompt, allMessages, charContext, {
        signal: controller.signal,
        onDelta: (accumulated) => {
          if (!placeholderId) return
          const now = Date.now()
          if (now - lastFlush < 80) return
          lastFlush = now
          dispatch({ type: 'UPDATE_MESSAGE_CONTENT', id: placeholderId, content: accumulated })
        },
      })

      if (controller.signal.aborted && placeholderId) {
        dispatch({ type: 'UPDATE_MESSAGE_CONTENT', id: placeholderId, content: aiResponse })
      }

      const result = processRawResponse(aiResponse, state.level)

      addLogEntry(content, aiResponse, result.cleaned, currentPhase, dispatch)

      for (const action of result.actions) {
        dispatch(action)
      }

      const { transition, messageId } = dispatchPhaseTransition(aiResponse, result, dispatch, placeholderId)

      if (controller.signal.aborted) {
        dispatch({
          type: 'ADD_MESSAGE',
          message: { id: crypto.randomUUID(), sender: 'system', content: '⏹ Generación detenida por el jugador.', timestamp: Date.now() },
        })
        return
      }

      if (transition === 'setup-complete') {
        dispatch({ type: 'SET_WAITING_AI', waiting: false })
        await generateAdventure()
        return
      }
      if (transition === 'generation-complete') {
        parseCharacterAndQuest(result.cleaned, dispatch)
        const toneEmotion = resolveToneEmotion(state.setupAnswers)
        if (toneEmotion) {
          dispatch({ type: 'TTS_SET_EMOTION', emotion: toneEmotion as TTSVoiceEmotion })
        }
      }

      if (messageId) {
        await handlePendingImages(result, state.imageConfig, messageId, dispatch)
      }

      if (currentPhase === 'playing' && messageId) {
        const msgs = state.messages
        if (shouldSummarize(msgs.length)) {
          const toSummarize = getMessagesToSummarize(msgs)
          if (toSummarize.length > 5) {
            summarizeMessages(state.aiConfig, toSummarize)
              .then((summary) => {
                // El reducer calcula keepFromIndex con los mensajes ACTUALES: evita
                // borrar mensajes añadidos mientras la IA generaba el resumen
                dispatch({ type: 'COMPACT_MESSAGES', summaryMessage: buildSummaryMessage(summary) })
              })
              .catch(() => {
                // Silently fail — summarization is optional
              })
          }
        }
      }
    } catch (err) {
      if (controller.signal.aborted) {
        if (placeholderId) {
          dispatch({ type: 'DELETE_MESSAGE', id: placeholderId })
        }
        dispatch({
          type: 'ADD_MESSAGE',
          message: { id: crypto.randomUUID(), sender: 'system', content: '⏹ Generación detenida por el jugador.', timestamp: Date.now() },
        })
        return
      }
      const errorMsg = err instanceof Error ? err.message : 'Error al comunicarse con la IA'
      if (placeholderId) {
        dispatch({ type: 'DELETE_MESSAGE', id: placeholderId })
      }
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
      abortRef.current = null
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

    const currentPhase = state.phase
    const systemPrompt = buildSystemPrompt(currentPhase, state.tts.enabled, state.combatMode)
    const charContext = buildCharContext(state)

    const beforePlayer = state.messages.slice(0, lastAiMsgIndex)
    const pendingMsg: GameMessage = { id: 'pending', sender: 'player', content: lastPlayerMsg.content, timestamp: Date.now() }
    const allMessages: GameMessage[] = [...beforePlayer, ...afterAi, pendingMsg]

    const controller = new AbortController()
    abortRef.current = controller

    sendChatStream(state.aiConfig, systemPrompt, allMessages, charContext, { signal: controller.signal })
      .then((aiResponse) => {
        if (controller.signal.aborted) return
        const result = processRawResponse(aiResponse, state.level)
        addLogEntry(`(deshacer) ${lastPlayerMsg.content}`, aiResponse, result.cleaned, currentPhase, dispatch)

        for (const action of result.actions) {
          dispatch(action)
        }

        const { messageId } = dispatchPhaseTransition(aiResponse, result, dispatch, null)
        if (messageId) {
          handlePendingImages(result, state.imageConfig, messageId, dispatch)
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        const errorMsg = err instanceof Error ? err.message : 'Error al comunicar con la IA'
        dispatch({ type: 'SET_ERROR', error: errorMsg })
        dispatch({
          type: 'ADD_MESSAGE',
          message: { id: crypto.randomUUID(), sender: 'system', content: `Error: ${errorMsg}`, timestamp: Date.now() },
        })
      })
      .finally(() => {
        abortRef.current = null
        dispatch({ type: 'SET_WAITING_AI', waiting: false })
      })
  }

  async function generateAdventure(setupAnswersOverride?: Record<string, string>) {
    dispatch({ type: 'SET_WAITING_AI', waiting: true })
    try {
      const aiResponse = await sendChatStream(state.aiConfig, buildSystemPrompt('generation', state.tts.enabled, state.combatMode), state.messages)
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
      parseCharacterAndQuest(result.cleaned, dispatch)
      dispatch({ type: 'SET_PHASE', phase: 'playing' })

      const toneEmotion = resolveToneEmotion(setupAnswersOverride || state.setupAnswers)
      if (toneEmotion) {
        dispatch({ type: 'TTS_SET_EMOTION', emotion: toneEmotion as TTSVoiceEmotion })
      }

      await handlePendingImages(result, state.imageConfig, msgId, dispatch)
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

  // Quick setup: trigger adventure generation when preset answers arrive
  useEffect(() => {
    if (!quickSetupAnswers || state.phase !== 'generation' || state.isWaitingAI) return
    dispatch({ type: 'SET_SETUP_ANSWERS', answers: quickSetupAnswers })
    onQuickSetupConsumed?.()
    generateAdventure(quickSetupAnswers)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickSetupAnswers, state.phase, state.isWaitingAI])

  function cancelGeneration() {
    abortRef.current?.abort()
  }

  return { sendMessage, undoLastMessage, cancelGeneration }
}

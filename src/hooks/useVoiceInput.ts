import { useEffect, useRef, useState } from 'react'

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

export interface VoiceInputApi {
  recording: boolean
  interimText: string
  start: () => void
  stop: () => Promise<void>
}

export function useVoiceInput(onTranscript: (text: string) => void, onError?: (msg: string) => void): VoiceInputApi {
  const [recording, setRecording] = useState(false)
  const [interimText, setInterimText] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const transcriptRef = useRef('')
  const interimRef = useRef('')
  const callbacksRef = useRef({ onTranscript, onError })

  useEffect(() => {
    callbacksRef.current = { onTranscript, onError }
  })

  function start() {
    void (async () => {
      try {
        const w = window as unknown as { SpeechRecognition?: SpeechRecognitionLikeCtor; webkitSpeechRecognition?: SpeechRecognitionLikeCtor }
        const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
        if (!Ctor) {
          callbacksRef.current.onError?.('Tu navegador no soporta transcripción de voz')
          return
        }

        setRecording(true)
        setInterimText('')
        interimRef.current = ''
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
          interimRef.current = interim
          setInterimText(interim)
        }
        recognition.onerror = () => {}
        recognition.start()
        recognitionRef.current = recognition
      } catch {
        callbacksRef.current.onError?.('Error al iniciar grabación de audio')
      }
    })()
  }

  async function stop() {
    if (!recognitionRef.current) return
    setRecording(false)
    recognitionRef.current.stop()
    recognitionRef.current = null
    await new Promise((r) => setTimeout(r, 150))
    const transcript = (transcriptRef.current + ' ' + interimRef.current).trim()
    setInterimText('')
    interimRef.current = ''
    transcriptRef.current = ''
    if (transcript) {
      callbacksRef.current.onTranscript(transcript)
    } else {
      callbacksRef.current.onError?.('No se pudo transcribir el audio')
    }
  }

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      recognitionRef.current = null
    }
  }, [])

  return { recording, interimText, start, stop }
}

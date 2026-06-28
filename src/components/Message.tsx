import { useState, useCallback } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Message as MessageType } from '../types/game'

interface Props {
  message: MessageType
  isLoading?: boolean
  onSelectOption?: (opt: string) => void
  onSpeak?: (text: string) => void
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'ahora'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `hace ${days} d`
  return new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function Timestamp({ ts }: { ts: number }) {
  return (
    <time
      dateTime={new Date(ts).toISOString()}
      title={new Date(ts).toLocaleString('es-ES')}
      className="text-[10px] text-gray-500 block text-right mt-1"
    >
      {formatRelativeTime(ts)}
    </time>
  )
}

function extractOptions(text: string): string[] {
  const options: string[] = []

  const bracketMatches = text.matchAll(/\{\{(.+?)\}\}/g)
  for (const match of bracketMatches) {
    options.push(match[1])
  }

  if (options.length > 0) return options

  const lines = text.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const numberedMatch = trimmed.match(/^\d+[.)]\s+(.+)/)
    if (numberedMatch) {
      options.push(numberedMatch[1])
      continue
    }
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)/)
    if (bulletMatch) {
      options.push(bulletMatch[1])
      continue
    }
  }

  return options
}

function renderContent(text: string) {
  const parts: { type: 'text' | 'option'; value: string; key: number }[] = []
  let key = 0

  const optionGlobal = /\{\{(.+?)\}\}/g
  let lastIndex = 0
  let match

  while ((match = optionGlobal.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index), key: key++ })
    }
    parts.push({ type: 'option', value: match[1], key: key++ })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex), key: key++ })
  }

  if (parts.length === 0 || parts.every((p) => p.type === 'text')) {
    return splitNumberedAndBulletOptions(text, parts.length > 0 ? parts : [])
  }

  return parts
}

function splitNumberedAndBulletOptions(
  text: string,
  existingParts: { type: 'text' | 'option'; value: string; key: number }[]
): { type: 'text' | 'option'; value: string; key: number }[] {
  const parts = [...existingParts]
  let key = parts.length
  const lines = text.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (parts.length > 0 && parts[parts.length - 1].type === 'text') {
        parts[parts.length - 1] = { ...parts[parts.length - 1], value: parts[parts.length - 1].value + '\n' }
      }
      continue
    }

    const numbered = trimmed.match(/^(\d+[.)]\s*)(.+)/)
    const bullet = !numbered ? trimmed.match(/^([-*]\s*)(.+)/) : null

    if (numbered) {
      const prefix = parts.length > 0 && parts[parts.length - 1].type === 'text'
        ? '\n' + numbered[1]
        : numbered[1]
      parts.push({ type: 'text', value: prefix, key: key++ })
      parts.push({ type: 'option', value: numbered[2], key: key++ })
    } else if (bullet) {
      const prefix = parts.length > 0 && parts[parts.length - 1].type === 'text'
        ? '\n' + bullet[1]
        : bullet[1]
      parts.push({ type: 'text', value: prefix, key: key++ })
      parts.push({ type: 'option', value: bullet[2], key: key++ })
    } else {
      const prefix = parts.length > 0 && parts[parts.length - 1].type === 'text' ? '\n' : ''
      if (parts.length > 0 && parts[parts.length - 1].type === 'text') {
        parts[parts.length - 1] = { ...parts[parts.length - 1], value: parts[parts.length - 1].value + prefix + line }
      } else {
        parts.push({ type: 'text', value: line, key: key++ })
      }
    }
  }

  return parts
}

function RPGLoadingIndicator() {
  return (
    <div className="flex items-center gap-2 h-6" role="status" aria-label="La IA está pensando...">
      <div className="flex gap-1 items-center">
        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-xs text-indigo-400 italic">El Director de Juego reflexiona...</span>
    </div>
  )
}

export default function Message({ message, isLoading, onSelectOption, onSpeak }: Props) {
  const isPlayer = message.sender === 'player'
  const isSystem = message.sender === 'system'
  const isGM = message.sender === 'gm' && !isSystem

  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <div className="px-4 py-2 rounded-lg bg-gray-700/50 text-gray-300 text-sm italic max-w-[80%] text-center">
          {message.content}
          <Timestamp ts={message.timestamp} />
        </div>
      </div>
    )
  }

  return (
    <div className={`flex ${isPlayer ? 'justify-end' : 'justify-start'} my-2`}>
      <div
        className={`px-4 py-3 rounded-2xl max-w-[80%] ${
          isPlayer
            ? 'bg-indigo-600 text-white rounded-br-md'
            : 'bg-gray-700 text-gray-100 rounded-bl-md'
        }`}
      >
        {isLoading ? (
          <RPGLoadingIndicator />
        ) : (
          <>
            {isGM && onSelectOption ? (
              <ClickableContent text={message.content} onSelect={onSelectOption} />
            ) : isPlayer ? (
              message.content
            ) : (
              <MarkdownContent text={message.content} />
            )}
            <Timestamp ts={message.timestamp} />
            {isGM && onSpeak && (
              <button
                onClick={() => onSpeak(message.content)}
                className="mt-2 text-xs text-green-500 hover:text-green-400 transition flex items-center gap-1"
                title="Leer en voz alta"
                aria-label="Leer mensaje en voz alta"
              >
                🔊 Leer
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function MarkdownContent({ text }: { text: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
    </div>
  )
}

function ClickableContent({ text, onSelect }: { text: string; onSelect: (opt: string) => void }) {
  const options = extractOptions(text)
  const parts = renderContent(text)
  const [clickedKey, setClickedKey] = useState<number | null>(null)

  const handleSelect = useCallback((value: string, key: number) => {
    if (clickedKey !== null) return
    setClickedKey(key)
    setTimeout(() => {
      setClickedKey(null)
      onSelect(value)
    }, 200)
  }, [clickedKey, onSelect])

  if (options.length === 0) {
    return <MarkdownContent text={text} />
  }

  return (
    <div>
      <MarkdownContent text={parts.filter((p) => p.type === 'text').map((p) => p.value).join('')} />
      {parts
        .filter((p) => p.type === 'option')
        .map((p) => (
          <button
            key={p.key}
            onClick={() => handleSelect(p.value, p.key)}
            disabled={clickedKey !== null}
            className={`block w-full text-left mt-1.5 px-3 py-2 rounded-lg text-sm transition cursor-pointer ${
              clickedKey === p.key
                ? 'bg-indigo-600 text-white border border-indigo-400 scale-[0.97]'
                : clickedKey !== null
                  ? 'bg-indigo-900/20 text-indigo-400/50 border border-indigo-500/20 cursor-default'
                  : 'bg-indigo-900/40 hover:bg-indigo-700/60 border border-indigo-500/40 hover:border-indigo-400 text-indigo-200 hover:text-white'
            }`}
          >
            {clickedKey === p.key ? <span className="flex items-center gap-2">✓ {p.value}</span> : p.value}
          </button>
        ))}
    </div>
  )
}

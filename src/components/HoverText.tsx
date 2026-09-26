import { useRef, useState, type ReactNode } from 'react'

interface TooltipPos {
  right: number
  top: number
}

interface HoverTextProps {
  /** texto completo a mostrar en el tooltip */
  full: string
  /** contenido visible (puede estar truncado); por defecto el mismo texto */
  children?: ReactNode
  className?: string
  ariaLabel?: string
}

const HOVER_DELAY_MS = 150
const TOOLTIP_MAX_WIDTH = 320
const GAP = 8

export default function HoverText({ full, children, className, ariaLabel }: HoverTextProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pos, setPos] = useState<TooltipPos | null>(null)

  function show() {
    const el = ref.current
    if (!el) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const r = el.getBoundingClientRect()
      const top = Math.max(GAP, Math.min(r.top, window.innerHeight - 120))
      setPos({ right: window.innerWidth - r.left + GAP, top })
    }, HOVER_DELAY_MS)
  }

  function hide() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setPos(null)
  }

  return (
    <>
      <span
        ref={ref}
        className={className}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onKeyDown={(e) => { if (e.key === 'Escape') hide() }}
        tabIndex={0}
        aria-label={ariaLabel}
      >
        {children ?? full}
      </span>
      {pos && (
        <span
          aria-hidden="true"
          className="fixed z-[100] pointer-events-none rounded-lg border border-gray-600 bg-gray-900/95 text-gray-100 text-xs leading-relaxed px-3 py-2 shadow-xl"
          style={{ right: pos.right, top: pos.top, maxWidth: TOOLTIP_MAX_WIDTH, maxHeight: '50vh', overflow: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
        >
          {full}
        </span>
      )}
    </>
  )
}

import { useState, type ReactNode } from 'react'

interface Props {
  icon: string
  title: string
  count?: number | string
  color?: string
  defaultCollapsed?: boolean
  children: ReactNode
  className?: string
  'aria-label'?: string
}

export default function CollapsiblePanel({ icon, title, count, color = 'text-gray-400', defaultCollapsed = false, children, className = '', 'aria-label': ariaLabel }: Props) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  return (
    <div className={`bg-gray-800 rounded-xl p-3 shadow-lg ${className}`} role="region" aria-label={ariaLabel || title} aria-expanded={!collapsed}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wide mb-0"
        aria-expanded={!collapsed}
        aria-label={`${title} ${collapsed ? 'colapsado' : 'expandido'}`}
      >
        <span className={`flex items-center gap-1.5 ${color}`}>
          <span>{icon}</span> {title}
          {count !== undefined && <span className="text-gray-400 font-normal">({count})</span>}
        </span>
        <span className="text-gray-400 text-xs">{collapsed ? '▶' : '▼'}</span>
      </button>
      {!collapsed && <div className="mt-2">{children}</div>}
    </div>
  )
}

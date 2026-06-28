import { useGame } from '../context/GameContext'
import CollapsiblePanel from './CollapsiblePanel'

export default function InventoryPanel() {
  const { state } = useGame()
  const { inventory } = state

  return (
    <CollapsiblePanel icon="🎒" title="Inventario" count={inventory.length} color="text-gray-400" aria-label="Panel de inventario">
      {inventory.length === 0 ? (
        <p className="text-gray-400 text-xs italic">Vacío</p>
      ) : (
        <ul className="space-y-1" role="list" aria-label="Lista de objetos en el inventario">
          {inventory.map((item, i) => (
            <li
              key={i}
              className="flex items-center gap-2 px-2 py-1.5 bg-gray-700/50 rounded-lg text-sm text-gray-200"
              role="listitem"
            >
              <span className="text-yellow-400 shrink-0" aria-hidden="true">✦</span>
              {item}
            </li>
          ))}
        </ul>
      )}
    </CollapsiblePanel>
  )
}

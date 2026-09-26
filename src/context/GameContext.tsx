import { useMemo, useReducer, type ReactNode } from 'react'
import { GameContext } from './useGame'
import { gameReducer, initialState } from './gameReducer'

export default function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState)
  const value = useMemo(() => ({ state, dispatch }), [state, dispatch])
  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  )
}

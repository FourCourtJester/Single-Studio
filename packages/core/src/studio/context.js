import { createContext, useContext } from 'react'

export const StudioContext = createContext(null)

export function useStudio() {
  const studio = useContext(StudioContext)

  if (!studio) throw new Error('Missing <StudioProvider>. Render your app with createStudioRouter() or wrap it yourself.')

  return studio
}

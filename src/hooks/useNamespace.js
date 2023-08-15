// Import core components
import { useMemo } from 'react'
import { useParams } from 'react-router-dom'

// Import our components

export const useNamespace = (...parts) => {
  // Hooks
  const params = useParams()
  const { code } = params

  return useMemo(() => [code, ...parts].join('.'), [code, parts])
}

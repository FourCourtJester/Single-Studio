// Import core components
import { useMemo } from 'react'
import { useParams } from 'react-router-dom'

// Import our components

export const useNamespace = (...parts) => {
  // Hooks
  const params = useParams()
  const { code } = params

  return useMemo(() => {
    if (!Array.isArray(parts) || !parts.length || parts.at(0) === false) return undefined
    if (parts.at(0) === 'code') return code

    return [code, ...parts].join('.')
  }, [code, parts])
}

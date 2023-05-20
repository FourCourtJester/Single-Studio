// Import core components
import { useMemo } from 'react'
import { useParams } from 'react-router-dom'

// Import our components

export const useNamespace = ({ type, name }) => {
  // Hooks
  const params = useParams()
  const { code } = params

  return useMemo(() => {
    const path = [code]

    if (type) path.push(type)
    if (name) path.push(name)

    return path.join('.')
  }, [code, type, name])
}

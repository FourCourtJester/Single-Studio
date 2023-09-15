// Import core components
import { useSelector } from 'react-redux'

// Import our components
import { selector } from 'db/slices/studio'
import { useNamespace } from '.'

export const useStudio = (path) => {
  // Hooks
  const namespace = useNamespace()

  return useSelector((state) => selector(state, `${namespace}.${path}`))
}

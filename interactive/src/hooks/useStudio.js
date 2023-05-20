// Import core components
import { useSelector } from 'react-redux'

// Import our components
import { selector } from 'db/slices/studio'

export const useStudio = (path) => useSelector((state) => selector(state, path))

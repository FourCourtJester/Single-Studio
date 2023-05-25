// Import core components
import { useSelector } from 'react-redux'

// Import our components
import { selector } from 'db/slices/settings'

export const useSettings = (path) => useSelector((state) => (path ? selector(state, path) : state.settings))

// Import core components
import { useSelector } from 'react-redux'

// Import our components
import { selector } from 'db/slices/studio'

/**
 * Hook: Studio
 *
 * @param {string} path
 * @returns {Array}
 */
export const useStudio = (path) => useSelector((state) => selector(state, path))

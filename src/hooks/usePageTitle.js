// Import core components
import { useEffect } from 'react'

// Import our components
// ...

const base = 'Single Studio'

export const usePageTitle = (...titles) => {
  useEffect(() => {
    document.title = titles.concat([base]).join(' - ')
  }, [titles])

  return null
}

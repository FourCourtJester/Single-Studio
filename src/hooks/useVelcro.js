// Import core components
import { useMemo } from 'react'

// Import our components
import { Velcro } from 'workers'

export const useVelcro = () => useMemo(() => Velcro.getInstance(), [])

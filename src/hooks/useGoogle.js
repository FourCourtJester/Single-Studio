// Import core components
import { useMemo } from 'react'

// Import our components
import { GoogleInterface } from 'workers'
import { useEffectOnce } from './useEffectOnce'

const google = new GoogleInterface()

export const useGoogle = (props) => {
  // Properties
  const { id, name, range, t = 5000 } = props
  const { majorDimension = 'ROWS', valueRenderOption = 'FORMATTED_VALUE' } = props

  useEffectOnce(() => {
    if (!google) return () => {}

    google.connect({
      name,
      params: { id, range },
      query: { majorDimension, valueRenderOption },
      t,
    })
  }, [props])

  return useMemo(() => google, [])
}

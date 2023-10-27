// Import core components
import { useMemo } from 'react'

// Import our components
import { Google } from 'workers'
import { useEffectOnce } from '../useEffectOnce'

export const useGoogle = (props) => {
  // Properties
  const { id, name, range, t = 5000 } = props
  const { majorDimension = 'ROWS', valueRenderOption = 'FORMATTED_VALUE' } = props
  // Variables
  const google = new Google()

  useEffectOnce(() => {
    google.connect({
      name,
      params: { id, range },
      query: { majorDimension, valueRenderOption },
      t,
    })
  })

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => google, [])
}

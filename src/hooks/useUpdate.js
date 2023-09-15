// Import core components
import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'

// Import our components
import { updateStudio, updateStudioLocal } from 'db/slices/studio'
import { useNamespace } from '.'

export const useUpdate = (propogate = true) => {
  // Hooks
  const dispatch = useDispatch()
  const namespace = useNamespace()
  // States
  const [update, setUpdate] = useState(undefined)

  useEffect(() => {
    if (update === undefined) return () => {}

    dispatch(
      propogate
        ? updateStudio({
            [namespace]: update,
          })
        : updateStudioLocal({
            [namespace]: update,
          })
    )

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propogate, update])

  return setUpdate
}

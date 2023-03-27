// Import core components
import { useEffect, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { nanoid } from 'nanoid'

// Import our components
import { updateInteractiveComponent, updateInteractiveSelected } from 'db/slices/interactive'
import { Variable } from 'components/studio'

// Import style
// ...

export const _Variable = (properties) => {
  // Properties
  const { id } = properties
  // Hooks
  const dispatch = useDispatch()
  // Refs
  const $id = useRef(id || nanoid(6))
  // Variables
  const [interactiveProps, setInteractiveProps] = useState({})

  const handleFocus = (e) => {
    dispatch(updateInteractiveSelected(interactiveProps))
  }

  useEffect(() => {
    const _props = {
      id: $id.current,
      type: 'Variable',
    }

    setInteractiveProps(_props)
    dispatch(updateInteractiveComponent(_props))

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [$id, id])

  return <Variable id={$id.current} label="Label" name="default" onFocus={handleFocus} />
}

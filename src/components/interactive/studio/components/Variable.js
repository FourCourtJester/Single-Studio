// Import core components
import { useRef } from 'react'
import { useDispatch } from 'react-redux'
import { nanoid } from 'nanoid'

// Import our components
import { updateInteractive } from 'db/slices/interactive'
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

  // const handleBlur = (e) => {
  //   dispatch(updateInteractive(undefined))
  // }

  const handleFocus = (e) => {
    dispatch(
      updateInteractive({
        id: $id.current,
        type: 'Variable',
      })
    )
  }

  return <Variable id={$id.current} label="Label" name="default" onFocus={handleFocus} />
}

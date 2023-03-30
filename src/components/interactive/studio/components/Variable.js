// Import core components
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

// Import our components
import { selectComponent, updateInteractiveSelected } from 'db/slices/interactive'
import { Variable } from 'components/studio'

// Import style
// ...

export const _Variable = (properties) => {
  // Properties
  const { id } = properties
  // Hooks
  const dispatch = useDispatch()
  // Redux
  const component = useSelector((state) => selectComponent(state, id))
  // States
  const [interactiveProps, setInteractiveProps] = useState({})

  const handleFocus = (e) => {
    dispatch(updateInteractiveSelected(interactiveProps))
  }

  useEffect(() => {
    setInteractiveProps({
      id,
      type: 'variable',
    })

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  return <Variable id={id} label={component.label || `Variable ${id}`} name={id} onFocus={handleFocus} />
}

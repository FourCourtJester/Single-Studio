// Import core components
import { useDispatch } from 'react-redux'
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap'

// Import our components
import { resetStudio } from 'db/slices/studio'

// Import style
// ...

/**
 * Component: Reset Button
 *
 * @returns {React.FunctionComponentElement} React.FunctionComponentElement
 */
export const Reset = (properties) => {
  // Properties
  const { label, paths } = properties
  // Hooks
  const dispatch = useDispatch()

  const handleClick = (e) => {
    e.preventDefault()

    dispatch(resetStudio(paths))
  }

  return (
    <OverlayTrigger placement="top" overlay={<Tooltip>Reset {label}</Tooltip>}>
      <Button className="text-dark" variant="danger" onClick={handleClick}>
        <i className="fas fa-rotate-right" />
      </Button>
    </OverlayTrigger>
  )
}

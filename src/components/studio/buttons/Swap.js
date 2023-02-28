// Import core components
import { useDispatch } from 'react-redux'
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap'

// Import our components
import { swapStudio } from 'db/slices/studio'

// Import style
// ...

/**
 * Component: Swap Button
 *
 * @returns {React.FunctionComponentElement} React.FunctionComponentElement
 */
export const Swap = (properties) => {
  // Properties
  const { fields, label } = properties
  // Hooks
  const dispatch = useDispatch()

  const handleClick = (e) => {
    e.preventDefault()

    dispatch(swapStudio(fields.map((field) => `variables.${field}`)))
  }

  return (
    <OverlayTrigger placement="top" overlay={<Tooltip>Swap {label}</Tooltip>}>
      <Button className="text-dark" variant="warning" onClick={handleClick}>
        <i className="fas fa-rotate" />
      </Button>
    </OverlayTrigger>
  )
}

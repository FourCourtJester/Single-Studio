// Import core components
import { useDispatch } from 'react-redux'
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap'

// Import our components
import { swapStudio } from 'db/slices/studio'
import { useNamespace } from 'hooks'

// Import style
// ...

const namespace = 'variables'

export const Swap = (properties) => {
  // Properties
  const { fields, label } = properties
  // Hooks
  const dispatch = useDispatch()
  const path = useNamespace({ type: namespace })

  const handleClick = (e) => {
    e.preventDefault()

    dispatch(swapStudio(fields.map((field) => `${[path]}.${field}`)))
  }

  return (
    <OverlayTrigger placement="top" overlay={<Tooltip>Swap {label}</Tooltip>}>
      <Button className="text-dark" variant="warning" onClick={handleClick}>
        <i className="fas fa-rotate" />
      </Button>
    </OverlayTrigger>
  )
}

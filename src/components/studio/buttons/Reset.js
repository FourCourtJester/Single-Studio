// Import core components
import { useDispatch } from 'react-redux'
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap'

// Import our components
import { resetStudio } from 'db/slices/studio'
import { useNamespace } from 'hooks'

// Import style
// ...

export const Reset = (properties) => {
  // Properties
  const { label, fields } = properties
  // Hooks
  const dispatch = useDispatch()
  const path = useNamespace({})

  const handleClick = (e) => {
    e.preventDefault()

    dispatch(resetStudio(fields.map((field) => `${[path]}.${field}`)))
  }

  return (
    <OverlayTrigger placement="top" overlay={<Tooltip>Reset {label}</Tooltip>}>
      <Button className="text-dark" variant="danger" onClick={handleClick}>
        <i className="fas fa-rotate-right" />
      </Button>
    </OverlayTrigger>
  )
}

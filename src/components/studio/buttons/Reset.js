// Import core components
import { useDispatch } from 'react-redux'
import { Button } from 'react-bootstrap'

// Import our components
import { ToolTip } from 'components/global'
import { removeStudio } from 'db/slices/studio'
import { useNamespace } from 'hooks'

// Import style
// ...

export const Reset = (properties) => {
  // Properties
  const { label, fields, placement = 'top' } = properties
  // Hooks
  const dispatch = useDispatch()
  const namespace = useNamespace()

  const handleClick = (e) => {
    e.preventDefault()

    dispatch(removeStudio(fields.map((field) => `${[namespace]}.${field}`)))
  }

  return (
    <ToolTip placement={placement} tooltip={<>Reset {label}</>}>
      <Button className="text-dark" variant="danger" onClick={handleClick}>
        <i className="fas fa-rotate-right" />
      </Button>
    </ToolTip>
  )
}

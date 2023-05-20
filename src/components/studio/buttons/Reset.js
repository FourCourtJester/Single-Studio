// Import core components
import { useDispatch } from 'react-redux'
import { Button } from 'react-bootstrap'

// Import our components
import { ToolTip } from 'components/global'
import { resetStudio } from 'db/slices/studio'
import { useNamespace } from 'hooks'

// Import style
// ...

export const Reset = (properties) => {
  // Properties
  const { label, fields, placement = 'top' } = properties
  // Hooks
  const dispatch = useDispatch()
  const path = useNamespace({})

  const handleClick = (e) => {
    e.preventDefault()

    dispatch(resetStudio(fields.map((field) => `${[path]}.${field}`)))
  }

  return (
    <ToolTip placement={placement} tooltip={<>Reset {label}</>}>
      <Button className="text-dark" variant="danger" onClick={handleClick}>
        <i className="fas fa-rotate-right" />
      </Button>
    </ToolTip>
  )
}

// Import core components
import { useDispatch } from 'react-redux'
import { Button } from 'react-bootstrap'

// Import our components
import { ToolTip } from 'components/global'
import { swapStudio } from 'db/slices/studio'
import { useNamespace } from 'hooks'

// Import style
// ...

const namespace = 'variables'

export const Swap = (properties) => {
  // Properties
  const { fields, label, placement = 'top' } = properties
  // Hooks
  const dispatch = useDispatch()
  const path = useNamespace(namespace)

  const handleClick = (e) => {
    e.preventDefault()

    dispatch(swapStudio(fields.map((field) => `${[path]}.${field}`)))
  }

  return (
    <ToolTip placement={placement} tooltip={<>Swap {label}</>}>
      <Button className="text-dark" variant="warning" onClick={handleClick}>
        <i className="fas fa-rotate" />
      </Button>
    </ToolTip>
  )
}

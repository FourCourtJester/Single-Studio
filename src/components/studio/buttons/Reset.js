// Import core components
import { Button } from 'react-bootstrap'

// Import our components
import { ToolTip } from 'components/global'
import { useVelcro } from 'hooks'

// Import style
// ...

export const Reset = (properties) => {
  // Properties
  const { label, fields, placement = 'top' } = properties
  // Hooks
  const velcro = useVelcro()

  const handleClick = (e) => {
    e.preventDefault()

    velcro.action(
      'update',
      fields.reduce((obj, entry) => ({ ...obj, [entry]: undefined }), {}),
    )
  }

  return (
    <ToolTip placement={placement} tooltip={<>Reset {label}</>}>
      <Button className="text-dark" variant="danger" onClick={handleClick}>
        <i className="fas fa-rotate-right" />
      </Button>
    </ToolTip>
  )
}

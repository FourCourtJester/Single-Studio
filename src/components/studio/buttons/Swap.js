// Import core components
import { Button } from 'react-bootstrap'

// Import our components
import { ToolTip } from 'components/global'
import { useVelcro } from 'hooks'

// Import style
// ...

export const Swap = (properties) => {
  // Properties
  const { fields = [], label, placement = 'top' } = properties
  // Hooks
  const velcro = useVelcro()

  const handleClick = (e) => {
    e.preventDefault()

    velcro.action('swap', fields)
  }

  return (
    <ToolTip placement={placement} tooltip={<>Swap {label}</>}>
      <Button className="text-dark" variant="warning" onClick={handleClick}>
        <i className="fas fa-rotate" />
      </Button>
    </ToolTip>
  )
}

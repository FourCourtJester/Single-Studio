// Import core components
import { Button } from 'react-bootstrap'
import cN from 'classnames'

// Import our components
import { useVelcro } from 'hooks'

// Import style
// ...

const actions = {
  decrement: {
    color: 'info',
    icon: 'minus',
  },
  increment: {
    color: 'success',
    icon: 'plus',
  },
}
const namespace = 'variables'

export const Math = (properties) => {
  // Properties
  const { name, type, val } = properties
  // Hooks
  const velcro = useVelcro()

  const handleClick = (e) => {
    e.preventDefault()

    velcro.action(type, { [`${namespace}.${name}`]: val })
  }

  return (
    <Button className="text-dark h-100" variant={actions[type].color} onClick={handleClick}>
      <i className={cN('fas', `fa-${actions[type].icon}`)} />
    </Button>
  )
}

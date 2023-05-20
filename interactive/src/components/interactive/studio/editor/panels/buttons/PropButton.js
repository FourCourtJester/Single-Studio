// Import core components
import { useContext } from 'react'
import { Button } from 'react-bootstrap'
import cN from 'classnames'

// Import our components
import { ToolTip } from 'components/global'
import { Context } from '../Context'

// Import style
// ...

export const PropButton = (properties) => {
  // Contexts
  const { fn } = useContext(Context)
  // Properties
  const { active: activeProp, icon, setting, tooltip, value, ...props } = properties
  const active = activeProp === value

  const handleSubmit = (e) => {
    e.preventDefault()

    fn.change(e, { style: { [setting]: [null, value][Number(!active)] } })
  }

  return (
    <ToolTip position="top" tooltip={tooltip}>
      <Button size="sm" variant="light" type="button" active={active} {...props} onClick={handleSubmit}>
        <i className={cN('fas', `fa-${icon}`)} />
      </Button>
    </ToolTip>
  )
}

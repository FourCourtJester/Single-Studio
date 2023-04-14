// Import core components
import cN from 'classnames'
import { Button } from 'react-bootstrap'

// Import our components
import { ToolTip } from 'components/global'

// Import style
// ...

export const PanelButton = (properties) => {
  // Properties
  const { icon, setting, tooltip, ...props } = properties

  return (
    <ToolTip position="top" tooltip={tooltip}>
      <Button size="sm" variant="light" type="button" {...props}>
        <i className={cN('fas', `fa-${icon}`)} />
      </Button>
    </ToolTip>
  )
}

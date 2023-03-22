// Import React and Components
import { useRef } from 'react'
import { OverlayTrigger, Tooltip } from 'react-bootstrap'

// Import Styling
// ...

// Import our Components
// ...

export const ToolTip = (properties) => {
  // Properties
  const { children, tooltip, placement } = properties
  // Refs
  const $element = useRef(children)

  return (
    <OverlayTrigger target={$element.current} placement={placement} overlay={<Tooltip>{tooltip}</Tooltip>}>
      {children}
    </OverlayTrigger>
  )
}

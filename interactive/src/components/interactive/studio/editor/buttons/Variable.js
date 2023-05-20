// Import core components
import { Button } from 'react-bootstrap'
import { useDrag } from 'react-dnd'

// Import our components
import { types } from 'components/interactive/studio'
import { ToolTip } from 'components/global'

// Import style
// ...

export const VariableButton = (properties) => {
  // Hooks
  const [{ isDragging }, $ref] = useDrag(() => ({
    collect: (monitor) => ({
      isDragging: monitor.canDrag() && monitor.isDragging(),
    }),
    item: { type: types.drag.VARIABLE, style: {} },
    options: { dropEffect: 'copy' },
    type: types.drag.BUTTON.VARIABLE,
  }))

  return (
    <ToolTip placement="top" tooltip={<>Variable</>}>
      <Button ref={$ref} size="sm" variant="light" {...properties}>
        <i className="fa fas fa-code" />
      </Button>
    </ToolTip>
  )
}

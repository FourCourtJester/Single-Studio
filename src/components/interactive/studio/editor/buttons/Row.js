// Import core components
import { Button } from 'react-bootstrap'
import { useDrag } from 'react-dnd'

// Import our components
import { types } from 'components/interactive/studio'

// Import style
// ...

function RowButton(properties) {
  // Hooks
  const [{ isDragging }, $ref] = useDrag(() => ({
    collect: (monitor) => ({
      isDragging: monitor.canDrag() && monitor.isDragging(),
    }),
    item: { type: types.drag.ROW },
    options: { dropEffect: 'copy' },
    type: types.drag.BUTTON.ROW,
  }))

  return (
    <Button ref={$ref} variant="light" {...properties}>
      <i className="fa fas fa-arrows-left-right" />
    </Button>
  )
}

// Exported Component for use
export default RowButton

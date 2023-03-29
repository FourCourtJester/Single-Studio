// Import core components
import { Button } from 'react-bootstrap'
import { useDrag } from 'react-dnd'

// Import our components
import { types } from 'components/interactive/studio'
import { ToolTip } from 'components/global'

// Import style
// ...

export const RowButton = (properties) => {
  // Hooks
  const [{ isDragging }, $ref] = useDrag(() => ({
    collect: (monitor) => ({
      isDragging: monitor.canDrag() && monitor.isDragging(),
    }),
    item: { dependents: [], type: types.drag.ROW },
    options: { dropEffect: 'copy' },
    type: types.drag.BUTTON.ROW,
  }))

  return (
    <ToolTip placement="top" tooltip={<>Row</>}>
      <Button ref={$ref} variant="light" {...properties}>
        <i className="fa fas fa-arrows-left-right" />
      </Button>
    </ToolTip>
  )
}

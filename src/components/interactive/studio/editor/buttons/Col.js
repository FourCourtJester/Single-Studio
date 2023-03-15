// Import core components
import { Button } from 'react-bootstrap'
import { useDrag } from 'react-dnd'

// Import our components
import { elementTypes } from 'components/interactive/studio'

// Import style
// ...

function ColButton(properties) {
  // Hooks
  const [{ isDragging }, $ref] = useDrag(() => ({
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    item: { type: elementTypes.COLUMN },
    options: { dropEffect: 'copy' },
    type: elementTypes.BUTTON.COLUMN,
  }))

  return (
    <Button ref={$ref} variant="light" {...properties}>
      <i className="fa fas fa-arrows-up-down" />
    </Button>
  )
}

// Exported Component for use
export default ColButton

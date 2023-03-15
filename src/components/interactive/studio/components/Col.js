// Import core components
import { useRef, useState } from 'react'
import { Col, Row } from 'react-bootstrap'
import { useDrag, useDrop } from 'react-dnd'
import cN from 'classnames'

// Import our components
import { elementTypes } from 'components/interactive/studio'

// Import style
// ...

function ColType(properties) {
  const { index } = properties
  // States
  const [content, setContent] = useState([])
  // Refs
  const $ref = useRef(null)

  // Drag
  const [{ isDragging }, drag] = useDrag({
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    item: () => ({ index, type: elementTypes.COLUMN }),
    type: elementTypes.COLUMN,
  })

  // Drop
  const [{ isOver }, drop] = useDrop(() => ({
    accept: [elementTypes.COLUMN, elementTypes.BUTTON.ROW],
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
    }),
    drop: (item) => {
      switch (item.type) {
        case elementTypes.ROW: {
          setContent((_content) => _content.concat([item.type]))
          break
        }

        default: {
          break
        }
      }
    },
    hover: (item, monitor) => {
      if (!$ref.current) return
      if (item.index === index) return

      console.log(item.index, index)
    },
  }))

  drag(drop($ref))

  const render = (element, i) => {
    switch (element) {
      case elementTypes.ROW: {
        return <Row key={i} />
      }

      default: {
        break
      }
    }
  }

  return (
    <Col ref={$ref} className={cN(isOver && 'hover', isDragging && 'dragging')}>
      {content.map((element, i) => render(element, i))}
    </Col>
  )
}

// Exported Component for use
export default ColType

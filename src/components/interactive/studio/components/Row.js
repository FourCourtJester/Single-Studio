// Import core components
import { useRef, useState } from 'react'
import { useDrag, useDrop } from 'react-dnd'
import { Row } from 'react-bootstrap'
import cN from 'classnames'

// Import our components
import { types } from 'components/interactive/studio'
import * as Utils from 'toolkits/utils'

// Import style
// ...

function RowType(properties) {
  // Properties
  const { dependents, index } = properties
  // States
  const [content, setContent] = useState(dependents || [])
  // Refs
  const $ref = useRef(null)

  // Drag
  const [{ isDragging }, drag] = useDrag({
    collect: (monitor) => ({
      isDragging: monitor.canDrag() && monitor.isDragging(),
    }),
    item: () => ({ ...properties, dependents: content, type: types.drag.ROW }),
    type: types.drag.ROW,
  })

  // Drop
  const [{ isOver, isOverThis }, drop] = useDrop(() => ({
    accept: [types.drag.BUTTON.COLUMN],
    collect: (monitor) => ({
      isOver: monitor.canDrop() && monitor.isOver(),
      isOverThis: monitor.canDrop() && monitor.isOver({ shallow: true }),
    }),
    drop: (item, monitor) => {
      // Prevent drop propogation
      if (monitor.didDrop()) return

      // Add the item to the content of this element
      setContent((_content) => _content.concat([item]))
    },
    // hover: (item, monitor) => {
    //   if (!$ref.current) return
    //   // if (item.index === index) return

    //   console.log(monitor.canDrop(), monitor.isOver({ shallow: true }))
    // },
  }))

  drag(drop($ref))

  const render = (element, i) => {
    const { type, ...props } = { ...element }
    const E = types.tag[Utils.capitalize(type)]

    return <E key={i} {...props} />
  }

  return (
    <Row ref={$ref} className={cN(isOverThis && 'hover', isDragging && 'dragging')}>
      {content.map((element, i) => render(element, i))}
    </Row>
  )
}

// Exported Component for use
export default RowType

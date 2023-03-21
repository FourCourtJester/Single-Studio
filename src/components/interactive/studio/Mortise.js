// Import core components
import { useState } from 'react'
import { Container } from 'react-bootstrap'
import { useDrop } from 'react-dnd'
import cN from 'classnames'

// Import our components
import { types } from 'components/interactive/studio'
import * as Utils from 'toolkits/utils'

// Import style
// ...

function MortiseType() {
  // States
  const [content, setContent] = useState([])
  // Drop
  const [{ isOver, isOverThis }, $ref] = useDrop(() => ({
    accept: [types.drag.BUTTON.ROW],
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
  }))

  const render = (element, i) => {
    const { type, ...props } = { ...element }
    const E = types.tag[Utils.capitalize(type)]

    return <E key={i} {...props} />
  }

  return (
    <Container ref={$ref} id="mortise" className={cN(isOverThis && 'hover', 'position-relative p-2 h-100 overflow-x-hidden overflow-y-auto')} fluid>
      {content.map((element, i) => render(element, i))}
    </Container>
  )
}

// Exported Component for use
export default MortiseType

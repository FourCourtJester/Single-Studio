// Import core components
import { useState } from 'react'
import { Row } from 'react-bootstrap'
import { useDrop } from 'react-dnd'
import cN from 'classnames'

// Import our components
import { elementTypes } from 'components/interactive/studio'
import { Col } from 'components/interactive/studio/components'

// Import style
// ...

function MortiseType() {
  // States
  const [content, setContent] = useState([])
  // Drop
  const [{ isOver }, $ref] = useDrop(() => ({
    accept: [elementTypes.BUTTON.COLUMN, elementTypes.BUTTON.ROW],
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
    }),
    drop: (item) => setContent((_content) => _content.concat([item.type])),
  }))

  const render = (element, i) => {
    switch (element) {
      case elementTypes.COLUMN: {
        return <Col key={i} index={i} />
      }

      case elementTypes.ROW: {
        return <Row key={i} />
      }

      default: {
        break
      }
    }
  }

  return (
    <div ref={$ref} id="mortise" className={cN(isOver && 'hover', 'd-flex w-100 h-100')}>
      {content.map((element, i) => render(element, i))}
    </div>
  )
}

// Exported Component for use
export default MortiseType

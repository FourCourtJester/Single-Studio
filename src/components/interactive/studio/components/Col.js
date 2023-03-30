// Import core components
import { useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useDrag, useDrop } from 'react-dnd'
import { Col } from 'react-bootstrap'
import { nanoid } from 'nanoid'
import cN from 'classnames'

// Import our components
import { types } from 'components/interactive/studio'
import { selectComponent, addInteractiveComponent } from 'db/slices/interactive'
import * as Utils from 'toolkits/utils'

// Import style
// ...

export const _Col = (properties) => {
  // Properties
  const { id, index } = properties
  // Hooks
  const dispatch = useDispatch()
  // Redux
  const { dependents } = useSelector((state) => selectComponent(state, id)) || []
  // Refs
  const $ref = useRef(null)

  // Drag
  const [{ isDragging }, drag] = useDrag({
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    // end: (item, monitor) => {
    //   // Alert the parent that drag has stopped
    //   parent.alert(false)
    // },
    item: () =>
      // Alert the parent that drag has started
      // parent.alert(true)

      // Return the properties of this item
      ({ ...properties, type: types.drag.COLUMN }),
    type: types.drag.COLUMN,
  })

  // Drop
  const [{ isOver, isOverThis }, drop] = useDrop(() => ({
    accept: [types.drag.BUTTON.COLUMN, types.drag.BUTTON.ROW, types.drag.BUTTON.VARIABLE, types.drag.COLUMN],
    canDrop: (item, monitor) => item.type !== types.drag.COLUMN,
    collect: (monitor) => ({
      isOver: monitor.canDrop() && monitor.isOver(),
      isOverThis: monitor.canDrop() && monitor.isOver({ shallow: true }),
    }),
    drop: (item, monitor) => {
      // Prevent drop propogation
      if (monitor.didDrop()) return

      // Add the item to the content of this element
      dispatch(addInteractiveComponent({ id: item.id || nanoid(3), ...item, parent: id }))
    },
    // hover: (item, monitor) => {
    //   if (!$ref.current) return
    //   if (item.index === undefined) return
    //   // if (item.index === index) return

    //   const dragIndex = item.index
    //   const hoverIndex = index

    //   // Determine rectangle on screen
    //   const hoverBoundingRect = $ref.current?.getBoundingClientRect()

    //   // Get vertical middle
    //   const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2

    //   // Determine mouse position
    //   const clientOffset = monitor.getClientOffset()

    //   // Get pixels to the top
    //   const hoverClientY = clientOffset.y - hoverBoundingRect.top

    //   // Only perform the move when the mouse has crossed half of the items height
    //   // When dragging downwards, only move when the cursor is below 50%
    //   // When dragging upwards, only move when the cursor is above 50%
    //   // Dragging downwards
    //   if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
    //     return
    //   }
    //   // Dragging upwards
    //   if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
    //     return
    //   }

    //   // Time to actually perform the action
    //   console.log('reorder')

    //   parent.reorder(dragIndex, hoverIndex)

    //   item.index = hoverIndex
    // },
  }))

  drag(drop($ref))

  const render = (element, i) => {
    const { type, ...props } = { ...element }
    const E = types.tag[Utils.capitalize(type)]

    return <E key={i} index={i} {...props} />
  }

  return (
    <Col ref={$ref} id={id} className={cN(isOverThis && 'hover', isDragging && 'dragging', 'text-center')} data-index={index}>
      {dependents.map((element, i) => render(element, i))}
    </Col>
  )
}

// Import core components
import { useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useDrag, useDrop } from 'react-dnd'
import { Stack } from 'react-bootstrap'
import { nanoid } from 'nanoid'
import cN from 'classnames'

// Import our components
import { types } from 'components/interactive/studio'
import { selectDependents, addInteractiveComponent } from 'db/slices/interactive'
import * as Utils from 'toolkits/utils'

// Import style
// ...

export const _Row = (properties) => {
  // Properties
  const { id, index } = properties
  // Hooks
  const dispatch = useDispatch()
  // Redux
  const { dependents } = useSelector((state) => selectDependents(state, id)) || []
  // States
  const [isChildDragging, setIsChildDragging] = useState(false)
  // Refs
  const $ref = useRef(null)

  // Drag
  const [{ isDragging }, drag] = useDrag({
    collect: (monitor) => ({
      isDragging: monitor.canDrag() && monitor.isDragging(),
    }),
    item: () => ({ ...properties, type: types.drag.ROW }),
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
      dispatch(addInteractiveComponent({ id: item.id || nanoid(3), ...item, parent: id }))
    },
  }))

  drag(drop($ref))

  // const reorder = (item, hover) =>
  //   setContent((_content) => {
  //     const z = _content.slice()

  //     z.splice(item, 1)
  //     z.splice(hover, 0, _content[item])

  //     return z
  //   })

  const render = (element, i) => {
    const { type, ...props } = { ...element }
    const E = types.tag[Utils.capitalize(type)]

    return <E key={i} index={i} {...props} />
  }

  return (
    <Stack
      ref={$ref}
      id={id}
      className={cN((isOver || isChildDragging) && 'hover', isDragging && 'dragging')}
      direction="horizontal"
      gap={2}
      data-index={index}
    >
      {dependents.map((element, i) => render(element, i))}
    </Stack>
  )
}

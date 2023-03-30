// Import core components
import { useDispatch, useSelector } from 'react-redux'
import { useDrop } from 'react-dnd'
import { Container, Stack } from 'react-bootstrap'
import { nanoid } from 'nanoid'
import cN from 'classnames'

// Import our components
import { types } from 'components/interactive/studio'
import { selectComponent, addInteractiveComponent } from 'db/slices/interactive'
import * as Utils from 'toolkits/utils'

// Import style
// ...

export const Mortise = () => {
  // Hooks
  const dispatch = useDispatch()
  // Redux
  const { dependents } = useSelector((state) => selectComponent(state))

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
      dispatch(addInteractiveComponent({ id: nanoid(3), ...item }))
    },
  }))

  const render = (element, i) => {
    const { type, ...props } = { ...element }
    const E = types.tag[Utils.capitalize(type)]

    return <E key={i} index={i} {...props} />
  }

  return (
    <Container ref={$ref} id="mortise" className={cN(isOverThis && 'hover', 'position-relative p-2 h-100 overflow-x-hidden overflow-y-auto')} fluid>
      <Stack gap={2}>{dependents.map((element, i) => render(element, i))}</Stack>
    </Container>
  )
}

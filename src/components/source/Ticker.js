// Import core components
import cN from 'classnames'

// Import our components
import { useStudio } from 'hooks'
import { Transition } from 'components/global'
import { Ticker as StyledTicker } from 'components/global/styled/source'
import { useEffect, useRef, useState } from 'react'

// Import style
// ...

const namespace = 'variables'
const defaults = {
  transition: {
    name: undefined,
    update: undefined,
  },
}

export const Ticker = (properties) => {
  // Properties
  const { className, fallback, name, speed = 50 } = properties
  const { transition = {} } = properties
  // Redux
  const val = useStudio(`${namespace}.${name}`) || fallback || ''
  // States
  const [duration, setDuration] = useState(0)
  const [isActive, setActive] = useState(false)
  const [translateStart, setStart] = useState(1920)
  // Refs
  const $ref = useRef(null)

  const handleUpdate = () => setActive(false)

  useEffect(() => {
    if (!$ref.current) return () => {}
    if (isActive) return () => {}

    const { clientWidth } = $ref.current
    const scrollWidth = [...$ref.current.children].reduce((width, child) => width + child.clientWidth, 0)

    console.log(scrollWidth)

    setDuration(scrollWidth / speed)
    setStart(clientWidth)
    setActive(true)
  }, [$ref, isActive, speed, val])

  useEffect(() => {
    setActive(true)
  }, [])

  return (
    <Transition
      ref={$ref}
      {...properties}
      className={cN('ticker', 'd-flex align-items-center text-nowrap overflow-hidden w-100 h-100', className)}
      update={transition?.update || defaults.transition.update}
      trigger={isActive}
    >
      <div>
        <StyledTicker
          $animation={transition?.animation || defaults.transition.name}
          $translationStart={`${translateStart}px`}
          style={{ animationDuration: `${duration}s` }}
          onAnimationIteration={handleUpdate}
          onAnimationEnd={handleUpdate}
        >
          {val}
        </StyledTicker>
      </div>
    </Transition>
  )
}

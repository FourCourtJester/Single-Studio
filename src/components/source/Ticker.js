// Import core components
import cN from 'classnames'

// Import our components
import { useStudio } from 'hooks'
import { Ticker as StyledTicker } from 'components/global/styled/source'
import { useEffect, useRef, useState } from 'react'

// Import style
// ...

const states = ['inactive', 'active']
const defaults = {
  transition: {
    name: undefined,
    update: undefined,
  },
}

export const Ticker = (properties) => {
  // Properties
  const { className, fallback, name, speed = 100, toggle } = properties
  const { transition = {} } = properties
  // Redux
  const val = useStudio(`variables.${name}`) || fallback || ''
  const show = useStudio(`toggles.${toggle}`)
  // States
  // eslint-disable-next-line react/jsx-no-useless-fragment
  const [content, setContent] = useState(<></>)
  const [duration, setDuration] = useState(0)
  const [isActive, setActive] = useState(false)
  const [translateStart, setStart] = useState(1920)
  // Refs
  const $ref = useRef(null)

  const handleIteration = () => {
    setActive(false)
    setTimeout(() => setActive(true), 500)
  }

  useEffect(() => {
    if (!$ref.current) return () => {}

    const { offsetWidth } = $ref.current
    const scrollWidth = [...$ref.current.children].reduce((width, child) => width + child.clientWidth, 0)

    setDuration((offsetWidth + scrollWidth) / speed)
    setStart(offsetWidth)
  }, [$ref, content, speed])

  useEffect(() => {
    if (isActive) return () => {}

    setContent(val.trim())
  }, [isActive, val])

  useEffect(() => {
    setActive(show !== undefined ? show : content && content.length > 0)
  }, [content, show])

  return (
    <div
      ref={$ref}
      {...properties}
      className={cN('ticker', states[Number(isActive)], 'd-flex align-items-center text-nowrap overflow-hidden w-100 h-100', className)}
    >
      <StyledTicker
        $animation={transition?.animation || defaults.transition.name}
        $translationStart={`${translateStart}px`}
        style={{ animationDuration: `${duration}s` }}
        onAnimationIteration={handleIteration}
      >
        {content}
      </StyledTicker>
    </div>
  )
}

// Import core components
import { useEffect } from 'react'
import cN from 'classnames'

// Import our components
import { Transition } from 'components/global'
import { Timer as StyledTimer } from 'components/global/styled/source'
import { useTimer } from '../studio/hooks'

// Import style
// ...

const namespace = 'timers'
const defaults = {
  transition: {
    update: ['active', 'inactive'],
  },
}

export const Timer = (properties) => {
  // Properties
  const { className, fallback, name, onComplete, onEnter, onExit, value } = properties
  const { transition = {} } = properties
  // Hooks
  const path = `${namespace}.${name}`
  const { active, text } = useTimer({ path, value })

  useEffect(() => {
    if (active && onEnter) onEnter()
    else if (!active && onExit) onExit()
    else if (!active && onComplete) onComplete()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return (
    <Transition {...properties} className={cN('timer', className)} update={transition?.update || defaults.transition.update} trigger={active}>
      <StyledTimer>{text || fallback}</StyledTimer>
    </Transition>
  )
}

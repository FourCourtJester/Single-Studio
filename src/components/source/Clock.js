// Import core components
import { useEffect, useRef, useState } from 'react'
import cN from 'classnames'

// Import our components
import { Transition } from 'components/global'
import { Timer as StyledTimer } from 'components/global/styled/source'

// Import style
// ...

function _getTime() {
  const d = new Date()
  return d.toLocaleTimeString()
}

export const Clock = (properties) => {
  // Properties
  const { className } = properties
  // States
  const [now, setNow] = useState('00:00:00')
  // Refs
  const t = useRef(null)

  useEffect(() => {
    setNow(_getTime())

    t.current = setInterval(() => {
      setNow(_getTime())
    }, 1000)

    return () => clearInterval(t.current)
  }, [])

  return (
    <Transition {...properties} className={cN('clock', className)} update={['inactive', 'active']} trigger>
      <StyledTimer>{now}</StyledTimer>
    </Transition>
  )
}

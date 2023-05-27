// Import core components
import { useEffect, useRef, useState } from 'react'
import cN from 'classnames'

// Import our components
// ...

// Import style
// ...

function getTime() {
  const d = new Date()
  return d.toLocaleTimeString()
}

export const Clock = (properties) => {
  // States
  const [props, setProps] = useState({})
  const [now, setNow] = useState('00:00:00')
  // Refs
  const $ref = useRef(null)
  const t = useRef(null)

  useEffect(() => {
    const { className } = properties

    setProps({
      ...properties,
      className: cN('clock', className),
    })
  }, [properties])

  useEffect(() => {
    setNow(getTime())

    t.current = setInterval(() => {
      setNow(getTime())
    }, 1000)

    return () => clearInterval(t.current)
  }, [])

  return (
    <time ref={$ref} {...props}>
      {now}
    </time>
  )
}

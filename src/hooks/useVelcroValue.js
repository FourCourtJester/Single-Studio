// Import core components
import { useEffect, useState } from 'react'

// Import our components
import { useVelcro } from './useVelcro'

export const useVelcroValue = (path) => {
  // States
  const [val, setVal] = useState(null)
  // Variables
  const velcro = useVelcro()

  useEffect(() => {
    const name = path.split('.').at(-1)

    if (name === 'undefined') return () => {}

    const channel = velcro.subscribe(path)

    channel.addEventListener('message', (response) => {
      setVal(response.data)
    })

    return () => velcro.unsubscribe(path, channel)
  }, [path, velcro])

  return val
}

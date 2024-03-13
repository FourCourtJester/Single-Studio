// Import core components
import { useEffect, useMemo, useState } from 'react'
import { Button, Image } from 'react-bootstrap'

// Import our components
import { usePublic, useVelcro, useVelcroValue } from 'hooks'

// Import style
// ...

const namespace = 'variables'
const defaultChoice = 'None'

export const Cycle = (properties) => {
  // Properties
  const { choices: _choices, image, label, name, variant = 'obs' } = properties
  // Hooks
  const path = `${namespace}.${name}`
  const publik = usePublic()
  const velcro = useVelcro()
  const val = useVelcroValue(path) || defaultChoice
  // States
  const [isImage, setIsImage] = useState(image !== undefined)
  // Variables
  const choices = useMemo(() => [defaultChoice].concat(_choices).concat([defaultChoice]), [_choices])
  const choice = useMemo(() => choices.find((c) => c === val), [choices, val])

  const handleClick = (e) => {
    e.preventDefault()

    const next = choices.findIndex((c) => c === val) + 1

    velcro.action('update', { [path]: choices[next] === defaultChoice ? undefined : choices[next] })
  }

  const handleError = (e) => {
    console.warn(e)
    setIsImage(false)
  }

  useEffect(() => {
    setIsImage(image !== undefined)
  }, [choice, image])

  return (
    <Button className="cycle d-flex flex-grow-1 justify-content-center align-items-center w-100 h-100" variant={variant} onClick={handleClick}>
      {isImage ? <Image className="mw-100 mh-100" onError={handleError} src={`${publik}/${image.replace(/:choice:/, choice)}`} /> : label}
    </Button>
  )
}

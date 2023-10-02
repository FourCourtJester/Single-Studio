// Import core components
import { useEffect, useMemo, useState } from 'react'
import { useDispatch } from 'react-redux'
import { Button, Image } from 'react-bootstrap'

// Import our components
import { useNamespace, usePublic, useStudio } from 'hooks'
import { updateStudio } from 'db/slices/studio'

// Import style
// ...

const namespace = 'variables'
const defaultChoice = 'None'

export const Cycle = (properties) => {
  // Properties
  const { choices: _choices, image, name, variant } = properties
  // Hooks
  const dispatch = useDispatch()
  const path = useNamespace(namespace, name)
  const publik = usePublic()
  // Redux
  const val = useStudio(`${namespace}.${name}`) || defaultChoice
  // States
  const [isImage, setIsImage] = useState(image !== undefined)
  // Variables
  const choices = useMemo(() => [defaultChoice].concat(_choices).concat([defaultChoice]), [_choices])
  const choice = useMemo(() => choices.find((c) => c === val), [choices, val])

  const handleClick = (e) => {
    e.preventDefault()

    const next = choices.findIndex((c) => c === val) + 1

    dispatch(updateStudio({ [path]: choices[next] }))
  }

  const handleError = (e) => {
    console.warn(e)
    setIsImage(false)
  }

  useEffect(() => {
    setIsImage(image !== undefined)
  }, [choice, image])

  return (
    <Button className="cycle d-flex flex-grow-1 justify-content-center align-items-center w-100 h-100" variant={variant || 'outline-obs'} onClick={handleClick}>
      {isImage ? <Image className="mw-100 mh-100" onError={handleError} src={`${publik}/${image.replace(/:choice:/, choice)}`} /> : choice}
    </Button>
  )
}

// Import core components
import { useMemo } from 'react'
import { useDispatch } from 'react-redux'
import { Button, Image } from 'react-bootstrap'
import cN from 'classnames'

// Import our components
import { updateStudio } from 'db/slices/studio'
import { useNamespace, usePublic, useStudio } from 'hooks'

// Import style
// ...

const namespace = 'variables'
const defaultChoice = 'None'

export const Cycle = (properties) => {
  // Properties
  const { choices, image, name, variant } = properties
  // Hooks
  const dispatch = useDispatch()
  const path = useNamespace({ type: namespace, name })
  const publik = usePublic()
  // Redux
  const val = useStudio(path) || defaultChoice
  // Variables
  const choice = useMemo(() => {
    const _choices = [defaultChoice].concat(choices).concat([defaultChoice])

    if (image) {
      const img = image.replace(
        /:choice:/,
        _choices.find((c) => c === val)
      )

      return <Image className="mw-100 mh-100" src={`${image.startsWith('/') ? publik : ''}${img}`} alt={val} />
    }

    return _choices.find((c) => c === val)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choices, image, path, publik, val, variant])

  const handleClick = (e) => {
    e.preventDefault()

    const _choices = [defaultChoice].concat(choices).concat([defaultChoice])
    const next = _choices.findIndex((c) => c === val) + 1

    dispatch(updateStudio({ [path]: _choices[next] }))
  }

  return (
    <Button className="cycle d-flex flex-grow-1 justify-content-center align-items-center w-100 h-100" variant={variant || 'outline-obs'} onClick={handleClick}>
      {choice}
    </Button>
  )
}

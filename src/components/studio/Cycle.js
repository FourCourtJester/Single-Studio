// Import core components
import { useDispatch } from 'react-redux'
import { useParams } from 'react-router-dom'
import { Button, Image } from 'react-bootstrap'
import cN from 'classnames'

// Import our components
import { updateStudio } from 'db/slices/studio'
import { useStudio } from 'hooks'

// Import style
// ...

const namespace = 'variables'
const defaultChoice = 'N/A'

/**
 * Component: Cycle
 *
 * @returns {React.FunctionComponentElement} React.FunctionComponentElement
 */
export const Cycle = (properties) => {
  // Properties
  const { choices, image, name, variant } = properties
  const path = `${namespace}.${name}`
  // Hooks
  const dispatch = useDispatch()
  const params = useParams()
  // Redux
  const val = useStudio(path) || defaultChoice
  // Variables
  const _choices = [defaultChoice].concat(choices).concat([defaultChoice])
  const publik = `/${params.code}`

  const handleClick = (e) => {
    e.preventDefault()

    const next = _choices.findIndex((choice) => choice === val) + 1

    // console.log(path, _choices[next])
    dispatch(updateStudio({ [path]: _choices[next] }))
  }

  if (image && val !== defaultChoice) {
    const img = image.replace(
      /:choice:/,
      _choices.find((choice) => choice === val)
    )

    return (
      <Button
        className={cN('d-flex flex-grow-1 justify-content-center align-items-center w-100 h-100')}
        variant={variant || 'outline-info'}
        onClick={handleClick}
      >
        <Image src={`${publik}/${img}`} fluid />
      </Button>
    )
  }

  return (
    <Button className="d-flex flex-grow-1 justify-content-center align-items-center w-100 h-100" variant={variant || 'outline-info'} onClick={handleClick}>
      {_choices.find((choice) => choice === val)}
    </Button>
  )
}

// Import core components
import { useDispatch } from 'react-redux'
import { Button } from 'react-bootstrap'

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
  const { choices, name } = properties
  const path = `${namespace}.${name}`
  // Hooks
  const dispatch = useDispatch()
  // Redux
  const val = useStudio(path) || defaultChoice
  // Variables
  const _choices = [defaultChoice].concat(choices).concat([defaultChoice])

  const handleClick = (e) => {
    e.preventDefault()

    const next = _choices.findIndex((choice) => choice === val) + 1

    console.log(path, _choices[next])

    // console.log(obj)
    dispatch(updateStudio({ [path]: _choices[next] }))
  }

  return (
    <Button className="d-flex flex-grow-1 justify-content-center align-items-center w-100 h-100" variant="outline-info" onClick={handleClick}>
      {_choices.find((choice) => choice === val)}
    </Button>
  )
}

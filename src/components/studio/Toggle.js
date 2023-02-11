// Import core components
import { useDispatch } from 'react-redux'
import { Button } from 'react-bootstrap'

// Import our components
import { updateStudio } from 'db/slices/studio'
import { useStudio } from 'hooks'

// Import style
// ...

const namespace = 'toggles'
const verbs = ['Show', 'Hide']

/**
 * Component: Toggle
 *
 * @returns {React.FunctionComponentElement} React.FunctionComponentElement
 */
export const Toggle = (properties) => {
  // Properties
  const { icon, label, name } = properties
  const path = `${namespace}.${name}`
  // Hooks
  const dispatch = useDispatch()
  // Redux
  const val = useStudio(path)

  const handleClick = (e) => {
    e.preventDefault()

    console.log(path, !val)

    // console.log(obj)
    dispatch(updateStudio({ [path]: !val }))
  }

  return (
    <Button className="d-flex flex-grow-1 justify-content-center align-items-center w-100 h-100" variant={val ? 'info' : 'outline-info'} onClick={handleClick}>
      {icon ? (
        <i className={`fas fa-${icon}`} />
      ) : (
        <>
          {verbs[Number(val) || 0]} {label}
        </>
      )}
    </Button>
  )
}

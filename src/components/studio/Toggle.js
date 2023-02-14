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
  const { icon, group, label, name } = properties
  const path = `${namespace}.${name}`
  // Hooks
  const dispatch = useDispatch()
  // Redux
  const val = useStudio(path)

  const handleClick = (e) => {
    e.preventDefault()

    let obj = {}

    // Optional: Toggle Group
    // Toggle all group members off
    if (group) {
      obj = {
        ...obj,
        ...group.reduce((props, key) => ({ ...props, [`${namespace}.${key}`]: false }), {}),
      }
    }

    // Toggle this
    obj[path] = !val

    // console.log(obj)
    dispatch(updateStudio(obj))
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

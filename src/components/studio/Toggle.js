// Import core components
import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { Button, Image } from 'react-bootstrap'
import cN from 'classnames'

// Import our components
import { updateStudio } from 'db/slices/studio'
import { useNamespace, usePublic, useStudio } from 'hooks'

// Import style
// ...

const toggleNamespace = 'toggles'
const variableNamespace = 'variables'
const verbs = ['Show', 'Hide']

export const Toggle = (properties) => {
  // Properties
  const { icon, image, group, label, name, variant, value } = properties
  const namespace = value ? variableNamespace : toggleNamespace
  // Hooks
  const dispatch = useDispatch()
  const paths = {
    group: useNamespace({ type: namespace }),
    toggle: useNamespace({ type: namespace, name }),
  }
  const publik = usePublic()
  // Redux
  const val = useStudio(paths.toggle) || false
  // States
  const [active, setActive] = useState(false)
  // Variables
  const isSwitch = value !== undefined

  const handleClick = (e) => {
    e.preventDefault()

    let obj = {}

    // Optional: Toggle Group
    // Toggle all group members off
    if (group) {
      obj = {
        ...obj,
        ...group.reduce((props, key) => ({ ...props, [`${paths.group}.${key}`]: false }), {}),
      }
    }

    // Toggle this
    obj[paths.toggle] = value || !val

    // console.log(obj)
    dispatch(updateStudio(obj))
  }

  useEffect(() => {
    setActive(val === value)
  }, [val, value])

  if (image) {
    const _active = isSwitch ? active : val
    return (
      <Button
        className={cN('d-flex flex-grow-1 justify-content-center align-items-center p-0 w-100 h-100 overflow-hidden', _active ? false : 'opacity-50')}
        variant={variant || 'link'}
        onClick={handleClick}
      >
        <Image src={`${publik}/${image}`} fluid />
      </Button>
    )
  }

  return (
    <Button
      className="d-flex flex-grow-1 justify-content-center align-items-center w-100 h-100"
      variant={val ? variant || 'obs' : `outline-${variant || 'obs'}`}
      onClick={handleClick}
    >
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

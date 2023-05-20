// Import core components
import { useEffect, useMemo, useState } from 'react'
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
  const cache = useStudio(paths.toggle) || false
  // States
  const [active, setActive] = useState(false)
  // Variables
  const state = useMemo(() => {
    if (image) return <Image src={`${image.startsWith('/') ? publik : ''}${image}`} fluid />

    return icon ? (
      <i className={`fas fa-${icon}`} />
    ) : (
      <>
        {verbs[Number(cache) || 0]} {label}
      </>
    )
  }, [icon, image, label, publik, cache])

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
    obj[paths.toggle] = value || !cache

    // console.log(obj)
    dispatch(updateStudio(obj))
  }

  useEffect(() => {
    setActive(image && value !== undefined ? cache === value : cache)
  }, [cache, image, value])

  return (
    <Button
      className={cN(
        'toggle d-flex flex-grow-1 justify-content-center align-items-center w-100 h-100',
        image ? 'p-0 overflow-hidden' : false,
        image && !active ? 'opacity-50' : false
      )}
      variant={active ? variant || 'obs' : `outline-${variant || 'obs'}`}
      onClick={handleClick}
    >
      {state}
    </Button>
  )
}

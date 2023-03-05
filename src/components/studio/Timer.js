// Import core components
import { useEffect, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { Button, FloatingLabel, Form, InputGroup } from 'react-bootstrap'

// Import our components
import { updateStudio } from 'db/slices/studio'
import { useNamespace, useStudio } from 'hooks'
import { useTimer } from './hooks'

// Import style
// ...

const namespace = 'timers'
const varNamespace = '_timers'

function stringToTime(t) {
  if (t === undefined) return 0

  const timeParts = t.toString().split(':')
  let s = 0
  let m = 1

  // Add up the time
  // Entries with no colon returns in seconds
  // Adds up to days correctly
  while (timeParts.length) {
    s += m * +timeParts.pop()
    m *= 60
  }

  // Return seconds
  return Number.isInteger(s) ? s : 0
}

export const Timer = (properties) => {
  // Properties
  const { label, name, placeholder } = properties
  const paths = {
    timer: useNamespace({ type: namespace, name }),
    var: useNamespace({ type: varNamespace, name }),
  }
  // Hooks
  const dispatch = useDispatch()
  const { active, text } = useTimer({ path: paths.timer })
  // Redux
  const front = useStudio(paths.var)
  // States
  const [disabled, setDisable] = useState(false)
  // Refs
  const $ref = useRef(null)

  const handleStart = () => {
    const now = Date.now()
    const target = stringToTime($ref.current.value)

    dispatch(
      updateStudio({
        [paths.timer]: now + target * 1000,
        [paths.var]: $ref.current.value,
      })
    )

    setDisable(true)
  }

  const handleStop = () => dispatch(updateStudio({ [paths.timer]: 0 }))

  const handleKey = (e) => {
    if (e.which === 13) {
      e.preventDefault()
      handleStart()
    }
  }

  useEffect(() => {
    setDisable(active)
  }, [active])

  return active ? (
    <Button className="d-flex flex-grow-1 justify-content-center align-items-center w-100 h-100" variant="outline-obs" onClick={handleStop}>
      {label} - {text}
    </Button>
  ) : (
    <InputGroup>
      <FloatingLabel label={label} onKeyDown={handleKey}>
        <Form.Control ref={$ref} type="text" placeholder={placeholder || '5:00'} defaultValue={front || ''} disabled={disabled} />
      </FloatingLabel>
      <Button variant="obs" disabled={disabled} onClick={handleStart}>
        <i className="await fa fa-spin fa-spinner" />
        <i className="fas fa-play" />
      </Button>
    </InputGroup>
  )
}

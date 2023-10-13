// Import core components
import { useEffect, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { FloatingLabel, Form, InputGroup } from 'react-bootstrap'

// Import our components
import { Button } from 'components/global/styled'
import { useNamespace } from 'hooks'
import { updateStudio } from 'db/slices/studio'
import { stringToTime } from 'toolkits/time'
import { useTimer } from './hooks'

// Import style
// ...

const namespace = 'timers'
const ts = '_ts'
const nput = '_input'

export const Timer = (properties) => {
  // Properties
  const { label = 'Timer', name, placeholder } = properties
  // Hooks
  const dispatch = useDispatch()
  const path = useNamespace(namespace, name)
  const { active, input, text } = useTimer({ path: `${namespace}.${name}` })
  // States
  const [disabled, setDisable] = useState(false)
  // Variables
  const paths = {
    ts: `${path}.${ts}`,
    input: `${path}.${nput}`,
  }
  // Refs
  const $ref = useRef(null)

  const handleStart = () => {
    // Ignore zero length inputs
    if (!$ref.current.value.length) return true

    const now = Date.now()
    const target = stringToTime($ref.current.value)

    dispatch(
      updateStudio({
        [paths.ts]: now + target * 1000,
        [paths.input]: $ref.current.value,
      })
    )

    setDisable(true)
  }

  const handleStop = () => dispatch(updateStudio({ [paths.ts]: null }))

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
        <Form.Control ref={$ref} type="text" placeholder={placeholder || '5:00'} defaultValue={input || ''} disabled={disabled} />
      </FloatingLabel>
      <Button variant="obs" disabled={disabled} onClick={handleStart}>
        <i className="await fa fa-spin fa-spinner" />
        <i className="fas fa-play" />
      </Button>
    </InputGroup>
  )
}
